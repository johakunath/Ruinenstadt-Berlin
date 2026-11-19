// Post-processing chain. Profile and look decide which passes exist:
//   beauty → [GTAO] → ink → hidden hero contour → bloom → grade → output → [FXAA]
// GTAO and the ink outline share one normal/depth pre-pass.
import {
  DepthTexture, HalfFloatType, MeshNormalMaterial, NearestFilter, NoBlending, Vector2, WebGLRenderTarget,
  type Camera, type PerspectiveCamera, type Scene, type Sphere, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Look } from './looks';
import type { Profile } from './profile';
import { HeroOutline } from './hero-outline';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** Ink lines where depth or normals jump (style bible: dark ink outlines). */
const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    texel: { value: new Vector2() },
    near: { value: 0.1 },
    far: { value: 100 },
    strength: { value: 1 },
    ink: { value: [0.035, 0.03, 0.035] },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform vec2 texel;
    uniform float near;
    uniform float far;
    uniform float strength;
    uniform vec3 ink;
    varying vec2 vUv;
    float viewZ(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return (near * far) / (far - d * (far - near));
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float zc = viewZ(vUv);
      vec3 nc = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
      // One-sided differences (right and up only): the line lands on one side of an edge, 1 px wide.
      float dz = 0.0;
      float dn = 0.0;
      for (int i = 0; i < 2; i++) {
        vec2 o = i == 0 ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
        dz += abs(viewZ(vUv + o) - zc);
        dn += 1.0 - dot(nc, texture2D(tNormal, vUv + o).xyz * 2.0 - 1.0);
      }
      // Depth steps scale with distance so far walls do not turn black. Wide ramps give soft, partial lines.
      float edge = max(smoothstep(0.006, 0.024, dz / zc), smoothstep(0.1, 0.55, dn));
      // Lines thin out in the distance fog.
      edge *= strength * (1.0 - smoothstep(30.0, 60.0, zc));
      gl_FragColor = vec4(mix(color.rgb, ink * (0.5 + color.rgb * 0.6), edge), color.a);
    }`,
};

/** Grade in linear light: split toning (teal shadows, warm lights), saturation, contrast, vignette. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1 },
    contrast: { value: 1 },
    split: { value: 0.5 },
    vignette: { value: 0.5 },
    exposure: { value: 1 },
    shoulder: { value: 1 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float split;
    uniform float vignette;
    uniform float exposure;
    uniform float shoulder;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * exposure;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Highlight shoulder: luminance above the knee rolls off (Reinhard on the excess) and keeps its hue,
      // so lamps, fire and shop windows stay readable instead of clipping to white.
      if (l > shoulder) {
        float e = l - shoulder;
        float nl = shoulder + e / (1.0 + e / 0.9);
        c *= nl / l;
        l = nl;
      }
      // Köpenick: shadows lean teal-green, lights lean amber.
      vec3 cool = vec3(0.78, 1.06, 1.08);
      vec3 warm = vec3(1.1, 1.0, 0.86);
      c *= mix(vec3(1.0), mix(cool, warm, smoothstep(0.03, 0.6, l)), split);
      c = mix(vec3(l), c, saturation);
      c = pow(max(c, 0.0) / 0.18, vec3(contrast)) * 0.18;
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.95, dot(d, d) * 2.2);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Post {
  private readonly composer: EffectComposer;
  private readonly gbuffer: WebGLRenderTarget | null;
  private readonly normalMaterial = new MeshNormalMaterial({ blending: NoBlending });
  private readonly heroOutline: HeroOutline;
  private readonly ink: ShaderPass | null = null;
  private readonly gtao: GTAOPass | null = null;
  private readonly bloom: UnrealBloomPass;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly profile: Profile,
    look: Look,
    heroBounds?: (out: Sphere) => Sphere,
    enemyBounds?: (out: Sphere[]) => number,
    lootBounds?: (out: Sphere[]) => number,
  ) {
    const target = new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: profile.msaa });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    const needsG = profile.gtao || look.outline > 0;
    this.gbuffer = needsG
      ? new WebGLRenderTarget(4, 4, { minFilter: NearestFilter, magFilter: NearestFilter, type: HalfFloatType, depthTexture: new DepthTexture(4, 4) })
      : null;

    if (profile.gtao && this.gbuffer) {
      this.gtao = new GTAOPass(scene, camera as Camera, 4, 4, { depthTexture: this.gbuffer.depthTexture ?? undefined, normalTexture: this.gbuffer.texture });
      this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
      this.gtao.blendIntensity = look.ao;
      this.composer.addPass(this.gtao);
    }
    if (look.outline > 0 && this.gbuffer) {
      this.ink = new ShaderPass(InkShader);
      const u = this.ink.uniforms;
      u.tDepth!.value = this.gbuffer.depthTexture;
      u.tNormal!.value = this.gbuffer.texture;
      u.strength!.value = look.outline;
      u.near!.value = camera.near;
      u.far!.value = camera.far;
      this.composer.addPass(this.ink);
    }
    this.heroOutline = new HeroOutline(scene, camera, heroBounds, enemyBounds, lootBounds);
    this.composer.addPass(this.heroOutline);
    this.bloom = new UnrealBloomPass(new Vector2(4, 4), 0.42 * profile.bloomStrength * look.bloom, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    const grade = new ShaderPass(GradeShader);
    grade.uniforms.saturation!.value = look.saturation;
    grade.uniforms.contrast!.value = look.contrast;
    grade.uniforms.split!.value = look.split;
    grade.uniforms.vignette!.value = look.vignette;
    grade.uniforms.exposure!.value = look.exposure;
    grade.uniforms.shoulder!.value = look.shoulder;
    this.composer.addPass(grade);
    this.composer.addPass(new OutputPass());
    // FXAA after tone mapping smooths the ink line and, in Leistung (no MSAA), every geometry edge.
    this.composer.addPass(new FXAAPass());
    this.look = look;
  }

  private readonly look: Look;

  /** `width` and `height` in CSS pixels. */
  setSize(width: number, height: number, dpr: number): void {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.heroOutline.resizeMasks(width, height, dpr, this.profile.gbufferScale);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (this.gbuffer) {
      const s = this.profile.gbufferScale;
      this.gbuffer.setSize(Math.round(w * s), Math.round(h * s));
    }
    // Offsets in pre-pass pixels: one step at full resolution is the thinnest clean line.
    const s = this.profile.gbufferScale;
    const px = Math.max(1, this.look.outlineWidth * s);
    this.ink?.uniforms.texel!.value.set(px / Math.round(w * s), px / Math.round(h * s));
  }

  /**
   * `shadows`: re-render the sun shadow map this frame. `shadowMap.autoUpdate` stays off; the request
   * is set right before the beauty pass so the shadow render uses the main camera's layers, never
   * those of the contour or normal/depth passes (three filters casters by the rendering camera).
   */
  render(dt: number, shadows: boolean): void {
    this.heroOutline.prepare(this.renderer);
    if (this.gbuffer) {
      // Normal and depth of solid geometry only: no cards, glows or effects (FX layer).
      const r = this.renderer;
      const background = this.scene.background;
      const shadows = r.shadowMap.autoUpdate;
      const layers = this.camera.layers.mask;
      this.scene.background = null;
      this.scene.overrideMaterial = this.normalMaterial;
      r.shadowMap.autoUpdate = false;
      this.camera.layers.set(0);
      r.setRenderTarget(this.gbuffer);
      r.setClearColor(0x7777ff, 1);
      r.clear();
      r.render(this.scene, this.camera);
      this.camera.layers.mask = layers;
      r.shadowMap.autoUpdate = shadows;
      this.scene.overrideMaterial = null;
      this.scene.background = background;
      r.setRenderTarget(null);
    }
    // The RenderPass is the composer's first scene render and consumes the request; the full-screen
    // passes after it find `needsUpdate` false again.
    this.renderer.shadowMap.needsUpdate = shadows;
    this.composer.render(dt);
  }
}

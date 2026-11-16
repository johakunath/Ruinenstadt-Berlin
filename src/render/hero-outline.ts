// Hidden character contour only. World materials are never faded, clipped or replaced in beauty.
import { Color, DepthTexture, MeshDepthMaterial, NearestFilter, NoBlending, Vector2, WebGLRenderTarget,
  type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HERO_LAYER, OCCLUDER_LAYER } from './layers';

const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null }, tHero: { value: null }, tOccluder: { value: null },
    stepUv: { value: new Vector2() }, near: { value: 1 }, far: { value: 120 },
    outlineColor: { value: new Color(0xf2cc83) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tHero, tOccluder;
    uniform vec2 stepUv;
    uniform float near, far;
    uniform vec3 outlineColor;
    varying vec2 vUv;
    float distanceToCamera(float d) { return near * far / (far - d * (far - near)); }
    void main() {
      vec4 beauty = texture2D(tDiffuse, vUv);
      float lo = 1.0, hi = 0.0, hidden = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * stepUv;
        float hero = texture2D(tHero, uv).x;
        float objectDepth = texture2D(tOccluder, uv).x;
        float present = 1.0 - step(0.999999, hero);
        lo = min(lo, present); hi = max(hi, present);
        // A small depth margin avoids a contour where feet merely meet a wall or deck.
        float behind = step(0.035, distanceToCamera(hero) - distanceToCamera(objectDepth));
        hidden = max(hidden, present * behind * (1.0 - step(0.999999, objectDepth)));
      }
      float edge = (hi - lo) * hidden;
      gl_FragColor = vec4(mix(beauty.rgb, outlineColor, edge * 0.95), beauty.a);
    }`,
};

function depthTarget(): WebGLRenderTarget {
  return new WebGLRenderTarget(4, 4, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthTexture: new DepthTexture(4, 4),
  });
}

export class HeroOutline extends ShaderPass {
  private readonly heroDepth = depthTarget();
  private readonly occluderDepth = depthTarget();
  private readonly depthMaterial = new MeshDepthMaterial({ blending: NoBlending });

  constructor(private readonly scene: Scene, private readonly camera: PerspectiveCamera) {
    super(OutlineShader);
    this.uniforms.tHero!.value = this.heroDepth.depthTexture;
    this.uniforms.tOccluder!.value = this.occluderDepth.depthTexture;
    this.uniforms.near!.value = camera.near;
    this.uniforms.far!.value = camera.far;
  }

  resizeMasks(width: number, height: number, dpr: number, scale: number): void {
    this.heroDepth.setSize(Math.max(1, Math.round(width * dpr * scale)), Math.max(1, Math.round(height * dpr * scale)));
    this.occluderDepth.setSize(this.heroDepth.width, this.heroDepth.height);
    // Constant CSS-pixel width on both profiles and at different DPRs.
    this.uniforms.stepUv!.value.set(1.25 / width, 1.25 / height);
  }

  prepare(renderer: WebGLRenderer): void {
    const target = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new Color()), alpha = renderer.getClearAlpha();
    const background = this.scene.background, override = this.scene.overrideMaterial;
    const layers = this.camera.layers.mask, shadows = renderer.shadowMap.autoUpdate;
    try {
      this.scene.background = null;
      this.scene.overrideMaterial = this.depthMaterial;
      renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(0x000000, 0);
      for (const [layer, depth] of [[HERO_LAYER, this.heroDepth], [OCCLUDER_LAYER, this.occluderDepth]] as const) {
        this.camera.layers.set(layer);
        renderer.setRenderTarget(depth);
        renderer.clear();
        renderer.render(this.scene, this.camera);
      }
    } finally {
      this.camera.layers.mask = layers;
      this.scene.overrideMaterial = override;
      this.scene.background = background;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
    }
  }

  override dispose(): void {
    this.heroDepth.dispose(); this.occluderDepth.dispose(); this.depthMaterial.dispose();
    super.dispose();
  }
}

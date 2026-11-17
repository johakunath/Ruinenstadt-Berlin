// Hidden character contours only (hero gold, enemies red, V1 2026-11-17). World materials are never faded, clipped or replaced in beauty.
// Cost (R1, docs/tasks/r1-outline-cost.md): nothing is drawn unless an occluder's box overlaps the
// hero's screen rectangle in front of her. Then only the masks with such boxes render their depth,
// both depth renders and the contour are scissored to her rectangle, and the contour is blended onto
// the read buffer (no full-screen copy).
import {
  Box3, Color, DepthTexture, MeshDepthMaterial, NearestFilter, NoBlending, NormalBlending, RedFormat, ShaderMaterial,
  Sphere, UniformsUtils, Vector2, Vector3, Vector4, WebGLRenderTarget, type Mesh, type Object3D, type PerspectiveCamera, type Scene,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { ENEMY_LAYER, HERO_LAYER, OCCLUDER_LAYER } from './layers';

const OutlineShader = {
  uniforms: {
    tHero: { value: null }, tEnemy: { value: null }, tOccluder: { value: null },
    stepUv: { value: new Vector2() }, near: { value: 1 }, far: { value: 120 },
    outlineColor: { value: new Color(0xf2cc83) }, enemyColor: { value: new Color(0xe5483a) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  // Contour colour with the edge as alpha, blended over the frame (same result as mixing the beauty).
  fragmentShader: /* glsl */ `
    uniform sampler2D tHero, tEnemy, tOccluder;
    uniform vec2 stepUv;
    uniform float near, far;
    uniform vec3 outlineColor, enemyColor;
    varying vec2 vUv;
    float distanceToCamera(float d) { return near * far / (far - d * (far - near)); }
    void main() {
      float lo = 1.0, hi = 0.0, hidden = 0.0;
      float elo = 1.0, ehi = 0.0, ehidden = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * stepUv;
        float hero = texture2D(tHero, uv).x;
        float enemy = texture2D(tEnemy, uv).x;
        float objectDepth = texture2D(tOccluder, uv).x;
        float wall = 1.0 - step(0.999999, objectDepth);
        float wallDist = distanceToCamera(objectDepth);
        float present = 1.0 - step(0.999999, hero);
        lo = min(lo, present); hi = max(hi, present);
        // A small depth margin avoids a contour where feet merely meet a wall or deck.
        hidden = max(hidden, present * step(0.035, distanceToCamera(hero) - wallDist) * wall);
        float epresent = 1.0 - step(0.999999, enemy);
        elo = min(elo, epresent); ehi = max(ehi, epresent);
        ehidden = max(ehidden, epresent * step(0.035, distanceToCamera(enemy) - wallDist) * wall);
      }
      float h = (hi - lo) * hidden;
      float e = (ehi - elo) * ehidden;
      gl_FragColor = h > 0.0 ? vec4(outlineColor, h * 0.95) : vec4(enemyColor, e * 0.9);
    }`,
};

/** Depth target; WebGL needs a colour attachment, so it is the smallest one (one byte per pixel). */
function depthTarget(): WebGLRenderTarget {
  return new WebGLRenderTarget(4, 4, {
    format: RedFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthTexture: new DepthTexture(4, 4),
  });
}

/** Screen rectangle in 0..1 (x0, y0, x1, y1) of a sphere; null if the sphere is behind the camera. */
function sphereRect(s: Sphere, camera: PerspectiveCamera, out: Vector4): Vector4 | null {
  const p = v.copy(s.center).applyMatrix4(camera.matrixWorldInverse);
  const depth = -p.z;
  if (depth <= camera.near) return null;
  const ty = Math.tan((camera.fov * Math.PI) / 360) * depth;
  const tx = ty * camera.aspect;
  // A sphere's projection is a little wider than radius / depth: pad by the view angle.
  const r = s.radius * (1 + Math.hypot(p.x, p.y) / depth * 0.5);
  return out.set(((p.x - r) / tx + 1) / 2, ((p.y - r) / ty + 1) / 2, ((p.x + r) / tx + 1) / 2, ((p.y + r) / ty + 1) / 2);
}

/** Screen rectangle in 0..1 of a box, or the whole screen if a corner is behind the camera. */
function boxRect(b: Box3, camera: PerspectiveCamera, out: Vector4): Vector4 {
  out.set(Infinity, Infinity, -Infinity, -Infinity);
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(camera.matrixWorldInverse);
    if (-v.z <= camera.near) return out.set(0, 0, 1, 1);
    v.applyMatrix4(camera.projectionMatrix);
    out.x = Math.min(out.x, (v.x + 1) / 2); out.y = Math.min(out.y, (v.y + 1) / 2);
    out.z = Math.max(out.z, (v.x + 1) / 2); out.w = Math.max(out.w, (v.y + 1) / 2);
  }
  return out;
}

const v = new Vector3();
const cam = new Vector3();
const heroRect = new Vector4();
const rect = new Vector4();
const bounds = new Sphere();
const enemyRect = new Vector4();
/** Enemy contours: at most this many, nearest first (the caller orders them). */
export const ENEMY_OUTLINES = 24;

export class HeroOutline extends Pass {
  private readonly heroDepth = depthTarget();
  private readonly enemyDepth = depthTarget();
  private readonly enemySpheres = Array.from({ length: ENEMY_OUTLINES }, () => new Sphere());
  private readonly occluderDepth = depthTarget();
  private readonly depthMaterial = new MeshDepthMaterial({ blending: NoBlending });
  private readonly material = new ShaderMaterial({ ...OutlineShader, uniforms: UniformsUtils.clone(OutlineShader.uniforms), transparent: true, blending: NormalBlending, depthTest: false, depthWrite: false });
  private readonly quad = new FullScreenQuad(this.material);
  /** Occluder masks found in the scene (refreshed now and then: map chunks are built at load). */
  private masks: Mesh[] = [];
  private scanned = -1;
  /** This frame: draw the contour (an occluder overlaps the hero), and where (0..1 rectangle). */
  private active = false;
  private readonly area = new Vector4();

  /**
   * `heroBounds` writes a world sphere around the hero and her weapon; without it every frame is
   * treated as possibly occluded (no skipping, whole screen).
   */
  constructor(
    private readonly scene: Scene, private readonly camera: PerspectiveCamera, private readonly heroBounds?: (out: Sphere) => Sphere,
    /** Fills spheres around living enemies (nearest first) and returns how many. */
    private readonly enemyBounds?: (out: Sphere[]) => number,
  ) {
    super();
    this.needsSwap = false;
    this.material.uniforms.tHero!.value = this.heroDepth.depthTexture;
    this.material.uniforms.tEnemy!.value = this.enemyDepth.depthTexture;
    this.material.uniforms.tOccluder!.value = this.occluderDepth.depthTexture;
  }

  resizeMasks(width: number, height: number, dpr: number, scale: number): void {
    this.heroDepth.setSize(Math.max(1, Math.round(width * dpr * scale)), Math.max(1, Math.round(height * dpr * scale)));
    this.occluderDepth.setSize(this.heroDepth.width, this.heroDepth.height);
    this.enemyDepth.setSize(this.heroDepth.width, this.heroDepth.height);
    // Constant CSS-pixel width on both profiles and at different DPRs.
    this.material.uniforms.stepUv!.value.set(1.25 / width, 1.25 / height);
  }

  /** Occluder masks with their per-object boxes (BatchSet.occluderMesh). */
  private scan(): void {
    this.masks = [];
    this.scene.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh && o.layers.isEnabled(OCCLUDER_LAYER) && Array.isArray(o.userData.boxes)) this.masks.push(o as Mesh);
    });
  }

  /**
   * Which masks have a box in front of the hero that overlaps her screen rectangle. Fills `area`
   * with that rectangle (padded by the contour width); returns the masks, or null if none.
   */
  private occluding(): Mesh[] | null {
    if (!this.heroBounds) {
      this.area.set(0, 0, 1, 1);
      return this.masks.length ? this.masks : null;
    }
    const camPos = cam.setFromMatrixPosition(this.camera.matrixWorld);
    // Screen rectangles to test: the hero, then the enemies.
    const spheres: Sphere[] = [this.heroBounds(bounds)];
    const n = this.enemyBounds ? this.enemyBounds(this.enemySpheres) : 0;
    for (let i = 0; i < n; i++) spheres.push(this.enemySpheres[i]!);
    const hits: Mesh[] = [];
    this.area.set(Infinity, Infinity, -Infinity, -Infinity);
    for (const s of spheres) {
      const r = s === bounds ? heroRect : enemyRect;
      if (!sphereRect(s, this.camera, r)) continue;
      if (r.z < 0 || r.x > 1 || r.w < 0 || r.y > 1) continue;
      const far = camPos.distanceTo(s.center) + s.radius;
      let covered = false;
      for (const m of this.masks) {
        if (!m.visible) continue;
        for (const b of m.userData.boxes as Box3[]) {
          if (b.distanceToPoint(camPos) > far) continue;
          boxRect(b, this.camera, rect);
          if (rect.x > r.z || rect.z < r.x || rect.y > r.w || rect.w < r.y) continue;
          if (!hits.includes(m)) hits.push(m);
          covered = true;
          break;
        }
      }
      if (covered) this.area.set(Math.min(this.area.x, r.x), Math.min(this.area.y, r.y), Math.max(this.area.z, r.z), Math.max(this.area.w, r.w));
    }
    if (!hits.length) return null;
    const pad = 0.01;
    this.area.set(Math.max(0, this.area.x - pad), Math.max(0, this.area.y - pad), Math.min(1, this.area.z + pad), Math.min(1, this.area.w + pad));
    return hits;
  }

  prepare(renderer: WebGLRenderer): void {
    if (this.scanned < 0 || ++this.scanned > 120) { this.scan(); this.scanned = 0; }
    this.camera.updateMatrixWorld();
    const hits = this.occluding();
    this.active = hits !== null && this.area.z > this.area.x && this.area.w > this.area.y;
    if (!this.active) return;
    this.material.uniforms.near!.value = this.camera.near;
    this.material.uniforms.far!.value = this.camera.far;
    const target = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new Color()), alpha = renderer.getClearAlpha();
    const background = this.scene.background, override = this.scene.overrideMaterial;
    const layers = this.camera.layers.mask, shadows = renderer.shadowMap.autoUpdate;
    const skipped = this.masks.filter((m) => m.visible && !hits!.includes(m));
    try {
      this.scene.background = null;
      this.scene.overrideMaterial = this.depthMaterial;
      renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(0x000000, 0);
      for (const m of skipped) m.visible = false;
      const passes = this.enemyBounds
        ? [[HERO_LAYER, this.heroDepth], [ENEMY_LAYER, this.enemyDepth], [OCCLUDER_LAYER, this.occluderDepth]] as const
        : [[HERO_LAYER, this.heroDepth], [OCCLUDER_LAYER, this.occluderDepth]] as const;
      for (const [layer, depth] of passes) {
        this.camera.layers.set(layer);
        renderer.setRenderTarget(depth);
        this.scissor(depth, renderer);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        depth.scissorTest = false;
      }
    } finally {
      for (const m of skipped) m.visible = true;
      this.camera.layers.mask = layers;
      this.scene.overrideMaterial = override;
      this.scene.background = background;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
    }
  }

  /** Limits drawing into `target` to this frame's area. */
  private scissor(target: WebGLRenderTarget, renderer: WebGLRenderer): void {
    const w = target.width, h = target.height, a = this.area;
    target.scissor.set(Math.floor(a.x * w), Math.floor(a.y * h), Math.ceil((a.z - a.x) * w) + 1, Math.ceil((a.w - a.y) * h) + 1);
    target.scissorTest = true;
    renderer.setRenderTarget(target);
  }

  override render(renderer: WebGLRenderer, _writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    if (!this.active) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    this.scissor(readBuffer, renderer);
    this.quad.render(renderer);
    readBuffer.scissorTest = false;
    renderer.autoClear = auto;
  }

  override dispose(): void {
    this.heroDepth.dispose(); this.enemyDepth.dispose(); this.occluderDepth.dispose(); this.depthMaterial.dispose();
    this.material.dispose(); this.quad.dispose();
  }
}

// Light-giving items on the hero (WP4 step 5b, Johannes 2026-11-26: "die Stirnlampe muss vorn einen Schein haben,
// der auch funktioniert"). A head beam lights the way ahead: a spot light from the lamp on the forehead, plus a
// soft additive haze cone along it (stronger in the dark). Lamps and neon tubes in hand (and the hip lantern)
// tint and lift the hero fill light, so they cost no light at all.
//
// The light count never changes at runtime (a changing count recompiles every shader): the spot is in the scene
// from the start with intensity 0 while no lamp is worn. Leistung has no spot (`real` false): the haze cone and an
// additive ground pool where the beam lands stand in for it. Cost: Qualität and Ausgewogen one spot light without
// shadow in every lit shader plus 1 draw call (cone); Leistung 2 draw calls (cone, pool), no light. Both meshes
// are on FX_LAYER (no pre-pass, no outline) and hidden while no lamp is worn.
import {
  AdditiveBlending, CanvasTexture, Color, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry,
  PointLight, ShaderMaterial, SpotLight, Vector3,
} from 'three';
import type { HeroLight } from '../data/item-light';
import { FX_LAYER } from './layers';

/** Beam: tilt below level (rad), half angle (rad), reach (m), haze cone length (m). */
const PITCH = 0.3;
const ANGLE = 0.36;
const REACH = 15;
const CONE_LEN = 6.5;
/** Spot strength at night with a full-strength lamp. */
const SPOT_INTENSITY = 160;
/** Fill light without a lamp (renderer's hero fill) and its boost for a full-strength glow. */
const FILL = { color: 0xffe2bd, intensity: 9, boost: 16, tint: 0.9 };
/** Seconds to fade a lamp in or out (equipping, the lamp is never a hard cut). */
const FADE = 0.35;

const tmp = new Vector3();
const dir = new Vector3();
const white = new Color(1, 1, 1);

/** Radial pool for the Leistung ground spot: bright centre, soft edge. */
function poolTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** Haze cone: apex at the lamp, opening along +z; bright near the lamp, gone at the far end, soft at the rim. */
function hazeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color() }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      void main() {
        vAlong = position.z / ${CONE_LEN.toFixed(2)};
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying float vAlong;
      varying float vFacing;
      void main() {
        float along = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.06, vAlong);
        gl_FragColor = vec4(color * opacity * along * pow(vFacing, 1.4), 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}

export class HeroLamp {
  readonly group = new Group();
  private readonly spot: SpotLight | null;
  private readonly cone: Mesh<ConeGeometry, ShaderMaterial>;
  private readonly pool: Mesh<PlaneGeometry, MeshBasicMaterial> | null;
  private readonly head: Object3D | null;
  /** Eased 0..1 of the beam and of the glow; the last colours, kept while they fade out. */
  private beamOn = 0;
  private glowOn = 0;
  private readonly beamColor = new Color(0xfff2b0);
  private readonly glowColor = new Color(FILL.color);
  private beamStrength = 0;
  private glowStrength = 0;
  /** 0..1: how much a glow is on now; the renderer lowers the fill light toward the hand by it. */
  glowWeight = 0;

  /** `heroRoot`: the hero model (the lamp sits on its `Head` bone). `real`: a spot light (not on Leistung). */
  constructor(heroRoot: Object3D, real: boolean) {
    this.head = heroRoot.getObjectByName('Head') ?? null;
    if (real) {
      this.spot = new SpotLight(this.beamColor, 0, REACH, ANGLE, 0.4, 1.2);
      this.spot.castShadow = false;
      this.group.add(this.spot, this.spot.target);
    } else this.spot = null;
    const g = new ConeGeometry(Math.tan(ANGLE * 0.8) * CONE_LEN, CONE_LEN, 20, 1, true);
    g.translate(0, -CONE_LEN / 2, 0);
    g.rotateX(-Math.PI / 2);
    this.cone = new Mesh(g, hazeMaterial());
    this.cone.layers.set(FX_LAYER);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 3;
    this.cone.visible = false;
    this.group.add(this.cone);
    if (!real) {
      const p = new PlaneGeometry(1, 1);
      p.rotateX(-Math.PI / 2);
      const m = new MeshBasicMaterial({ map: poolTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, color: this.beamColor });
      this.pool = new Mesh(p, m);
      this.pool.layers.set(FX_LAYER);
      this.pool.renderOrder = 2;
      this.pool.visible = false;
      this.group.add(this.pool);
    } else this.pool = null;
  }

  /** Shows the cone and pool for the one shader compile at load (`compileAsync` skips hidden meshes); the first update hides them. */
  prewarm(): void {
    this.cone.visible = true;
    if (this.pool) this.pool.visible = true;
  }

  /**
   * Per frame. `light`: what the hero carries now; `facing`: hero yaw; `ground`: height at x, z; `dark`: 0 by day
   * to 1 at night (the sky's lamp scale); `fill`: the hero fill light the glows tint.
   */
  update(light: HeroLight, facing: number, ground: (x: number, z: number) => number, dark: number, fill: PointLight, dt: number): void {
    const k = Math.min(1, dt / FADE);
    if (light.beam) { this.beamColor.set(light.beam.color); this.beamStrength = light.beam.strength; }
    if (light.glow) { this.glowColor.set(light.glow.color); this.glowStrength = light.glow.strength; }
    this.beamOn += ((light.beam ? 1 : 0) - this.beamOn) * k;
    this.glowOn += ((light.glow ? 1 : 0) - this.glowOn) * k;
    if (this.beamOn < 0.01) this.beamOn = light.beam ? this.beamOn : 0;
    if (this.glowOn < 0.01) this.glowOn = light.glow ? this.glowOn : 0;

    // Glow: the fill light leans toward the glow colour and gets stronger.
    const g = this.glowOn * this.glowStrength;
    this.glowWeight = g;
    fill.color.setHex(FILL.color).lerp(this.glowColor, FILL.tint * g);
    fill.intensity = FILL.intensity + FILL.boost * g;

    const b = this.beamOn * this.beamStrength;
    const on = b > 0.001 && this.head !== null;
    this.cone.visible = on;
    if (this.pool) this.pool.visible = on;
    if (this.spot) this.spot.intensity = on ? SPOT_INTENSITY * b * (0.45 + 0.55 * dark) : 0;
    if (!on) return;

    // The lamp: just in front of the forehead; the beam follows the body's facing, tipped down.
    this.head!.getWorldPosition(tmp);
    dir.set(Math.sin(facing), 0, Math.cos(facing));
    tmp.addScaledVector(dir, 0.11).y += 0.07;
    dir.set(Math.sin(facing) * Math.cos(PITCH), -Math.sin(PITCH), Math.cos(facing) * Math.cos(PITCH));
    this.cone.position.copy(tmp);
    this.cone.lookAt(tmp.x + dir.x, tmp.y + dir.y, tmp.z + dir.z);
    const haze = this.cone.material.uniforms;
    (haze.color!.value as Color).copy(this.beamColor).lerp(white, 0.2);
    haze.opacity!.value = b * (0.08 + 0.22 * dark);

    if (this.spot) {
      this.spot.color.copy(this.beamColor);
      this.spot.position.copy(tmp);
      this.spot.target.position.set(tmp.x + dir.x * 6, tmp.y + dir.y * 6, tmp.z + dir.z * 6);
    }
    if (this.pool) {
      // Where the beam centre meets the ground, stretched along it.
      const drop = Math.max(0.5, tmp.y - ground(tmp.x, tmp.z));
      const d = Math.min(REACH * 0.6, drop / Math.tan(PITCH));
      const x = tmp.x + Math.sin(facing) * d * 0.85;
      const z = tmp.z + Math.cos(facing) * d * 0.85;
      this.pool.position.set(x, ground(x, z) + 0.06, z);
      this.pool.rotation.y = facing;
      this.pool.scale.set(3.2, 1, 5.2);
      this.pool.material.color.copy(this.beamColor).multiplyScalar(b * (0.35 + 0.45 * dark));
    }
  }
}

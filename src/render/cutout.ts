// See-through cutout (backlog B4): walls, roofs and tree crowns between the camera and the hero are
// dithered away in a soft circle so the fight stays visible. World space: a fragment is cut when it
// lies near the hero→camera line, nearer to the camera than the hero, and above knee height.
// Applied to building and tree materials and to the normal pre-pass (post.ts), so outlines and
// ambient occlusion get the same hole.
import { Vector3, type Material } from 'three';

export const cutout = {
  hero: { value: new Vector3() },
  cam: { value: new Vector3(0, 20, 20) },
  /** 0 = off (courtyard, title). */
  on: { value: 0 },
};

const RADIUS = 3.6;

export function applyCutout(mat: Material): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uCutHero = cutout.hero;
    shader.uniforms.uCutCam = cutout.cam;
    shader.uniforms.uCutOn = cutout.on;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vCutWorld;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cutW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutW = instanceMatrix * cutW;
        #endif
        vCutWorld = (modelMatrix * cutW).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 vCutWorld;
        uniform vec3 uCutHero;
        uniform vec3 uCutCam;
        uniform float uCutOn;
        void main() {
        if (uCutOn > 0.5 && vCutWorld.y > 0.9) {
          vec3 a = uCutHero + vec3(0.0, 1.0, 0.0);
          vec3 ab = uCutCam - a;
          float t = dot(vCutWorld - a, ab) / dot(ab, ab);
          if (t > 0.06) {
            float d = length(vCutWorld - (a + ab * clamp(t, 0.0, 1.0)));
            float r = ${RADIUS.toFixed(1)} * (0.7 + 0.6 * t);
            float k = 1.0 - smoothstep(r * 0.65, r, d);
            // 4×4 ordered dither: the hole has a soft, painterly edge without blending.
            vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
            float bayer = mod(q.x * 4.0 + q.y * 7.0 + q.x * q.y * 3.0, 16.0) / 16.0;
            if (k > bayer) discard;
          }
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'cutout';
  mat.needsUpdate = true;
}

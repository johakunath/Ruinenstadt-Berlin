import { describe, expect, it } from 'vitest';
import { FollowCamera } from './camera';

describe('FollowCamera shake', () => {
  it('settles at low frame rates instead of diverging', () => {
    for (const fps of [60, 20, 12, 10]) {
      const cam = new FollowCamera();
      cam.snap(0, 0);
      cam.shake(1, 0, 0.3);
      for (let i = 0; i < fps * 2; i++) cam.update(0, 0, 0, 0, 1 / fps);
      expect(cam.kickOffset).toBeLessThan(0.01);
    }
  });
});

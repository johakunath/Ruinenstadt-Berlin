import { defineConfig } from 'vitest/config';

// Relative base so the build works on GitHub Pages under /Ruinenstadt-Berlin/ and on any preview host.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});

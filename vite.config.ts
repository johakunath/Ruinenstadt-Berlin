import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Short commit hash for the telemetry version (`3d-0.1.0+abc1234`), so runs of different builds can be told apart.
function build(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

// Relative base so the build works on GitHub Pages under /Ruinenstadt-Berlin/ and on any preview host.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});

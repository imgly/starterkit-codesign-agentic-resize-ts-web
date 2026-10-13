// `pnpm run build:runner`: the runner server as one file Node runs with no install, for Compose's `runner` service.
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('../../../..', import.meta.url)),
  // The runner reads its settings from its environment, not from a build.
  envPrefix: 'RUNNER_BUILD_',
  publicDir: false,
  build: {
    ssr: 'src/hosting/cloud/runner/serve.ts',
    outDir: 'dist/runner',
    emptyOutDir: true,
    target: 'node22',
    // The sample design, read from beside the bundle by the URL the build gives it.
    ssrEmitAssets: true,
    assetsInlineLimit: 0,
    rollupOptions: { output: { entryFileNames: 'serve.mjs' } }
  },
  ssr: { noExternal: true, target: 'node' }
});

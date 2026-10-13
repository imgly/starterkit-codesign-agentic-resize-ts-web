import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';

import { GATEWAY_ORIGIN } from './shared/src/config.js';
import { gatewayDevProxy } from './shared/vite/gateway-dev-proxy.js';
import { checkLicenceEnv } from './shared/vite/licence.js';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Every variable, prefixed or not; only VITE_* ever reach the page.
  const env = loadEnv(mode, here, '');
  checkLicenceEnv(env);
  return {
    base: './',
    plugins: [
      // This origin's /gateway adds the key, as your backend's would (`startSession`).
      gatewayDevProxy({
        upstream: env.IMGLY_GATEWAY_UPSTREAM || GATEWAY_ORIGIN,
        apiKey: env.IMGLY_GATEWAY_API_KEY ?? ''
      })
    ],
    worker: { format: 'es' },
    build: { target: 'es2022' },
    server: { port: 5191 }
  };
});

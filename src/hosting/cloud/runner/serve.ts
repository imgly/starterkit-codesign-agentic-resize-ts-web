// Starts Agentic Resize's runner server: `pnpm exec vite-node src/hosting/cloud/runner/serve.ts` from the starter kit's folder,
// with the cloud hosting's containers running and its variables in `.env`; or Compose's `runner` service.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';

import { resizeRunner } from './index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const REQUIRED = ['EXECUTOR_URLS', 'IMGLY_GATEWAY_API_KEY', 'ALLOWED_ORIGINS'];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `The runner needs ${missing.join(', ')}: set them in .env (see src/hosting/cloud/.env.template).`
  );
  process.exit(1);
}
const port = Number(process.env.RUNNER_PORT ?? 8793);
const host = process.env.RUNNER_HOST ?? '127.0.0.1';
const handler = resizeRunner(process.env);
createServer((req, res) => {
  handler(req, res).catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end();
  });
}).listen(port, host, () => console.log(`Runner: http://${host}:${port}`));

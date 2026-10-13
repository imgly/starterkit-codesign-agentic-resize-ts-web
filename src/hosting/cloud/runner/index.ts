// Agentic Resize's runner server, on the cloud hosting: the job the page asks for (`src/runner/`) runs here, for each
// person `auth.ts` lets in, on the executors in your containers, paid for by the platform's gateway key. A server
// process; the page reaches it only through `client.ts`.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { remoteExecutors } from '@imgly/codesign-sdk';
import { GATEWAY_ORIGIN } from '../../../../shared/src/config.js';
import { executorPool } from '../../../../shared/hosting/cloud/executor-pool.js';

import sampleURL from '../../../../samples/nordwind-autumn-roast-ad.imgly?url';
import { runnerAuth } from './auth.js';
import { runnerHandler } from './server.js';

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item !== '');

/**
 * `EXECUTOR_URLS`: the executors, one conversation at a time each; `IMGLY_GATEWAY_API_KEY`: the platform's key, which
 * pays every model call; `ALLOWED_ORIGINS`: the page origins that may call. The rest of `env` is `runnerAuth`'s.
 */
export function resizeRunner(
  env: Parameters<typeof runnerAuth>[0] & {
    EXECUTOR_URLS?: string;
    IMGLY_GATEWAY_API_KEY?: string;
    IMGLY_GATEWAY_URL?: string;
  }
) {
  const acquire = executorPool(list(env.EXECUTOR_URLS));
  const gatewayKey = env.IMGLY_GATEWAY_API_KEY ?? '';
  return runnerHandler({
    authenticate: runnerAuth(env),
    origins: list(env.ALLOWED_ORIGINS),
    host: {
      // Each run and each render is a conversation of its own, on a container of the pool; nothing to stop after.
      startExecutors: () => ({
        executors: remoteExecutors({ acquire }),
        release: () => undefined
      }),
      // Bundled with the runner, by the URL its build gave it, under the folder the runner starts in.
      readSample: async () =>
        new Uint8Array(await readFile(join(process.cwd(), sampleURL)))
    },
    gateway: {
      baseURL: list(env.IMGLY_GATEWAY_URL || GATEWAY_ORIGIN)[0]!,
      bearer: async () => gatewayKey
    }
  });
}

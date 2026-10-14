// This starter kit's cloud hosting: the runner (`runner/`) and the executors on servers you run, and only the page in the
// browser. IMG.LY does not host this for you. `src/hosting.ts` picks it; what to run is `compose.yaml` here, and the
// starter kit's README says how.

import type { ConnectRunnerOptions, RunnerEndpoint } from '../../protocol.js';
import { runnerClient } from './runner/client.js';

const RUNNER = (import.meta.env.VITE_RUNNER_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

/** The runner server, which the session's token reaches: every resize and render runs there. */
export function connectRunner({
  session
}: ConnectRunnerOptions): RunnerEndpoint {
  if (RUNNER === '') {
    throw new Error(
      'This starter kit is set up for cloud hosting, but its build has no VITE_RUNNER_URL. Set it in .env (see src/hosting/cloud/.env.template) and start the runner and the containers.'
    );
  }
  return runnerClient(RUNNER, session.getToken);
}

/** Whether the page's CE.SDK licence starts the executors: the executors start on their own key; the page’s licence is only for the editor. */
export const licenceStartsExecutors = false;

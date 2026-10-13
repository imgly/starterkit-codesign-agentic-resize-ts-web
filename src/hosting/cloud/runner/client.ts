// The page's runner on the cloud hosting: each message goes to the runner server as one POST with the session's token,
// and the lines of its answer come back as the runner's messages. A run that cannot reach the end fails in words.

import type { GetToken } from '../../../../shared/src/page/token-requests.js';

import type {
  PageToRunner,
  RunnerEndpoint,
  RunnerToPage
} from '../../../protocol.js';
import { decode, encode } from './wire.js';

type Listener = (event: MessageEvent<RunnerToPage>) => void;

const ENDS = new Set<RunnerToPage['type']>([
  'done',
  'failed',
  'rendered',
  'render.failed'
]);

/** `url`: the runner server. */
export function runnerClient(url: string, getToken: GetToken): RunnerEndpoint {
  const base = url.replace(/\/+$/, '');
  const listeners = new Set<Listener>();
  const receive = (message: RunnerToPage) => {
    const event = new MessageEvent('message', { data: message });
    for (const listener of listeners) listener(event);
  };

  const send = async (message: PageToRunner) => {
    if (message.type !== 'resize' && message.type !== 'render') return;
    let ended = false;
    try {
      const response = await fetch(`${base}/runs`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await getToken()}`,
          'content-type': 'application/json'
        },
        body: encode(message)
      });
      if (!response.ok || response.body === null) {
        throw new Error(`the runner at ${base} answered ${response.status}`);
      }
      const lines = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await lines.read();
        if (done) break;
        buffer += value;
        const complete = buffer.split('\n');
        buffer = complete.pop() ?? '';
        for (const line of complete) {
          if (line === '') continue;
          const out = decode(line) as RunnerToPage;
          ended ||= ENDS.has(out.type);
          receive(out);
        }
      }
      if (!ended) throw new Error(`the runner at ${base} stopped answering`);
    } catch (error) {
      if (ended) return;
      const said = error instanceof Error ? error.message : String(error);
      receive(
        message.type === 'resize'
          ? { type: 'failed', run: message.run, error: said }
          : { type: 'render.failed', id: message.id, error: said }
      );
    }
  };

  return {
    postMessage: (message) => void send(message),
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener)
  };
}

// The runner as an HTTP server: the page POSTs one message to /runs, a resize or a render of a source, and the answer
// streams everything for it as JSON lines, ending with its result. The agent loop runs here, on the platform's gateway
// key; the page holds no key and reaches no executor.
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { MessageEndpoint } from '../../../../shared/src/protocol.js';

import type { PageToRunner, RunnerToPage } from '../../../protocol.js';
import { createRunner, type Hosting } from '../../../runner/serve.js';
import { decode, encode } from './wire.js';

type Listener = (event: MessageEvent<PageToRunner>) => void;

/** The message that ends each request's answer. */
const LAST: Partial<Record<PageToRunner['type'], RunnerToPage['type'][]>> = {
  resize: ['done', 'failed'],
  render: ['rendered', 'render.failed']
};

export function runnerHandler(opts: {
  /** Yours: the signed-in person a request's credentials name, or `undefined` to answer 401. */
  authenticate(req: IncomingMessage): Promise<string | undefined>;
  /** The page origins that may call, for CORS. */
  origins: readonly string[];
  /** Where the runs' designs open, and the first sample. */
  host: Hosting;
  /** The gateway the agent calls, and the platform's key that pays it. */
  gateway: { baseURL: string; bearer(): Promise<string> };
}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const host = { gatewayBaseURL: opts.gateway.baseURL, meteringBaseURL: '' };
  return async (req, res) => {
    const origin = req.headers.origin;
    if (origin !== undefined && opts.origins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader(
        'access-control-allow-headers',
        'authorization, content-type'
      );
      res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
      res.setHeader('vary', 'origin');
    }
    const url = new URL(req.url ?? '/', 'http://runner');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/runs') {
      res.writeHead(404).end();
      return;
    }
    if ((await opts.authenticate(req)) === undefined) {
      res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
      return;
    }
    let message: PageToRunner;
    try {
      message = decode(await readText(req)) as PageToRunner;
    } catch {
      res.writeHead(400).end();
      return;
    }
    const last = LAST[message.type];
    if (last === undefined) {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-store'
    });
    res.flushHeaders();
    const listeners = new Set<Listener>();
    const page: MessageEndpoint<RunnerToPage, PageToRunner> = {
      postMessage: (out) => {
        if (out.type === 'ready' || res.writableEnded || res.destroyed) return;
        res.write(`${encode(out)}\n`);
        if (last.includes(out.type)) res.end();
      },
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener)
    };
    createRunner(page, opts.host, opts.gateway.bearer);
    // The gateway is the server's to choose, never the page's.
    const event = new MessageEvent('message', {
      data: { ...message, host }
    });
    for (const listener of listeners) listener(event);
  };
}

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

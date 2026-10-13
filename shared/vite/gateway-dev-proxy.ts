// Local development only: the dev server forwards /gateway/* to the gateway with the key from .env, so the key never reaches the browser.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import type { Plugin } from 'vite';

export const GATEWAY_PATH = '/gateway';

const DROP_REQUEST = new Set([
  'host',
  'authorization',
  'cookie',
  'origin',
  'referer',
  'connection',
  'content-length',
  'accept-encoding'
]);
const DROP_RESPONSE = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie'
]);

interface ProxyOptions {
  upstream: string;
  apiKey: string;
  /** What a request gets while `.env` has no key. Default 503, which the page reports; a route that charges exports answers 401, so an export is refused rather than let through as in an outage. */
  noKeyStatus?: number;
}

export function gatewayProxyHandler(
  opts: ProxyOptions
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void forward(req, res, opts).catch((error: unknown) => {
      if (!res.headersSent)
        res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`gateway dev proxy: ${String(error)}`);
    });
  };
}

async function forward(
  req: IncomingMessage,
  res: ServerResponse,
  { upstream, apiKey, noKeyStatus = 503 }: ProxyOptions
): Promise<void> {
  if (apiKey === '') {
    res.writeHead(noKeyStatus, {
      'content-type': 'text/plain',
      'x-gateway-dev-proxy': 'no-key'
    });
    res.end(
      'dev proxy: set IMGLY_GATEWAY_API_KEY in the demo .env and restart the dev server.'
    );
    return;
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || DROP_REQUEST.has(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('authorization', `Bearer ${apiKey}`);

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const response = await fetch(`${upstream}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined
  });

  const out: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (!DROP_RESPONSE.has(name)) out[name] = value;
  });
  res.writeHead(response.status, out);
  if (response.body === null) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body as WebReadableStream).pipe(res);
}

/** A Vite plugin whose proxy exists only in `vite` (dev); `vite build` and `vite preview` never call `configureServer`. */
export function gatewayDevProxy(opts: {
  upstream: string;
  apiKey: string;
}): Plugin {
  return {
    name: 'imgly-gateway-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        GATEWAY_PATH,
        gatewayProxyHandler({ upstream: opts.upstream, apiKey: opts.apiKey })
      );
    }
  };
}

// The runner's half of the token requests: every model and gateway request asks the page for a token.

import type { TokenRequest, TokenResponse } from '../protocol.js';

/** Any runner's page: it takes token requests, and its messages include the responses. */
export interface TokenEndpoint {
  postMessage(message: TokenRequest): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<{ type: string } | TokenResponse>) => void
  ): void;
}

const isTokenResponse = (data: unknown): data is TokenResponse =>
  (data as { type?: unknown } | undefined)?.type === 'token.response';

export interface TokenClient {
  token(): Promise<string>;
}

export function createTokenClient(
  page: TokenEndpoint,
  opts: { timeoutMs?: number } = {}
): TokenClient {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const pending = new Map<
    string,
    { resolve: (token: string) => void; reject: (error: Error) => void }
  >();
  let next = 0;

  page.addEventListener('message', (event) => {
    const data = event.data;
    if (!isTokenResponse(data)) return;
    const waiter = pending.get(data.id);
    if (waiter === undefined) return;
    pending.delete(data.id);
    if (typeof data.token === 'string' && data.token !== '') {
      waiter.resolve(data.token);
    } else {
      waiter.reject(new Error(data.error ?? 'the page sent no token'));
    }
  });

  return {
    token() {
      const id = `t${(next += 1)}`;
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`no token from the page within ${timeoutMs} ms`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (token) => {
            clearTimeout(timer);
            resolve(token);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          }
        });
        page.postMessage({ type: 'token.request', id });
      });
    }
  };
}

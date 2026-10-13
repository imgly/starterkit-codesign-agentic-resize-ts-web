// Answers the token requests of a runner the page started, one fresh token per request.

import type { TokenRequest, TokenResponse } from '../protocol.js';

/**
 * A short-lived bearer, as CE.SDK's `ly.img.ai.getToken` action returns one: asked before each request, a string,
 * and a throw when there is none. Never a raw API key.
 */
export type GetToken = () => Promise<string>;

function isTokenRequest(data: unknown): data is TokenRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'token.request' &&
    typeof (data as { id?: unknown }).id === 'string'
  );
}

/** A token `getToken` returned, checked as CE.SDK's gateway provider checks its token action's. */
export async function checkedToken(getToken: GetToken): Promise<string> {
  const token = await getToken();
  if (token.startsWith('sk_')) {
    throw new Error(
      'getToken returned a raw API key. Exposing API keys in client-side code is a security risk; return a short-lived token from your backend.'
    );
  }
  if (token === '') throw new Error('getToken returned an empty token');
  return token;
}

/** A runner the page started: it takes token responses, and its messages include the requests. */
export interface TokenRequestsWorker {
  postMessage(message: TokenResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<{ type: string } | TokenRequest>) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<{ type: string } | TokenRequest>) => void
  ): void;
}

/** Listens on `worker` only, so a token never reaches anything the page did not start. Returns a disposer. */
export function answerTokenRequests(
  worker: TokenRequestsWorker,
  getToken: GetToken
): () => void {
  const onMessage = async (
    event: MessageEvent<{ type: string } | TokenRequest>
  ) => {
    const data: unknown = event.data;
    if (!isTokenRequest(data)) return;
    const { id } = data;
    try {
      const token = await checkedToken(getToken);
      worker.postMessage({ type: 'token.response', id, token });
    } catch (error) {
      worker.postMessage({
        type: 'token.response',
        id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
  worker.addEventListener('message', onMessage);
  return () => worker.removeEventListener('message', onMessage);
}

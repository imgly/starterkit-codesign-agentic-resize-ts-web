// How the page reaches IMG.LY's services, and as whom. Plug in your own sign-in here.

import { gatewayProxyURL, meteringProxyURL, PROXY_BEARER } from '../config.js';
import type { GetToken } from './token-requests.js';

export interface GatewaySession {
  /** Where the agent's model calls and generated images go. */
  gatewayBaseURL: string;
  /** The route to IMG.LY's Metering, for a hosting that charges exports through the page's session. */
  meteringBaseURL: string;
  /** The bearer for those calls and for a runner server. */
  getToken: GetToken;
  /** What the page says when the gateway answers that the credits are used up. */
  outOfCredits?: { text: string; link?: { href: string; text: string } };
}

export interface SessionPage {
  notice(text: string, kind?: 'info' | 'error'): void;
  /** How the page reaches the gateway, for developers (`?debug`). */
  mode(text: string): void;
}

/**
 * This origin's `/gateway` and `/metering` routes add the CoDesign licence key to each request: the dev server's, with
 * the key in `.env`, and in production your backend's, behind your own sign-in. To send your users' tokens instead,
 * return them from `getToken`. Resolves once someone may use the page; undefined when nobody may.
 */
export async function startSession(
  page: SessionPage
): Promise<GatewaySession | undefined> {
  const origin = location.origin;
  page.mode(
    `${gatewayProxyURL(origin)} and ${meteringProxyURL(origin)} add the key`
  );
  return {
    gatewayBaseURL: gatewayProxyURL(origin),
    meteringBaseURL: meteringProxyURL(origin),
    getToken: async () => PROXY_BEARER
  };
}

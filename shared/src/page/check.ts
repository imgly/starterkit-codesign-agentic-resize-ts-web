// Tells missing from invalid gateway credentials before the first turn, and says so on the page.

import { probeGateway } from './probe.js';
import type { GatewaySession, SessionPage } from './session.js';

export function checkGateway(session: GatewaySession, page: SessionPage): void {
  void session.getToken().then(
    async (token) => {
      const probe = await probeGateway(session.gatewayBaseURL, token);
      if (probe.status === 'missing') {
        page.notice(
          import.meta.env.DEV
            ? `No gateway key: set IMGLY_GATEWAY_API_KEY in .env to your CoDesign license key and restart the dev server. Contact sales (https://img.ly/forms/contact-sales/) to get a CoDesign license key.`
            : 'The gateway route has no key.',
          'error'
        );
      } else if (probe.status === 'invalid') {
        page.notice('The gateway did not accept these credentials.', 'error');
      } else if (probe.status === 'unreachable') {
        page.notice(`The gateway is unreachable: ${probe.message}`, 'error');
      }
    },
    (error: unknown) =>
      page.notice(
        error instanceof Error ? error.message : String(error),
        'error'
      )
  );
}

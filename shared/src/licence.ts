// The page's CE.SDK licence: the key in `VITE_CESDK_LICENSE`, or, when `VITE_BILLING_PROXY_URL` is set, a short-lived
// grant for the signed-in visitor from that service, so no licence key is in this build.

const PROXY = (import.meta.env.VITE_BILLING_PROXY_URL ?? '').replace(
  /\/+$/,
  ''
);

/** The service that hands this build its grants, or undefined. */
export const billingProxyURL = (): string | undefined =>
  PROXY === '' ? undefined : PROXY;

/** A grant is reused until five minutes before it expires; an engine checks it only when it starts. */
const MARGIN_MS = 5 * 60_000;

/** What the editor takes as `license`; `bearer` is the visitor's sign-in token. */
export function licenceFor(
  bearer: () => Promise<string | undefined>
): () => Promise<string> {
  const proxy = billingProxyURL();
  if (proxy === undefined) {
    return async () => import.meta.env.VITE_CESDK_LICENSE ?? '';
  }
  let grant: { license: string; expiresAt: number } | undefined;
  let asking: Promise<string> | undefined;
  const ask = async (): Promise<string> => {
    const token = await bearer();
    if (token === undefined) throw new Error('sign in to start the engine');
    const answer = await fetch(`${proxy}/grant`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    });
    if (!answer.ok) {
      throw new Error(`the grant service answered ${answer.status}`);
    }
    grant = (await answer.json()) as { license: string; expiresAt: number };
    return grant.license;
  };
  return () => {
    if (grant !== undefined && grant.expiresAt - Date.now() >= MARGIN_MS) {
      return Promise.resolve(grant.license);
    }
    // The executor and the editor may start together: one request serves both.
    asking ??= ask().finally(() => (asking = undefined));
    return asking;
  };
}

/** Whether this build has a licence at all: a key, or a service that hands out grants. */
export const hasLicence = (): boolean =>
  billingProxyURL() !== undefined ||
  (import.meta.env.VITE_CESDK_LICENSE ?? '') !== '';

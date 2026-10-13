// Yours to replace: who is calling the runner. Here, a JWT from a sign-in you configure names the user (identity only,
// nobody's credits), or, for local development, every request is one fixed user.
import type { IncomingMessage } from 'node:http';

import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey
} from 'jose';

export type Authenticate = (
  req: IncomingMessage
) => Promise<string | undefined>;

/**
 * `issuers`: who may sign the token. `origins`: the pages that may ask for one, checked against an `azp` claim when
 * the token has one. Its keys are at `jwksURL`, default `<issuer>/.well-known/jwks.json`; `audience`, when set, must be
 * its `aud`; it comes in `header`, default `Authorization: Bearer`.
 */
export function jwtUsers(opts: {
  issuers: readonly string[];
  origins: readonly string[];
  jwksURL?: string;
  audience?: string;
  header?: string;
}): Authenticate {
  const issuers = opts.issuers.map((i) => i.replace(/\/+$/, ''));
  const header = opts.header?.toLowerCase();
  const keys = new Map<string, JWTVerifyGetKey>();
  return async (req) => {
    const token =
      header === undefined
        ? /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
        : (req.headers[header] as string | undefined);
    if (token === undefined || token === '') return undefined;
    let issuer: string;
    try {
      // Unverified, only to pick which issuer's keys to verify it against.
      issuer = String(decodeJwt(token).iss);
    } catch {
      return undefined;
    }
    if (!issuers.includes(issuer)) return undefined;
    let jwks = keys.get(issuer);
    if (jwks === undefined) {
      jwks = createRemoteJWKSet(
        new URL(opts.jwksURL ?? `${issuer}/.well-known/jwks.json`)
      );
      keys.set(issuer, jwks);
    }
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        algorithms: ['RS256'],
        ...(opts.audience !== undefined ? { audience: opts.audience } : {})
      });
      // A token that names the page it was asked for must name one of this product's.
      if (
        typeof payload.azp === 'string' &&
        !opts.origins.includes(payload.azp)
      ) {
        return undefined;
      }
      return typeof payload.sub === 'string' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  };
}

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

/** The runner's check from its environment: `TOKEN_ISSUERS` (and the optional rest), or `RUNNER_DEV_USER` on a loopback host. */
export function runnerAuth(env: {
  TOKEN_ISSUERS?: string;
  JWKS_URL?: string;
  TOKEN_AUDIENCE?: string;
  TOKEN_HEADER?: string;
  ALLOWED_ORIGINS?: string;
  RUNNER_DEV_USER?: string;
  RUNNER_HOST?: string;
}): Authenticate {
  const issuers = list(env.TOKEN_ISSUERS);
  const devUser = env.RUNNER_DEV_USER?.trim() || undefined;
  if (issuers.length > 0 && devUser !== undefined) {
    throw new Error('Set TOKEN_ISSUERS or RUNNER_DEV_USER, not both.');
  }
  if (devUser !== undefined) {
    if (!LOOPBACK.has(env.RUNNER_HOST ?? '127.0.0.1')) {
      throw new Error(
        'RUNNER_DEV_USER signs every request in: the runner must listen on a loopback RUNNER_HOST.'
      );
    }
    return async () => devUser;
  }
  if (issuers.length === 0) {
    throw new Error(
      'The runner needs TOKEN_ISSUERS or RUNNER_DEV_USER to know who calls it.'
    );
  }
  return jwtUsers({
    issuers,
    origins: list(env.ALLOWED_ORIGINS),
    ...(env.JWKS_URL ? { jwksURL: env.JWKS_URL } : {}),
    ...(env.TOKEN_AUDIENCE ? { audience: env.TOKEN_AUDIENCE } : {}),
    ...(env.TOKEN_HEADER ? { header: env.TOKEN_HEADER } : {})
  });
}

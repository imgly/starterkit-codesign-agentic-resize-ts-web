// The cloud hosting's `acquire`: a pool of executors you started, each serving one conversation, then free again.

import type {
  AcquiredExecutor,
  RemoteExecutorsOptions
} from '@imgly/codesign-sdk';

export interface ExecutorPoolOptions {
  /** How long a new conversation waits for a free executor. Default 60 s. */
  waitMs?: number;
  /** How often it asks them meanwhile. Default 1 s. */
  pollMs?: number;
  fetch?: typeof globalThis.fetch;
}

/**
 * `remoteExecutors`'s `acquire` over executors at `urls`. A conversation keeps the executor it was given; a new one
 * claims an executor whose `/health` reports `bound: false`, one no conversation of this pool holds first. An
 * executor serves one conversation, exits after it and, restarted on a clean filesystem, is free again. Throws in
 * words when none came free within `waitMs`.
 */
export function executorPool(
  urls: readonly string[],
  opts: ExecutorPoolOptions = {}
): RemoteExecutorsOptions['acquire'] {
  const { waitMs = 60_000, pollMs = 1_000 } = opts;
  const fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const held = new Map<string, string>();
  const free = async (url: string, signal?: AbortSignal) => {
    try {
      const response = await fetch(`${url}/health`, {
        cache: 'no-store',
        ...(signal !== undefined ? { signal } : {})
      });
      const { result } = (await response.json()) as {
        result?: { bound?: boolean; accepting?: boolean };
      };
      return result?.bound === false && result.accepting !== false;
    } catch {
      signal?.throwIfAborted();
      return false;
    }
  };
  // One claim at a time, so two conversations never claim the same free executor.
  let claims: Promise<unknown> = Promise.resolve();
  const claim = async (
    conversation: string,
    signal?: AbortSignal
  ): Promise<AcquiredExecutor> => {
    const until = Date.now() + waitMs;
    for (;;) {
      const holding = new Set(held.values());
      const order = [
        ...urls.filter((u) => !holding.has(u)),
        ...urls.filter((u) => holding.has(u))
      ];
      for (const url of order) {
        if (!(await free(url, signal))) continue;
        for (const [other, at] of held) if (at === url) held.delete(other);
        held.set(conversation, url);
        return { url };
      }
      if (Date.now() + pollMs > until) {
        throw new Error(
          `all ${urls.length} executors serve another conversation: one is free again about 3½ minutes after its conversation's last call, or start more`
        );
      }
      signal?.throwIfAborted();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, pollMs);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true }
        );
      });
    }
  };
  return ({ conversation, signal }) => {
    signal?.throwIfAborted();
    if (urls.length === 0) {
      throw new Error(
        'no executor URLs: list your executors (see src/hosting/cloud/.env.template)'
      );
    }
    const url = held.get(conversation);
    if (url !== undefined) return { url };
    const next = claims.then(() => {
      const now = held.get(conversation);
      return now !== undefined ? { url: now } : claim(conversation, signal);
    });
    claims = next.catch(() => undefined);
    return next;
  };
}

// The model: an OpenAI chat-completions route on IMG.LY's AI gateway, paid with the bearer the hosting gives it.

import type { Model } from '@earendil-works/pi-ai';

export const DEFAULT_MODEL_ID = '@openrouter/anthropic/claude-haiku-5.5';

type Cost = Model<'openai-completions'>['cost'];

/** The models the picker offers. List prices per million tokens before the gateway's markup, for the cost cap. */
export const MODEL_CHOICES: ReadonlyArray<{
  id: string;
  label: string;
  cost: Cost;
}> = [
  {
    id: '@openrouter/anthropic/claude-haiku-5.5',
    label: 'Claude Haiku 5.5',
    cost: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }
  },
  {
    id: '@openrouter/anthropic/claude-sonnet-5.5',
    label: 'Claude Sonnet 5.5',
    cost: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 }
  },
  {
    id: '@openrouter/anthropic/claude-opus-5.5',
    label: 'Claude Opus 5.5',
    cost: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }
  }
];

const UNPRICED: Cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function gatewayModel(
  gatewayBaseURL: string,
  id: string
): Model<'openai-completions'> {
  const choice = MODEL_CHOICES.find((c) => c.id === id);
  return {
    id,
    name: choice?.label ?? id,
    api: 'openai-completions',
    provider: 'imgly-gateway',
    baseUrl: `${gatewayBaseURL}/v1`,
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 1_000_000,
    maxTokens: 64_000,
    cost: choice?.cost ?? UNPRICED,
    compat: {
      supportsDeveloperRole: false,
      thinkingFormat: 'openrouter',
      // pi adds Anthropic cache_control by itself only for provider "openrouter"; without it Claude runs uncached.
      ...(id.includes('anthropic/')
        ? { cacheControlFormat: 'anthropic' as const }
        : {})
    }
  };
}

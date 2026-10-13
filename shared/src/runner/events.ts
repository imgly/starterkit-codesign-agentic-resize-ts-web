// pi's agent events → what the chat shows.

import type { AssistantMessage, StopReason } from '@earendil-works/pi-ai';

import type { AgentEvent } from '../protocol.js';

const MAX_TEXT = 4_000;

type Part =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: string };

export function toolResultEvents(
  tool: string,
  result: { content?: readonly Part[] } | undefined,
  isError: boolean
): AgentEvent[] {
  const parts = result?.content ?? [];
  const text = parts
    .flatMap((part) =>
      part.type === 'text' ? [(part as { text: string }).text] : []
    )
    .join('\n')
    .trim()
    .slice(0, MAX_TEXT);
  const events: AgentEvent[] = [{ type: 'tool_result', tool, text, isError }];
  for (const part of parts) {
    if (part.type !== 'image') continue;
    const image = part as { data: string; mimeType: string };
    events.push({
      type: 'preview',
      tool,
      uri: `data:${image.mimeType};base64,${image.data}`
    });
  }
  return events;
}

export function assistantEvents(message: {
  role: 'assistant';
  content: AssistantMessage['content'];
  stopReason?: StopReason;
  errorMessage?: string;
}): AgentEvent[] {
  const events: AgentEvent[] = [];
  const thinking = message.content
    .flatMap((part) =>
      part.type === 'thinking' && part.redacted !== true ? [part.thinking] : []
    )
    .join('\n')
    .trim();
  if (thinking !== '') events.push({ type: 'thinking', text: thinking });
  const text = message.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
    .trim();
  if (text !== '') events.push({ type: 'message', text });
  if (message.stopReason === 'error') {
    events.push({
      type: 'error',
      message: message.errorMessage ?? 'the model request failed'
    });
  }
  return events;
}

type SavedMessage =
  | { role: 'user'; content: string | ReadonlyArray<Part> }
  | {
      role: 'assistant';
      content: ReadonlyArray<
        | { type: 'text'; text: string }
        | { type: 'thinking'; thinking: string; redacted?: boolean }
        | { type: 'toolCall'; name: string; arguments: unknown }
      >;
    }
  | {
      role: 'toolResult';
      toolName: string;
      isError: boolean;
      content: ReadonlyArray<Part>;
    }
  | { role: string };

/** A saved conversation, as the chat showed it while it happened. */
export function historyEvents(messages: readonly unknown[]): AgentEvent[] {
  return (messages as SavedMessage[]).flatMap((message): AgentEvent[] => {
    if (message.role === 'user' && 'content' in message) {
      const { content } = message as { content: string | Part[] };
      const text =
        typeof content === 'string'
          ? content
          : content
              .flatMap((p) =>
                p.type === 'text' ? [(p as { text: string }).text] : []
              )
              .join('');
      return [{ type: 'user', text }];
    }
    if (message.role === 'assistant' && 'content' in message) {
      const { content } = message as Extract<
        SavedMessage,
        { role: 'assistant' }
      >;
      const calls: AgentEvent[] = content.flatMap((part) =>
        part.type === 'toolCall'
          ? [
              {
                type: 'tool_call' as const,
                tool: part.name,
                args: part.arguments
              }
            ]
          : []
      );
      return [
        ...assistantEvents({
          role: 'assistant',
          content: content.filter(
            (p) => p.type !== 'toolCall'
          ) as AssistantMessage['content']
        }),
        ...calls
      ];
    }
    if (message.role === 'toolResult' && 'toolName' in message) {
      const result = message as Extract<SavedMessage, { role: 'toolResult' }>;
      return toolResultEvents(result.toolName, result, result.isError);
    }
    return [];
  });
}

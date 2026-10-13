// The chat's agent loop on pi, in the runner: one Agent per chat, a cost cap per turn, a repeated-failure breaker.

import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type AgentToolResult,
  type ThinkingLevel
} from '@earendil-works/pi-agent-core';
import type {
  AssistantMessage,
  ImageContent,
  Message,
  Model,
  TextContent
} from '@earendil-works/pi-ai';
import { streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { isCoDesignError, type CoDesignTool } from '@imgly/codesign-sdk';

import type { AgentEvent, TurnReport } from '../protocol.js';
import { assistantEvents, toolResultEvents } from './events.js';
import { gatewayModel } from './model.js';
import { RepeatedErrorGuard } from './repeated-error-guard.js';

export const DEFAULT_MAX_COST_USD = 2;

const SYSTEM_PROMPT = [
  'You are the design assistant in a demo. Your tools edit one design, held by a',
  'real design engine.',
  '',
  'When you are done, describe in one or two sentences what you made.'
].join('\n');

export interface DesignAgentOptions {
  tools: readonly CoDesignTool[];
  /** The agent's role, ahead of `instructions`; default: the chat demo's design assistant. */
  systemPrompt?: string;
  /** The SDK's `instructions`, appended to the system prompt. */
  instructions: string;
  gatewayBaseURL: string;
  model: string;
  /** The bearer for each model request: the session's token (`startSession`). */
  getApiKey: () => Promise<string>;
  onEvent: (event: AgentEvent) => void;
  thinkingLevel?: ThinkingLevel;
  maxCostUsd?: number;
  /** A saved conversation to continue, as `messages()` returned it. */
  messages?: readonly unknown[];
}

export interface DesignAgent {
  /** `model`: switch to this gateway model id from this turn on. */
  prompt(text: string, model?: string): Promise<TurnReport>;
  abort(): void;
  /** The conversation so far, to save and continue later. */
  messages(): readonly unknown[];
}

export function createDesignAgent(opts: DesignAgentOptions): DesignAgent {
  const maxCostUsd = opts.maxCostUsd ?? DEFAULT_MAX_COST_USD;
  const emit = opts.onEvent;
  let tokenError: string | undefined;
  // An error the SDK hands the product rather than the model (no credits left): the turn ends with it.
  let productError: string | undefined;

  const agent = new Agent({
    initialState: {
      systemPrompt: [opts.systemPrompt ?? SYSTEM_PROMPT, opts.instructions]
        .filter((part) => part !== '')
        .join('\n\n'),
      model: gatewayModel(opts.gatewayBaseURL, opts.model),
      thinkingLevel: opts.thinkingLevel ?? 'medium',
      tools: opts.tools.map((tool) =>
        bridgeTool(tool, (error) => {
          productError ??= error.message;
          agent.abort();
        })
      ),
      // Today's system prompt and tools, not the ones the conversation was saved with.
      messages: ((opts.messages ?? []) as AgentMessage[]).filter(
        (m) => m.role !== 'system'
      )
    },
    convertToLlm: toLlmMessages,
    // `streamSimple`, not `stream`: with `stream` the thinking level is silently dropped.
    streamFn: (model, context, options) =>
      streamSimple(model as Model<'openai-completions'>, context, options),
    getApiKey: async () => {
      try {
        return await opts.getApiKey();
      } catch (error) {
        tokenError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }
  });

  let turn: {
    guard: RepeatedErrorGuard;
    startUsd: number;
    capped: boolean;
    toolCalls: number;
  };

  agent.subscribe((event) => {
    if (event.type === 'message_end' && event.message.role === 'assistant') {
      for (const e of assistantEvents(event.message)) {
        if (e.type !== 'error') emit(e);
      }
    }
    if (event.type === 'tool_execution_start') {
      emit({ type: 'tool_call', tool: event.toolName, args: event.args });
    }
    if (event.type === 'tool_execution_end') {
      turn.toolCalls += 1;
      const result = event.result as AgentToolResult<unknown> | undefined;
      const events = toolResultEvents(event.toolName, result, event.isError);
      for (const e of events) emit(e);
      const [summary] = events;
      if (
        summary.type === 'tool_result' &&
        turn.guard.record(event.toolName, event.isError, summary.text)
      ) {
        agent.abort();
      }
    }
    if (event.type === 'turn_end') {
      const usd = totalCost(agent.state.messages);
      emit({ type: 'cost', usd });
      if (!turn.capped && usd - turn.startUsd >= maxCostUsd) {
        turn.capped = true;
        agent.abort();
      }
    }
  });

  return {
    async prompt(text, model) {
      if (model !== undefined) {
        agent.state.model = gatewayModel(opts.gatewayBaseURL, model);
      }
      turn = {
        guard: new RepeatedErrorGuard(),
        startUsd: totalCost(agent.state.messages),
        capped: false,
        toolCalls: 0
      };
      tokenError = undefined;
      productError = undefined;
      try {
        await agent.prompt(text);
      } catch (error) {
        tokenError ??= error instanceof Error ? error.message : String(error);
      }
      const messages = agent.state.messages;
      const costUsd = totalCost(messages) - turn.startUsd;
      const last = lastAssistant(messages);
      const failed =
        last?.stopReason === 'error' || last?.stopReason === 'aborted';
      const error =
        productError ??
        turn.guard.reason ??
        (turn.capped
          ? `cost cap of $${maxCostUsd} per turn reached ($${costUsd.toFixed(4)} at list price)`
          : (tokenError ??
            (failed
              ? (last?.errorMessage ?? 'the agent run did not finish')
              : undefined)));
      const report: TurnReport = {
        text: failed ? '' : assistantText(last),
        toolCalls: turn.toolCalls,
        costUsd,
        ...(error !== undefined ? { error } : {})
      };
      if (error !== undefined) emit({ type: 'error', message: error });
      return report;
    },
    abort: () => agent.abort(),
    messages: () => agent.state.messages
  };
}

/** A design tool as pi's tool: a failed call throws, so pi marks it an error; images pass through. */
function bridgeTool(
  tool: CoDesignTool,
  onProductError: (error: Error) => void
): AgentTool {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description ?? '',
    parameters: tool.inputSchema as AgentTool['parameters'],
    execute: async (_toolCallId, params, signal) => {
      const result = await tool.call(params ?? {}, { signal }).catch((err) => {
        if (isCoDesignError(err) && err.kind === 'generation_refused') {
          onProductError(err);
        }
        throw err;
      });
      const content: Array<TextContent | ImageContent> = result.content;
      if (result.isError === true) {
        throw new Error(
          content
            .flatMap((part) => (part.type === 'text' ? [part.text] : []))
            .join('\n')
            .trim() || `tool "${tool.name}" returned an error`
        );
      }
      return { content, details: { tool: tool.name } };
    }
  };
}

// pi 0.87 sends the system prompt and tools as a leading `system` message: dropping it sends neither.
function toLlmMessages(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message): message is Message =>
      message.role === 'system' ||
      message.role === 'user' ||
      message.role === 'assistant' ||
      message.role === 'toolResult'
  );
}

function lastAssistant(messages: AgentMessage[]): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'assistant') return message;
  }
  return undefined;
}

function assistantText(message: AssistantMessage | undefined): string {
  return (message?.content ?? [])
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
    .trim();
}

function totalCost(messages: AgentMessage[]): number {
  let total = 0;
  for (const message of messages) {
    if (message.role === 'assistant') total += message.usage.cost.total;
  }
  return total;
}

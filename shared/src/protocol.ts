// The messages both demos' pages and runners share: what an agent turn shows, and the token requests.

/** What a page shows of an agent turn, as it happens or when a saved conversation is replayed. */
export type AgentEvent =
  | { type: 'user'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: string; args: unknown }
  | { type: 'tool_result'; tool: string; text: string; isError: boolean }
  /** `uri`: a `data:` uri of the image, or a link where the runner's hosting kept it. */
  | { type: 'preview'; tool: string; uri: string }
  | { type: 'cost'; usd: number }
  | { type: 'message'; text: string }
  | { type: 'error'; message: string };

export interface TurnReport {
  text: string;
  toolCalls: number;
  costUsd: number;
  error?: string;
}

/** A runner asks its page for a short-lived bearer for the gateway, a fresh one each time. */
export interface TokenRequest {
  type: 'token.request';
  id: string;
}

export interface TokenResponse {
  type: 'token.response';
  id: string;
  token?: string;
  error?: string;
}

/** The `postMessage` side of a runner the bridges use. */
export interface MessageEndpoint<Out, In> {
  postMessage(message: Out, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<In>) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<In>) => void
  ): void;
}

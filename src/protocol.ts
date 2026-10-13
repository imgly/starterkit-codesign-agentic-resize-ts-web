// The messages between the Agentic Resize page and its runner.

import type { Executors } from '@imgly/codesign-sdk';
import type {
  GatewaySession,
  SessionPage
} from '../shared/src/page/session.js';
import type {
  AgentEvent,
  MessageEndpoint,
  TokenRequest,
  TokenResponse
} from '../shared/src/protocol.js';
import type {
  ResizeResult,
  ResizedDesign,
  ResizeSource,
  TargetFormat
} from './runner/resize.js';

export type { ResizeResult, ResizedDesign, ResizeSource, TargetFormat };

export interface HostSettings {
  /** The gateway the agent calls. */
  gatewayBaseURL: string;
  /** Where an executor charges each export, where the hosting asks the page. */
  meteringBaseURL: string;
}

export interface ResizeRun {
  type: 'resize';
  run: string;
  source: ResizeSource;
  formats: TargetFormat[];
  /** A gateway model id; default `DEFAULT_MODEL_ID`. */
  model?: string;
  host: HostSettings;
}

/** Where a format is: its design opens, the agent re-composes it, its files are kept. */
export type ResizeStage = 'opening' | 'agent' | 'saving';

/** A render of a source or a saved `.imgly`, on an executor of its own. */
export interface RenderRequest {
  type: 'render';
  id: string;
  source: ResizeSource;
  host: HostSettings;
}

export interface PageSize {
  width: number;
  height: number;
  /** CE.SDK's design unit: `Pixel`, `Millimeter` or `Inch`. */
  unit: string;
}

export type PageToRunner = ResizeRun | RenderRequest | TokenResponse;

export type RunnerToPage =
  | { type: 'ready' }
  | TokenRequest
  /** `index`: the format's place in the run's `formats`. */
  | { type: 'stage'; run: string; index: number; stage: ResizeStage }
  | { type: 'event'; run: string; index: number; event: AgentEvent }
  /** A kept `.imgly` or PNG; `key` is its `archiveUrl` or `previewUrl` in the result. */
  | {
      type: 'file';
      run: string;
      index: number;
      key: string;
      kind: 'archive' | 'preview';
      bytes: ArrayBuffer;
    }
  /** A canvas that landed or failed, as `done` will list it again. */
  | { type: 'design'; run: string; index: number; design: ResizedDesign }
  | { type: 'done'; run: string; result: ResizeResult }
  | { type: 'failed'; run: string; error: string }
  /** `size`: the design's first page, in its design unit, if it has one; the PNG is a size-capped preview. */
  | { type: 'rendered'; id: string; png: ArrayBuffer; size?: PageSize }
  | { type: 'render.failed'; id: string; error: string };

/** What the page gives its hosting's `connectRunner`: its session, and where to show a notice. */
export interface ConnectRunnerOptions {
  session: GatewaySession;
  page: SessionPage;
}

/** The page's side of its runner. */
export type RunnerEndpoint = MessageEndpoint<PageToRunner, RunnerToPage>;

/** Where a run's designs open; `release` ends what `startExecutors` started. */
export type StartExecutors = (
  settings: HostSettings,
  bearer: () => Promise<string | undefined>
) => { executors: Executors; release(): void };

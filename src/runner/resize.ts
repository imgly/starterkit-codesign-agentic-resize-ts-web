// Agentic Resize: per canvas, load the original design into a new one, let the agent re-compose it, measure, export.

import {
  googleFonts,
  prepareCoDesign,
  type CoDesignTool,
  type CoDesign,
  type Executors
} from '@imgly/codesign-sdk';
import type { TurnReport } from '../../shared/src/protocol.js';

export interface TargetFormat {
  width: number;
  height: number;
  label: string;
}

/** The bundled sample, one of CE.SDK's templates (its scene's URL), or a file the visitor picked. */
export type ResizeSource =
  | { sample: true }
  | { url: string }
  | { file: string; bytes: ArrayBuffer };

/** One agent turn over these tools; `systemPrompt` and `prompt` come from this file, `instructions` from the SDK. */
export type AgentRunner = (opts: {
  tools: readonly CoDesignTool[];
  systemPrompt: string;
  instructions: string;
  prompt: string;
}) => Promise<TurnReport>;

export interface ResizeDeps {
  /** Where the designs' engines run: one sandbox per run, every canvas of it inside. */
  executors: Executors;
  readSample(): Promise<Uint8Array>;
  runAgent: AgentRunner;
  /** Keep a finished `.imgly` or PNG; answers the key the result names it by. */
  keep(bytes: Uint8Array, kind: 'archive' | 'preview'): Promise<string>;
  /** Called as each canvas moves on, for the page's progress. */
  stage?(index: number, stage: 'opening' | 'agent' | 'saving'): void;
  /** Called with each canvas as it lands or fails, before the next one opens. */
  landed?(index: number, design: ResizedDesign): void;
}

export type ResizedDesign = TargetFormat &
  (
    | {
        archiveUrl: string;
        previewUrl: string;
        bytes: number;
        /** The delivered PNG's size in pixels; the page's own numbers are in the design's unit. */
        canvas: { width: number; height: number };
        offTarget: boolean;
        /** What the agent said it did. */
        notes: string;
      }
    | { error: string }
  );

export interface ResizeResult {
  designs: ResizedDesign[];
  /** List price across every agent run, not a bill. */
  costUsd: number;
}

/** A new design whose engine runs on `executors`, in the sandbox `conversation` names. */
export function openDesign(
  executors: Executors,
  conversation: string
): CoDesign {
  return prepareCoDesign({
    conversation,
    executors,
    plugins: [googleFonts()],
    gateway: false
  });
}

export async function readSource(
  source: ResizeSource,
  readSample: () => Promise<Uint8Array>
): Promise<Uint8Array | URL> {
  if ('url' in source) return new URL(source.url);
  if ('file' in source) return new Uint8Array(source.bytes);
  return readSample();
}

export async function resizeDesign(
  deps: ResizeDeps,
  source: ResizeSource,
  formats: readonly TargetFormat[]
): Promise<ResizeResult> {
  const conversation = crypto.randomUUID();
  const designs: ResizedDesign[] = [];
  let costUsd = 0;
  for (const [index, format] of formats.entries()) {
    const stage = (s: 'opening' | 'agent' | 'saving') => deps.stage?.(index, s);
    let codesign: CoDesign | undefined;
    try {
      stage('opening');
      codesign = openDesign(deps.executors, conversation);
      const { version } = await codesign.load(
        await readSource(source, deps.readSample)
      );
      stage('agent');
      const report = await deps.runAgent({
        tools: codesign.tools,
        systemPrompt: SYSTEM_PROMPT,
        instructions: codesign.instructions,
        prompt: resizePrompt(format, version)
      });
      costUsd += report.costUsd;
      if (report.error !== undefined) throw new Error(report.error);
      stage('saving');
      const archive = await codesign.export('imgly');
      const archiveUrl = await deps.keep(archive, 'archive');
      const png = await codesign.export('png');
      const previewUrl = await deps.keep(png, 'preview');
      // PNG's IHDR: width and height, big-endian, at bytes 16 and 20.
      const header = new DataView(png.buffer, png.byteOffset, 24);
      const canvas = {
        width: header.getUint32(16),
        height: header.getUint32(20)
      };
      designs.push({
        ...format,
        archiveUrl,
        previewUrl,
        bytes: archive.byteLength,
        canvas,
        offTarget:
          canvas.width !== format.width || canvas.height !== format.height,
        notes: report.text
      });
    } catch (err) {
      designs.push({
        ...format,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      await codesign?.release().catch(() => undefined);
    }
    deps.landed?.(index, designs[index]);
  }
  return { designs, costUsd };
}

/** The agent's role, ahead of the SDK's `instructions` in its system prompt. */
export const SYSTEM_PROMPT = [
  'You are a design agent operating a CE.SDK design engine through the tools you have been given.',
  '',
  'The design you are working on is ALREADY LOADED: your tools work on it when you name no `design`.',
  "Start by reading the skills that apply: skill({ name: 'handbook' }) is mandatory before your first edit, and skill({ name: 'resize' }) carries the re-composition rules for this job.",
  'Use preview() to look at what you have done — you are judged on the rendered result, not on the code.',
  'Work until the layout is genuinely re-composed for the new canvas, then stop and describe in one or two sentences what you changed, as plain text: no tables, lists or headings, since a small card shows it as written.'
].join('\n');

/** What the agent is asked to do; the reflow policy lives in the SDK's `resize` skill. */
export function resizePrompt(
  { width, height, label }: TargetFormat,
  version: string
): string {
  return [
    `Resize the design already loaded for you to ${width}×${height} px (the "${label}" format). It is at version ${version}.`,
    '',
    `Read skill({ name: 'resize' }) first — it carries the re-composition rules and the no-goes.`,
    'Re-compose the layout for the new aspect: re-derive margins, type sizes and spacing from the new canvas, keep the design system (palette, type bands, hierarchy, grouping) and the full element inventory, and let every full-bleed background cover the new canvas. Never stretch or squish to force-fit, and never leave a dead void.',
    `Check your work with preview() before you finish.`
  ].join('\n');
}

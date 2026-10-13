// The target canvases a run asks for.

import type { TargetFormat } from '../protocol.js';
import { MAX_SIDE } from './catalog.js';

/** The canvases as picked, each labelled `WxH` when it has no label; throws for a size the engine is not asked for. */
export function readFormats(formats: readonly TargetFormat[]): TargetFormat[] {
  if (formats.length === 0) throw new Error('pick at least one canvas');
  return formats.map(({ width, height, label }) => {
    if (![width, height].every((side) => side >= 1 && side <= MAX_SIDE)) {
      throw new Error(
        `width and height must be numbers between 1 and ${MAX_SIDE}`
      );
    }
    const trimmed = label.trim();
    return {
      width,
      height,
      label: trimmed === '' ? `${width}x${height}` : trimmed
    };
  });
}

/** What a click is about to cost, before it is clicked. */
export function estimate(count: number): string {
  if (count === 0) return 'Pick at least one canvas.';
  const canvases = `${count} ${count === 1 ? 'canvas' : 'canvases'}`;
  return `${canvases} × agent ≈ ${count * 1}–${count * 3} minutes, paid in AI credits`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

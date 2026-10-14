// The results grid: one card per target canvas, from queued to its render and download.

import type { AgentEvent } from '../../shared/src/protocol.js';
import type {
  ResizeResult,
  ResizedDesign,
  ResizeStage,
  TargetFormat
} from '../protocol.js';
import { formatSeconds } from './formats.js';

const STAGE_TEXT: Record<ResizeStage | 'queued', string> = {
  queued: 'waiting',
  opening: 'opening the design',
  agent: 'the agent is re-composing',
  saving: 'saving'
};

interface Card {
  el: HTMLLIElement;
  thumb: HTMLDivElement;
  meta: HTMLSpanElement;
  body: HTMLDivElement;
  format: TargetFormat;
  startedAt?: number;
  toolCalls: number;
  landed?: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== '') node.textContent = text;
  return node;
};

const size = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

// The agent's last message, clamped to a few lines so the cards keep one height; the toggle shows only when it cuts.
function notes(text: string, index: number): HTMLElement[] {
  const note = el('p', 'notes muted small clamped', text);
  note.id = `notes-${index}`;
  const toggle = el('button', 'more', 'Show more');
  toggle.type = 'button';
  toggle.hidden = true;
  toggle.setAttribute('aria-controls', note.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const open = note.classList.toggle('clamped') === false;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Show less' : 'Show more';
  });
  new ResizeObserver(() => {
    if (note.classList.contains('clamped')) {
      const cut = note.scrollHeight > note.clientHeight;
      note.classList.toggle('cut', cut);
      toggle.hidden = !cut;
    }
  }).observe(note);
  return [note, toggle];
}

export function resultsView(
  list: HTMLElement,
  opts: { edit(index: number): void }
) {
  let cards: Card[] = [];

  const showImage = (card: Card, src: string) => {
    const img = el('img');
    img.alt = `${card.format.label}, resized`;
    img.src = src;
    card.thumb.querySelector('img')?.remove();
    card.thumb.prepend(img);
  };
  // Over the card from its job's start until it lands, preview renders included.
  const busy = (card: Card, on: boolean) => {
    card.el.setAttribute('aria-busy', String(on));
    card.thumb.querySelector('.busy')?.remove();
    if (!on) return;
    const overlay = el('div', 'busy');
    overlay.append(
      Object.assign(el('span', 'spinner'), { ariaHidden: 'true' }),
      el('span', 'visually-hidden', 'Resizing…')
    );
    card.thumb.append(overlay);
  };
  const progress = (card: Card, text: string) => {
    const tools = card.toolCalls > 0 ? ` · ${card.toolCalls} tool calls` : '';
    card.meta.textContent = `${card.format.width} × ${card.format.height} · ${text}${tools}`;
  };
  return {
    start(formats: readonly TargetFormat[]): void {
      cards = formats.map((format, index) => {
        const card: Card = {
          el: el('li', 'card result'),
          thumb: el('div', 'thumb'),
          meta: el('span', 'meta'),
          body: el('div', 'body'),
          format,
          toolCalls: 0
        };
        card.el.dataset.index = String(index);
        card.el.dataset.label = format.label;
        card.el.dataset.state = 'queued';
        card.body.append(el('span', 'title', format.label), card.meta);
        card.el.append(card.thumb, card.body);
        progress(card, STAGE_TEXT.queued);
        return card;
      });
      list.replaceChildren(...cards.map((c) => c.el));
    },

    stage(index: number, stage: ResizeStage, now: number): void {
      const card = cards[index];
      if (card === undefined) return;
      if (stage === 'opening') {
        card.startedAt = now;
        busy(card, true);
      }
      card.el.dataset.state = stage;
      progress(card, STAGE_TEXT[stage]);
    },

    event(index: number, event: AgentEvent): void {
      const card = cards[index];
      if (card === undefined) return;
      if (event.type === 'tool_call') {
        card.toolCalls += 1;
        progress(card, STAGE_TEXT.agent);
      }
      if (event.type === 'preview') showImage(card, event.uri);
    },

    preview(index: number, url: string): void {
      const card = cards[index];
      if (card !== undefined) showImage(card, url);
    },

    /** A saved edit: its render, when there is one, and its file. */
    edited(
      index: number,
      edit: { preview?: string; archive: string; bytes: number }
    ): void {
      const card = cards[index];
      if (card === undefined) return;
      card.el.dataset.edits = String(Number(card.el.dataset.edits ?? 0) + 1);
      if (edit.preview !== undefined) showImage(card, edit.preview);
      const download = card.el.querySelector<HTMLAnchorElement>('a.download');
      if (download !== null) download.href = edit.archive;
      // The PNG shows the canvas before the edit; a new one would be charged again.
      card.el.querySelector('a.png')?.remove();
      const sizeText = card.el.querySelector('.size');
      if (sizeText !== null) {
        sizeText.textContent = `${size(edit.bytes)} · .imgly · edited`;
      }
    },

    /** One canvas that landed or failed; `urls`: each kept file's key, as the result names it, to a URL the page can open. */
    land(
      index: number,
      design: ResizedDesign,
      urls: ReadonlyMap<string, string>,
      now: number
    ): void {
      const card = cards[index];
      if (card === undefined || card.landed) return;
      card.landed = true;
      busy(card, false);
      const took =
        card.startedAt !== undefined
          ? ` · ${formatSeconds(now - card.startedAt)}`
          : '';
      if ('error' in design) {
        card.el.dataset.state = 'failed';
        card.thumb.replaceChildren();
        card.meta.textContent = `${design.width} × ${design.height} · failed${took}`;
        card.body.append(el('p', 'error', design.error));
        return;
      }
      card.el.dataset.state = 'done';
      const preview = urls.get(design.previewUrl);
      if (preview !== undefined) showImage(card, preview);
      const { width, height } = design.canvas;
      card.el.dataset.canvas = `${width}x${height}`;
      card.meta.textContent = `${width} × ${height} px${took}`;
      if (design.offTarget) card.meta.append(el('b', 'off', ' · off target'));
      const href = urls.get(design.archiveUrl);
      if (href !== undefined) {
        const actions = el('div', 'actions');
        const download = el('a', 'button download', 'Download');
        download.href = href;
        download.download = `${design.label}.imgly`;
        const edit = el('button', 'edit', 'Edit');
        edit.type = 'button';
        edit.addEventListener('click', () => opts.edit(index));
        actions.append(download);
        // The PNG this canvas was charged for, already in the page.
        if (preview !== undefined) {
          const png = el('a', 'button png', 'PNG');
          png.href = preview;
          png.download = `${design.label}.png`;
          actions.append(png);
        }
        actions.append(
          edit,
          el('span', 'muted small size', `${size(design.bytes)} · .imgly`)
        );
        card.body.append(actions);
      }
      if (design.notes !== '') card.body.append(...notes(design.notes, index));
    },

    /** The run failed as a whole: no canvas still in work keeps its spinner. */
    stopped(): void {
      for (const card of cards) {
        if (card.landed || card.startedAt === undefined) continue;
        card.landed = true;
        busy(card, false);
        card.el.dataset.state = 'failed';
        progress(card, 'failed');
      }
    },

    /** The run's end: any canvas not landed yet, from the result. */
    finish(
      result: ResizeResult,
      urls: ReadonlyMap<string, string>,
      now: number
    ): void {
      result.designs.forEach((design, index) =>
        this.land(index, design, urls, now)
      );
    }
  };
}

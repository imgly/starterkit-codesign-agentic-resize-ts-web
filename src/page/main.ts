// The Agentic Resize page: starts the session as every demo does, sends each job to the runner and shows each canvas as
// it lands.

import { CESDK_VERSION, googleFonts } from '@imgly/codesign-sdk';
import { openEditorModal } from '../../shared/src/editor-modal/index.js';
import {
  editorLicenceFor,
  hasLicence,
  NO_LICENCE
} from '../../shared/src/licence.js';
import {
  startSession,
  type GatewaySession,
  type SessionPage
} from '../../shared/src/page/session.js';
import {
  DEFAULT_MODEL_ID,
  MODEL_CHOICES
} from '../../shared/src/runner/model.js';
import { connectRunner, licenceStartsExecutors } from '../hosting.js';
import type {
  HostSettings,
  ResizeResult,
  PageSize,
  PageToRunner,
  ResizeSource,
  RunnerEndpoint,
  RunnerToPage,
  TargetFormat
} from '../protocol.js';
import { loadCatalog, type Preset } from './catalog.js';
import { estimate, formatSeconds, readFormats } from './formats.js';
import { resultsView } from './results.js';
import { DEFAULT_PICKS, SAMPLES, type Sample } from './samples.js';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function notice(text: string, kind: 'info' | 'error' = 'info'): void {
  const el = $('notice');
  el.textContent = text;
  el.classList.toggle('error', kind === 'error');
  el.hidden = false;
}

async function main(): Promise<void> {
  $('mode').hidden = !new URLSearchParams(location.search).has('debug');
  const page = {
    notice,
    mode: (text: string) => ($('mode').textContent = text)
  };
  const session = await startSession(page);
  if (session === undefined) return;
  start(session, page);
}

function start(session: GatewaySession, page: SessionPage): void {
  const { gatewayBaseURL, meteringBaseURL, getToken } = session;
  if (!hasLicence()) {
    // Only the editor needs it where the executors run on servers: the rest of the page works without one.
    if (licenceStartsExecutors) return notice(NO_LICENCE, 'error');
    notice(`The editor is off. ${NO_LICENCE}`);
  }
  let runner: RunnerEndpoint;
  try {
    runner = connectRunner({ session, page });
  } catch (error) {
    notice(error instanceof Error ? error.message : String(error), 'error');
    return;
  }
  const license = editorLicenceFor(getToken);
  $('app').hidden = false;

  const post = (message: PageToRunner, transfer: Transferable[] = []) =>
    runner.postMessage(message, transfer);

  const host: HostSettings = { gatewayBaseURL, meteringBaseURL };
  const status = $('status');
  let urls = new Map<string, string>();
  /** Each kept file's bytes, by its key in the result. */
  let files = new Map<string, ArrayBuffer>();
  let designs: ResizeResult['designs'] = [];
  /** Each edited result's `.imgly` and its version, counted from 1. */
  let edits = new Map<
    number,
    { archive: Uint8Array<ArrayBuffer>; version: number }
  >();
  let running: { run: string; started: number; tick: number } | undefined;

  const renders = new Map<string, (answer: Rendered) => void>();
  /** A render of `source` on an executor of its own. */
  const render = (source: ResizeSource) =>
    new Promise<Rendered>((resolve) => {
      const id = crypto.randomUUID();
      renders.set(id, resolve);
      post(
        { type: 'render', id, source, host },
        'file' in source ? [source.bytes] : []
      );
    });
  const form = setupForm(render);
  const blobURL = (bytes: BlobPart, type: string) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    urls.set(url, url);
    return url;
  };

  const edit = (index: number) => {
    const design = designs[index];
    const kept =
      design === undefined || 'error' in design
        ? undefined
        : files.get(design.archiveUrl);
    if (design === undefined || kept === undefined) return;
    const current = edits.get(index) ?? {
      archive: new Uint8Array(kept),
      version: 1
    };
    void license()
      .then((license) =>
        openEditorModal({
          title: design.label,
          license,
          plugins: [googleFonts()],
          read: async () => ({
            content: { archive: current.archive },
            version: String(current.version),
            cesdkVersion: CESDK_VERSION
          }),
          async write(content, { ifMatch }) {
            if (ifMatch !== String(current.version)) return undefined;
            if (!('archive' in content) || content.archive === undefined) {
              throw new Error('the editor saved no .imgly');
            }
            current.archive = new Uint8Array(content.archive);
            current.version += 1;
            edits.set(index, current);
            const archive = blobURL(current.archive, 'application/zip');
            const bytes = current.archive.byteLength;
            results.edited(index, { archive, bytes });
            void render({
              file: `${design.label}.imgly`,
              bytes: current.archive.slice().buffer
            }).then((answer) => {
              if ('error' in answer) {
                notice(`Could not render the edit: ${answer.error}`, 'error');
                return;
              }
              if (edits.get(index) !== current) return;
              results.edited(index, {
                archive,
                bytes,
                preview: blobURL(answer.png, 'image/png')
              });
            });
            return String(current.version);
          }
        })
      )
      .catch((error: unknown) =>
        notice(
          `The editor could not start: ${error instanceof Error ? error.message : String(error)}`,
          'error'
        )
      );
  };
  const results = resultsView($('out'), { edit });

  runner.addEventListener('message', (event: MessageEvent<RunnerToPage>) => {
    const message = event.data;
    if (message.type === 'rendered' || message.type === 'render.failed') {
      renders.get(message.id)?.(
        message.type === 'rendered'
          ? { png: message.png, size: message.size }
          : { error: message.error }
      );
      renders.delete(message.id);
      return;
    }
    if (running === undefined || !('run' in message)) return;
    if (message.run !== running.run) return;
    switch (message.type) {
      case 'stage':
        results.stage(message.index, message.stage, performance.now());
        return;
      case 'event':
        results.event(message.index, message.event);
        return;
      case 'file': {
        const type =
          message.kind === 'preview' ? 'image/png' : 'application/zip';
        files.set(message.key, message.bytes);
        const url = URL.createObjectURL(new Blob([message.bytes], { type }));
        urls.set(message.key, url);
        if (message.kind === 'preview') results.preview(message.index, url);
        return;
      }
      case 'design':
        designs[message.index] = message.design;
        results.land(message.index, message.design, urls, performance.now());
        return;
      case 'done': {
        const { result } = message;
        designs = result.designs;
        results.finish(result, urls, performance.now());
        const landed = result.designs.filter((d) => !('error' in d)).length;
        status.textContent =
          `${landed}/${result.designs.length} in ${formatSeconds(performance.now() - running.started)}` +
          ` · $${result.costUsd.toFixed(4)} at list price`;
        stop();
        return;
      }
      case 'failed':
        results.stopped();
        status.textContent = '';
        notice(message.error, 'error');
        stop();
        return;
    }
  });

  const stop = () => {
    if (running !== undefined) clearInterval(running.tick);
    running = undefined;
    form.busy(false);
  };

  form.onSubmit(({ source, formats, model }) => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls = new Map();
    files = new Map();
    edits = new Map();
    designs = [];
    $('notice').hidden = true;
    $('empty').hidden = true;
    form.busy(true);
    results.start(formats);
    const started = performance.now();
    const tick = window.setInterval(() => {
      status.textContent = `running… ${Math.round((performance.now() - started) / 1000)} s`;
    }, 1000);
    status.textContent = 'running… 0 s';
    const run = crypto.randomUUID();
    running = { run, started, tick };
    post(
      {
        type: 'resize',
        run,
        source,
        formats,
        model,
        host
      },
      'file' in source ? [source.bytes] : []
    );
  });
}

type Rendered = { png: ArrayBuffer; size?: PageSize } | { error: string };

const UNITS: Record<string, string> = {
  Pixel: 'px',
  Millimeter: 'mm',
  Inch: 'in'
};

interface Submission {
  source: ResizeSource;
  formats: TargetFormat[];
  model: string;
}

function setupForm(render: (source: ResizeSource) => Promise<Rendered>) {
  const fileInput = $<HTMLInputElement>('file');
  const picked = new Map<string, TargetFormat>();
  let source: ResizeSource = { sample: true };
  let shown = 0;
  let busy = false;

  // Resize only a source that rendered: otherwise every canvas fails.
  const update = () => {
    $('estimate').textContent = estimate(picked.size);
    ($('go') as HTMLButtonElement).disabled =
      busy || picked.size === 0 || $('source').dataset.state !== 'ready';
  };

  /** Shows `next` as the design to resize: a bundled sample's thumbnail, else its render; its name and size. */
  const choose = async (next: ResizeSource, name: string, sample?: Sample) => {
    source = next;
    const turn = (shown += 1);
    const figure = $('source');
    figure.dataset.state = 'loading';
    update();
    $('source-stage').replaceChildren(spinner());
    $('source-caption').textContent = name;
    for (const button of document.querySelectorAll<HTMLElement>(
      '#samples [data-sample]'
    )) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.sample === name)
      );
    }
    const img = document.createElement('img');
    img.alt = name;
    let caption = sample && `${name} · ${sample.width} × ${sample.height} px`;
    if (sample !== undefined) {
      img.src = sample.thumb;
    } else {
      // The file's bytes go to the runner with the render; keep a copy for the run.
      const answer = await render(
        'file' in next ? { ...next, bytes: next.bytes.slice(0) } : next
      );
      if (turn !== shown) return;
      if ('error' in answer) {
        figure.dataset.state = 'failed';
        update();
        $('source-stage').replaceChildren();
        $('source-caption').textContent = `${name}: ${answer.error}`;
        notice(`${name} could not be shown: ${answer.error}`, 'error');
        return;
      }
      img.src = URL.createObjectURL(
        new Blob([answer.png], { type: 'image/png' })
      );
      const size = answer.size;
      caption = size
        ? `${name} · ${Math.round(size.width)} × ${Math.round(size.height)} ${UNITS[size.unit] ?? size.unit}`
        : name;
    }
    await img.decode().catch(() => undefined);
    if (turn !== shown) return;
    $('source-stage').replaceChildren(img);
    $('source-caption').textContent = caption ?? name;
    figure.dataset.state = 'ready';
    update();
  };

  const sampleButton = (name: string, thumb?: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sample';
    button.dataset.sample = name;
    button.title = name;
    if (thumb !== undefined) {
      const img = document.createElement('img');
      img.src = thumb;
      img.alt = '';
      button.append(img);
    }
    button.append(
      Object.assign(document.createElement('span'), { textContent: name })
    );
    $('samples').append(button);
    return button;
  };
  // The first sample is the runner's own; the others go to it as files, like an upload.
  for (const [i, sample] of SAMPLES.entries()) {
    const next = async (): Promise<ResizeSource> =>
      i === 0
        ? { sample: true }
        : {
            file: `${sample.label}.imgly`,
            bytes: await (await fetch(sample.url)).arrayBuffer()
          };
    sampleButton(sample.label, sample.thumb).addEventListener(
      'click',
      () => void next().then((source) => choose(source, sample.label, sample))
    );
  }
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file === undefined) return;
    const bytes = await file.arrayBuffer();
    // So picking the same file again is a change too.
    fileInput.value = '';
    await choose({ file: file.name, bytes }, file.name);
  });

  // A label breaks after each slash ("Story/Reels/IGTV") before it breaks inside a word.
  const name = (label: string) => {
    const span = document.createElement('span');
    span.className = 'name';
    label.split('/').forEach((part, i) => {
      if (i > 0) span.append('/', document.createElement('wbr'));
      span.append(part);
    });
    return span;
  };

  const tile = (
    preset: Pick<
      Preset,
      'id' | 'label' | 'format' | 'size' | 'thumb' | 'tooLarge'
    >
  ) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.dataset.preset = preset.id;
    button.title = `${preset.label}, ${preset.format.width} × ${preset.format.height} px`;
    if (preset.tooLarge) {
      button.disabled = true;
      button.title = `${preset.label}: larger than this app resizes (${MAX_SIDE_TEXT})`;
    }
    const toggle = (on: boolean) => {
      button.setAttribute('aria-pressed', String(on));
      if (on) picked.set(preset.id, preset.format);
      else picked.delete(preset.id);
      update();
    };
    button.addEventListener('click', () => toggle(!picked.has(preset.id)));
    const shape = document.createElement('span');
    shape.className = 'shape';
    if (preset.thumb !== '') {
      const img = document.createElement('img');
      img.src = preset.thumb;
      img.alt = '';
      img.loading = 'lazy';
      shape.append(img);
    } else {
      const box = document.createElement('span');
      box.className = 'box';
      box.style.aspectRatio = `${preset.format.width} / ${preset.format.height}`;
      shape.append(box);
    }
    button.append(
      shape,
      name(preset.label),
      Object.assign(document.createElement('span'), {
        className: 'size',
        textContent: preset.size
      })
    );
    toggle(DEFAULT_PICKS.includes(preset.id));
    return { button, toggle };
  };

  const group = (id: string, label: string) => {
    const section = document.createElement('section');
    section.className = 'group';
    section.dataset.group = id;
    const tiles = document.createElement('div');
    tiles.className = 'tiles';
    section.append(
      Object.assign(document.createElement('h4'), { textContent: label }),
      tiles
    );
    return { section, tiles };
  };

  let custom: ReturnType<typeof group> | undefined;
  $('custom-add').addEventListener('click', () => {
    const width = Number(($('custom-w') as HTMLInputElement).value);
    const height = Number(($('custom-h') as HTMLInputElement).value);
    try {
      readFormats([{ width, height, label: '' }]);
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    if (custom === undefined) {
      custom = group('custom', 'Custom');
      $('presets').append(custom.section);
    }
    const label = `${width}×${height}`;
    const id = `custom.${label}`;
    if (picked.has(id)) return;
    const { button, toggle } = tile({
      id,
      label,
      format: { label, width, height },
      size: `${width} × ${height} px`,
      thumb: '',
      tooLarge: false
    });
    custom.tiles.append(button);
    toggle(true);
  });

  void loadCatalog().then(
    ({ presets }) => {
      const sections = presets.map((g) => {
        const { section, tiles } = group(g.id, g.label);
        tiles.append(...g.presets.map((p) => tile(p).button));
        return section;
      });
      $('presets').replaceChildren(
        ...sections,
        ...(custom ? [custom.section] : [])
      );
    },
    (error: unknown) => {
      $('presets').replaceChildren(
        Object.assign(document.createElement('p'), {
          className: 'error small',
          textContent: `CE.SDK's presets did not load: ${String(error)}`
        })
      );
    }
  );

  const model = $<HTMLSelectElement>('model');
  const initialModel = import.meta.env.VITE_MODEL || DEFAULT_MODEL_ID;
  const choices = MODEL_CHOICES.some((c) => c.id === initialModel)
    ? MODEL_CHOICES
    : [{ id: initialModel, label: initialModel }, ...MODEL_CHOICES];
  for (const choice of choices) model.add(new Option(choice.label, choice.id));
  model.value = initialModel;

  update();
  void choose(source, SAMPLES[0]!.label, SAMPLES[0]);

  return {
    busy(on: boolean) {
      busy = on;
      update();
    },
    onSubmit(handler: (submission: Submission) => void) {
      $('form').addEventListener('submit', (event) => {
        event.preventDefault();
        let formats: TargetFormat[];
        try {
          formats = readFormats([...picked.values()]);
        } catch (error) {
          notice(
            error instanceof Error ? error.message : String(error),
            'error'
          );
          return;
        }
        const run: ResizeSource =
          'file' in source
            ? { ...source, bytes: source.bytes.slice(0) }
            : source;
        handler({ source: run, formats, model: model.value });
      });
    }
  };
}

const MAX_SIDE_TEXT = '8000 px a side';

const spinner = () =>
  Object.assign(document.createElement('span'), { className: 'spinner' });

void main();

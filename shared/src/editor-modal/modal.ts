// CE.SDK's editor in a modal, for one design: a fresh editor per open with the sessions' own plugins, saved
// compare-and-set on the version it opened. Any page of this package opens it; the host says where designs live.

import type CreativeEditorSDK from '@cesdk/cesdk-js';
import type { DesignContent, EnginePluginModule } from '@imgly/codesign-sdk';
import {
  addPluginModules,
  loadDesign,
  saveDesign as contentToSave,
  unloadDesign
} from '@imgly/codesign-sdk/cesdk-utils';

import { ENGINE_BASE_URL } from '../config.js';
import { addEditorAssets, type EditorAssetOptions } from './assets.js';
import './editor-modal.css';

export interface EditorDesign {
  content: DesignContent;
  version: string;
  /** The CE.SDK that saved it; `null`: unknown, nothing to refuse. */
  cesdkVersion: string | null;
}

export interface EditorModalOptions extends EditorAssetOptions {
  /** The design's name: the dialog's accessible name. */
  title: string;
  /** A CE.SDK licence for this origin. */
  license: string;
  /** The plugins the design's sessions send, applied in the same order: their sources' `resolve` shows the host's images. */
  plugins: readonly EnginePluginModule[];
  read(): Promise<EditorDesign>;
  /** Saves only while the design is still at `ifMatch`: the new version, or `undefined` when it moved. */
  write(
    content: DesignContent<ArrayBuffer>,
    opts: { ifMatch: string; cesdkVersion: string }
  ): Promise<string | undefined>;
  /** After each save. */
  onSaved?(version: string): void;
}

export interface EditorModalResult {
  /** The last version this modal saved; `undefined` when it saved none. */
  saved: string | undefined;
}

type Editor = CreativeEditorSDK;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = ''
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

const button = (text: string, className = '') => {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
};

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** Opens the modal; resolves once the person closed it. */
export function openEditorModal(
  opts: EditorModalOptions
): Promise<EditorModalResult> {
  const dialog = el('dialog', 'editor-modal');
  dialog.setAttribute('aria-label', opts.title);
  const status = el('span', 'em-status');
  const choices = el('span', 'em-choices');
  const bar = el('div', 'em-bar');
  bar.append(status, choices);
  bar.hidden = true;
  const canvas = el('div', 'em-canvas');
  dialog.append(canvas, bar);
  document.body.append(dialog);

  /** The modal's state, and a line over the editor while there is something to say. */
  const state = (s: string, text = '') => {
    dialog.dataset.state = s;
    status.textContent = text;
    choices.replaceChildren();
    bar.hidden = text === '';
  };
  /** A question over the editor; each choice clears it. */
  const ask = (text: string, options: Array<[string, () => void]>) => {
    status.textContent = text;
    choices.replaceChildren(
      ...options.map(([label, act], i) => {
        const b = button(label, i === 0 ? 'primary' : '');
        b.addEventListener('click', () => {
          bar.hidden = true;
          act();
        });
        return b;
      })
    );
    bar.hidden = false;
  };

  let editor: Editor | undefined;
  let version: string | undefined;
  let saved: string | undefined;
  let dirty = false;
  let busy = false;
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty) event.preventDefault();
  };
  window.addEventListener('beforeunload', unload);

  let finish: (result: EditorModalResult) => void = () => undefined;
  const closed = new Promise<EditorModalResult>((resolve) => {
    finish = resolve;
  });
  let shutting = false;
  const shut = () => {
    shutting = true;
    window.removeEventListener('beforeunload', unload);
    if (editor !== undefined) unloadDesign(editor.engine);
    editor?.dispose();
    dialog.close();
    dialog.remove();
    finish({ saved });
  };
  const leave = () => {
    if (!dirty) return shut();
    ask('Close without saving your changes?', [
      ['Keep editing', () => undefined],
      ['Discard changes', shut]
    ]);
  };
  // Esc and a click on the backdrop close the modal as the design view does, but ask first while there are changes.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    leave();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) leave();
  });
  // Chrome closes anyway on a repeated Esc it will not let a page cancel: reopen and ask.
  dialog.addEventListener('close', () => {
    if (shutting) return;
    if (!dirty) return shut();
    dialog.showModal();
    leave();
  });

  // Refuses an editor on another CE.SDK than the executor's, and a design a newer one saved: either save would damage it.
  const load = async (cesdk: Editor, design: EditorDesign) => {
    await loadDesign(cesdk.engine, design);
    await cesdk.actions.run('zoom.toPage', { page: 'first', autoFit: true });
    version = design.version;
    dirty = false;
  };

  const write = async (save: {
    content: DesignContent<ArrayBuffer>;
    cesdkVersion: string;
  }) => {
    const next = await opts.write(save.content, {
      ifMatch: version ?? '',
      cesdkVersion: save.cesdkVersion
    });
    if (next === undefined) return false;
    version = next;
    saved = next;
    dirty = false;
    state('saved');
    editor?.ui.showNotification({
      message: 'Saved. The assistant works on this version next.',
      type: 'success'
    });
    opts.onSaved?.(next);
    return true;
  };

  /** CE.SDK's Save button and its Mod+S shortcut run this, as the kit's `saveScene`. */
  const saveDesign = async () => {
    const cesdk = editor;
    if (cesdk === undefined || busy || dialog.dataset.state === 'loading') {
      return;
    }
    busy = true;
    state('saving', 'Saving…');
    try {
      const content = await contentToSave(cesdk.engine);
      if (await write(content)) return;
      state('conflict', 'Not saved');
      ask('The assistant saved this design while you edited it.', [
        [
          'Keep my version',
          () =>
            void (async () => {
              try {
                version = (await opts.read()).version;
                if (!(await write(content))) {
                  state('conflict', 'It changed again; save once more.');
                }
              } catch (err) {
                state('failed', `Not saved: ${errorText(err)}`);
              }
            })()
        ],
        [
          'Load theirs',
          () =>
            void opts
              .read()
              .then((design) => load(cesdk, design))
              .then(
                () => state('ready', 'Showing the assistant’s version.'),
                (err) => state('failed', errorText(err))
              )
        ]
      ]);
    } catch (err) {
      state('failed', `Not saved: ${errorText(err)}`);
    } finally {
      busy = false;
    }
  };

  state('loading', 'Opening the editor…');
  dialog.showModal();

  void (async () => {
    try {
      const [{ default: CreativeEditorSDK }, { DesignEditorConfig }] =
        await Promise.all([
          import('@cesdk/cesdk-js'),
          import('./design-editor/plugin.js')
        ]);
      const design = await opts.read();
      if (!dialog.open) return;
      const cesdk = await CreativeEditorSDK.create(canvas, {
        license: opts.license,
        // The executor's engine assets: the same URL, so the wasm comes from the HTTP cache.
        baseURL: ENGINE_BASE_URL,
        ui: {
          baseURL: `https://cdn.img.ly/packages/imgly/cesdk-js/${CreativeEditorSDK.version}/assets/ui/`
        }
      });
      editor = cesdk;
      if (!dialog.open) return cesdk.dispose();
      if (import.meta.env.DEV) {
        (window as unknown as { codesignEditor?: Editor }).codesignEditor =
          cesdk;
      }
      await cesdk.addPlugin(new DesignEditorConfig());
      cesdk.ui.setTheme('light');
      await addPluginModules(cesdk.engine, opts.plugins);
      await addEditorAssets(cesdk, opts);
      cesdk.actions.register('saveScene', saveDesign);
      cesdk.ui.insertOrderComponent({ in: 'ly.img.navigation.bar' }, [
        {
          id: 'ly.img.saveScene.navigationBar',
          label: 'Save',
          color: 'accent',
          onClick: saveDesign
        },
        { id: 'ly.img.close.navigationBar', onClick: leave }
      ]);

      await load(cesdk, design);
      cesdk.engine.editor.onHistoryUpdated(() => {
        dirty = true;
        if (dialog.dataset.state === 'saved') state('ready');
      });
      state('ready');
    } catch (err) {
      state('failed', `The editor did not open: ${errorText(err)}`);
    }
  })();

  return closed;
}

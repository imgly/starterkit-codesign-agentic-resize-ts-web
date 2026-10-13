// The runner: one message per thing the page shows, the agent from demo-shared on the gateway.

import type { MessageEndpoint } from '../../shared/src/protocol.js';
import { createDesignAgent } from '../../shared/src/runner/agent.js';
import { DEFAULT_MODEL_ID } from '../../shared/src/runner/model.js';
import type {
  PageSize,
  PageToRunner,
  RenderRequest,
  ResizeRun,
  RunnerToPage,
  StartExecutors
} from '../protocol.js';
import { resizeDesign, openDesign, readSource } from './resize.js';

export interface Hosting {
  startExecutors: StartExecutors;
  readSample(): Promise<Uint8Array>;
}

/** `bearer`: the gateway's token, asked before each call. */
export function createRunner(
  page: MessageEndpoint<RunnerToPage, PageToRunner>,
  host: Hosting,
  bearer: () => Promise<string>
): void {
  const run = async ({
    run,
    source,
    formats,
    model,
    host: settings
  }: ResizeRun) => {
    let index = -1;
    let files = 0;
    const { executors, release } = host.startExecutors(settings, bearer);
    try {
      const result = await resizeDesign(
        {
          executors,
          readSample: host.readSample,
          stage: (at, stage) => {
            index = at;
            page.postMessage({ type: 'stage', run, index, stage });
          },
          runAgent: ({ prompt, ...agent }) => {
            const at = index;
            return createDesignAgent({
              ...agent,
              gatewayBaseURL: settings.gatewayBaseURL,
              model: model ?? DEFAULT_MODEL_ID,
              getApiKey: bearer,
              onEvent: (event) =>
                page.postMessage({ type: 'event', run, index: at, event })
            }).prompt(prompt);
          },
          landed: (at, design) =>
            page.postMessage({ type: 'design', run, index: at, design }),
          keep: async (bytes, kind) => {
            const key = `${run}/${(files += 1)}`;
            const buffer = bytes.slice().buffer;
            page.postMessage(
              { type: 'file', run, index, key, kind, bytes: buffer },
              [buffer]
            );
            return key;
          }
        },
        source,
        formats
      );
      page.postMessage({ type: 'done', run, result });
    } catch (error) {
      page.postMessage({ type: 'failed', run, error: message(error) });
    } finally {
      release();
    }
  };

  // The preview tool's render: free and size-capped, where a PNG export would be charged.
  const render = async ({ id, source, host: settings }: RenderRequest) => {
    const { executors, release } = host.startExecutors(settings, bearer);
    const codesign = openDesign(executors, crypto.randomUUID());
    try {
      const { design, version } = await codesign.load(
        await readSource(source, host.readSample)
      );
      const first = (
        await codesign.edit<unknown, (PageSize & { page: number }) | undefined>(
          FIRST_PAGE,
          { design }
        )
      ).value;
      const result = await codesign.tools
        .find((t) => t.name === 'preview')
        ?.call(
          { design, version, ...(first ? { blockIds: [first.page] } : {}) },
          {}
        );
      const image = result?.content.find((p) => p.type === 'image');
      if (result?.isError === true || image?.type !== 'image') {
        const said = result?.content.find((p) => p.type === 'text');
        throw new Error(said?.type === 'text' ? said.text : 'no preview');
      }
      const png = Uint8Array.from(atob(image.data), (c) =>
        c.charCodeAt(0)
      ).buffer;
      const size = first && {
        width: first.width,
        height: first.height,
        unit: first.unit
      };
      page.postMessage({ type: 'rendered', id, png, size }, [png]);
    } catch (error) {
      page.postMessage({ type: 'render.failed', id, error: message(error) });
    } finally {
      await codesign.release().catch(() => undefined);
      release();
    }
  };

  page.addEventListener('message', (event) => {
    if (event.data?.type === 'resize') void run(event.data);
    if (event.data?.type === 'render') void render(event.data);
  });
  page.postMessage({ type: 'ready' });
}

const FIRST_PAGE = `const [page] = engine.scene.getPages();
return { page, width: engine.block.getWidth(page), height: engine.block.getHeight(page), unit: engine.scene.getDesignUnit() };`;

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

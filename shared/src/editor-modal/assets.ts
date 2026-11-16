// The editor's asset library: CE.SDK's own sources as the AI editor kit adds them (the video editor kit's, for a
// video), and the host's in front of each panel it names. A panel the host names shows the host's sources, the ones its sessions have, and no second list.

import type CreativeEditorSDK from '@cesdk/cesdk-js';
import type { AssetDefinition } from '@cesdk/engine';

/** CE.SDK's local upload source: the upload button adds to it once `upload` has stored the file. */
export const UPLOAD_SOURCE_ID = 'ly.img.image.upload';
/** The dock's brand library: the host's `brand` sources and this session's uploads. */
export const BRAND_ENTRY_ID = 'demo.brand';

export interface EditorLibraries {
  /** Typeface sources, shown in this order; absent: CE.SDK's typefaces. */
  typefaces?: string[];
  /** Colour sources, shown before CE.SDK's palette. */
  colors?: string[];
  /** Image sources, shown before this session's uploads; absent: CE.SDK's demo images. */
  images?: string[];
  /** In the video editor: video sources, shown before CE.SDK's demo clips. */
  videos?: string[];
  /** In the video editor: audio sources, shown before CE.SDK's demo audio. */
  audios?: string[];
  /** A dock button of its own, in the kit's Uploads place; absent: the kit's Uploads. */
  brand?: string[];
  /** A section heading per source id, in every panel; absent: CE.SDK's, or the id. */
  titles?: Record<string, string>;
}

export interface EditorAssetOptions {
  libraries?: EditorLibraries;
  /** Keeps a person's upload where the design's sessions find it. Default: CE.SDK's, which keeps it in this tab only. */
  upload?(file: File): Promise<AssetDefinition>;
}

const unique = (ids: string[]) => [...new Set(ids)];

/** The video editor kit's page presets: the social and video sizes. */
const VIDEO_PAGE_PRESETS = [
  'ly.img.page.presets.instagram.*',
  'ly.img.page.presets.facebook.*',
  'ly.img.page.presets.x.*',
  'ly.img.page.presets.linkedin.*',
  'ly.img.page.presets.pinterest.*',
  'ly.img.page.presets.tiktok.*',
  'ly.img.page.presets.youtube.*',
  'ly.img.page.presets.video.*'
];

/** After the kit's config and the host's plugins: those plugins registered the sources the panels name. */
export async function addEditorAssets(
  cesdk: CreativeEditorSDK,
  { libraries = {}, upload }: EditorAssetOptions,
  video = false
): Promise<void> {
  const plugins = await import('@cesdk/cesdk-js/plugins');
  const demo = [
    ...(libraries.images === undefined ? ['ly.img.image.*'] : []),
    ...(video ? ['ly.img.audio.*', 'ly.img.video.*'] : [])
  ];
  await Promise.all([
    ...(video
      ? [cesdk.addPlugin(new plugins.CaptionPresetsAssetSource())]
      : []),
    cesdk.addPlugin(new plugins.ImageColorsAssetSource()),
    cesdk.addPlugin(new plugins.ColorPaletteAssetSource()),
    ...(libraries.typefaces === undefined
      ? [cesdk.addPlugin(new plugins.TypefaceAssetSource())]
      : []),
    cesdk.addPlugin(new plugins.TextAssetSource()),
    cesdk.addPlugin(new plugins.TextComponentAssetSource()),
    cesdk.addPlugin(new plugins.VectorShapeAssetSource()),
    cesdk.addPlugin(new plugins.StickerAssetSource()),
    cesdk.addPlugin(new plugins.EffectsAssetSource()),
    cesdk.addPlugin(new plugins.FiltersAssetSource()),
    cesdk.addPlugin(new plugins.BlurAssetSource()),
    cesdk.addPlugin(
      new plugins.PagePresetsAssetSource(
        video ? { include: VIDEO_PAGE_PRESETS } : undefined
      )
    ),
    cesdk.addPlugin(new plugins.CropPresetsAssetSource())
  ]);
  await Promise.all([
    cesdk.addPlugin(
      new plugins.UploadAssetSources({
        include: video
          ? [UPLOAD_SOURCE_ID, 'ly.img.video.upload', 'ly.img.audio.upload']
          : [UPLOAD_SOURCE_ID]
      })
    ),
    ...(demo.length > 0
      ? [cesdk.addPlugin(new plugins.DemoAssetSources({ include: demo }))]
      : [])
  ]);
  if (upload !== undefined) {
    cesdk.actions.register('uploadFile', (file) => upload(file));
  }

  const {
    typefaces,
    colors,
    images,
    videos,
    audios,
    brand,
    titles = {}
  } = libraries;
  cesdk.i18n.setTranslations({
    en: {
      ...Object.fromEntries(
        Object.entries(titles).map(([id, title]) => [
          `libraries.${id}.label`,
          title
        ])
      ),
      ...(brand !== undefined
        ? { [`libraries.${BRAND_ENTRY_ID}.label`]: 'Brand' }
        : {})
    }
  });
  if (typefaces !== undefined) {
    cesdk.ui.updateAssetLibraryEntry('ly.img.typefaces', {
      sourceIds: typefaces
    });
  }
  if (colors !== undefined) {
    cesdk.ui.updateAssetLibraryEntry('ly.img.colors', {
      sourceIds: ({ currentIds }) => unique([...colors, ...currentIds])
    });
  }
  if (images !== undefined) {
    cesdk.ui.updateAssetLibraryEntry('ly.img.image', {
      sourceIds: ({ currentIds }) => unique([...images, ...currentIds])
    });
  }
  for (const [entry, ids] of [
    ['ly.img.video', videos],
    ['ly.img.audio', audios]
  ] as const) {
    if (video && ids !== undefined) {
      cesdk.ui.updateAssetLibraryEntry(entry, {
        sourceIds: ({ currentIds }) => unique([...ids, ...currentIds])
      });
    }
  }
  if (brand !== undefined) {
    cesdk.ui.addAssetLibraryEntry({
      id: BRAND_ENTRY_ID,
      sourceIds: [...brand, UPLOAD_SOURCE_ID],
      canAdd: (sourceId) => sourceId === UPLOAD_SOURCE_ID
    });
    cesdk.ui.updateOrderComponent(
      { in: 'ly.img.dock', match: { key: 'ly.img.upload' } },
      {
        key: BRAND_ENTRY_ID,
        icon: '@imgly/Upload',
        label: `libraries.${BRAND_ENTRY_ID}.label`,
        entries: [BRAND_ENTRY_ID]
      }
    );
  }
}

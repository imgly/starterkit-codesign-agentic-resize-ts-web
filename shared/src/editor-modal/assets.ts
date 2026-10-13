// The editor's asset library: CE.SDK's own sources as the AI editor kit adds them, and the host's in front of each
// panel it names. A panel the host names shows the host's sources, the ones its sessions have, and no second list.

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

/** After the kit's config and the host's plugins: those plugins registered the sources the panels name. */
export async function addEditorAssets(
  cesdk: CreativeEditorSDK,
  { libraries = {}, upload }: EditorAssetOptions
): Promise<void> {
  const plugins = await import('@cesdk/cesdk-js/plugins');
  await Promise.all([
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
    cesdk.addPlugin(new plugins.PagePresetsAssetSource()),
    cesdk.addPlugin(new plugins.CropPresetsAssetSource())
  ]);
  await Promise.all([
    cesdk.addPlugin(
      new plugins.UploadAssetSources({ include: [UPLOAD_SOURCE_ID] })
    ),
    ...(libraries.images === undefined
      ? [
          cesdk.addPlugin(
            new plugins.DemoAssetSources({ include: ['ly.img.image.*'] })
          )
        ]
      : [])
  ]);
  if (upload !== undefined) {
    cesdk.actions.register('uploadFile', (file) => upload(file));
  }

  const { typefaces, colors, images, brand, titles = {} } = libraries;
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

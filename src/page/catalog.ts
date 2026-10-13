// CE.SDK's own catalogues for the resize page, read from the editor's asset folder of exactly CESDK_VERSION:
// the page and crop presets as target canvases.

import { CESDK_VERSION } from '@imgly/codesign-sdk';

import type { TargetFormat } from '../protocol.js';

export const CESDK_ASSETS_URL = `https://cdn.img.ly/packages/imgly/cesdk-js/${CESDK_VERSION}/assets`;

/** Print sizes become pixels at this resolution. */
export const PRINT_DPI = 300;
/** The longest side the resize API accepts. */
export const MAX_SIDE = 8000;
/** An aspect ratio becomes a canvas with this shorter side. */
export const RATIO_SHORT_SIDE = 1080;

interface CatalogAsset {
  id: string;
  label?: string | Record<string, string>;
  groups?: string[];
  meta?: { uri?: string; thumbUri?: string };
  payload?: {
    transformPreset?: {
      type: string;
      width?: number;
      height?: number;
      designUnit?: string;
    };
  };
}

export interface Catalog {
  assets: CatalogAsset[];
}

export interface Preset {
  id: string;
  label: string;
  /** In pixels, as the resize asks for it. */
  format: TargetFormat;
  /** As CE.SDK states it: `1080 × 1920 px`, `210 × 297 mm`. */
  size: string;
  thumb: string;
  /** Larger than the resize API takes. */
  tooLarge: boolean;
}

export interface PresetGroup {
  id: string;
  label: string;
  presets: Preset[];
}

const english = (label: CatalogAsset['label'], fallback: string) =>
  typeof label === 'string' ? label : (label?.en ?? fallback);

const resolve = (uri: string | undefined, base: string) =>
  (uri ?? '').replace('{{base_url}}', base);

const UNIT = { Pixel: 'px', Millimeter: 'mm', Inch: 'in' } as const;
const PER_INCH = { Pixel: undefined, Millimeter: 25.4, Inch: 1 } as const;

const isUnit = (unit: string): unit is keyof typeof UNIT => unit in UNIT;

function toPixels(value: number, unit: keyof typeof UNIT): number {
  const perInch = PER_INCH[unit];
  return perInch === undefined
    ? Math.round(value)
    : Math.round((value / perInch) * PRINT_DPI);
}

/** The fixed-size page presets by platform, then the fixed-ratio crop presets as one group. */
export function presetGroups(
  page: Catalog,
  crop: Catalog,
  labels: Record<string, string>,
  base: string = CESDK_ASSETS_URL
): PresetGroup[] {
  const groups = new Map<string, PresetGroup>();
  const add = (groupId: string, groupLabel: string, preset: Preset) => {
    let group = groups.get(groupId);
    if (group === undefined) {
      group = { id: groupId, label: groupLabel, presets: [] };
      groups.set(groupId, group);
    }
    group.presets.push(preset);
  };
  const preset = (
    asset: CatalogAsset,
    width: number,
    height: number,
    size: string
  ): Preset => {
    const label = english(asset.label, asset.id);
    return {
      id: asset.id,
      label,
      format: { label, width, height },
      size,
      thumb: resolve(asset.meta?.thumbUri, base),
      tooLarge: Math.max(width, height) > MAX_SIDE
    };
  };

  for (const asset of page.assets) {
    const t = asset.payload?.transformPreset;
    if (t?.type !== 'FixedSize' || !t.width || !t.height) continue;
    const unit = t.designUnit ?? 'Pixel';
    if (!isUnit(unit)) continue;
    const group = asset.groups?.[0] ?? 'other';
    add(
      group,
      labels[`libraries.ly.img.page.presets.${group}.label`] ?? group,
      preset(
        asset,
        toPixels(t.width, unit),
        toPixels(t.height, unit),
        `${t.width} × ${t.height} ${UNIT[unit]}`
      )
    );
  }
  for (const asset of crop.assets) {
    const t = asset.payload?.transformPreset;
    if (t?.type !== 'FixedAspectRatio' || !t.width || !t.height) continue;
    const scale = RATIO_SHORT_SIDE / Math.min(t.width, t.height);
    const width = Math.round(t.width * scale);
    const height = Math.round(t.height * scale);
    add(
      'ly.img.crop.presets',
      labels['libraries.ly.img.crop.presets.label'] ?? 'Aspect Ratio',
      preset(asset, width, height, `${width} × ${height} px`)
    );
  }
  return [...groups.values()];
}

export async function loadCatalog(fetchFn: typeof fetch = fetch): Promise<{
  presets: PresetGroup[];
}> {
  const json = async <T>(path: string): Promise<T> => {
    const res = await fetchFn(`${CESDK_ASSETS_URL}/${path}`);
    if (!res.ok) throw new Error(`CE.SDK ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  const [page, crop, labels] = await Promise.all([
    json<Catalog>('ly.img.page.presets/content.json'),
    json<Catalog>('ly.img.crop.presets/content.json'),
    json<Record<string, string>>('i18n/en.json')
  ]);
  return { presets: presetGroups(page, crop, labels) };
}

// The designs the page offers to resize, built by scripts/build-samples.mjs, and the canvases picked when it opens.

import coffeeAd from '../../samples/nordwind-autumn-roast-ad.imgly?url';
import coffeeAdThumb from '../../samples/nordwind-autumn-roast-ad.png?url';
import openingPoster from '../../samples/nordwind-opening-poster.imgly?url';
import openingPosterThumb from '../../samples/nordwind-opening-poster.png?url';
import eyewearSale from '../../samples/eyewear-big-sale.imgly?url';
import eyewearSaleThumb from '../../samples/eyewear-big-sale.png?url';
import podcastBanner from '../../samples/podcast-banner.imgly?url';
import podcastBannerThumb from '../../samples/podcast-banner.png?url';

export interface Sample {
  label: string;
  /** The bundled `.imgly`. The first is the hosting's `readSample`, the design shown when the page opens. */
  url: string;
  thumb: string;
  /** The size of the design's PNG export, shown under its thumbnail without rendering (and charging) one. */
  width: number;
  height: number;
}

export const SAMPLES: readonly Sample[] = [
  {
    label: 'Coffee ad, 4:5',
    url: coffeeAd,
    thumb: coffeeAdThumb,
    width: 1080,
    height: 1350
  },
  {
    label: 'Eyewear sale, 1:1',
    url: eyewearSale,
    thumb: eyewearSaleThumb,
    width: 1080,
    height: 1080
  },
  {
    label: 'Podcast banner, 16:9',
    url: podcastBanner,
    thumb: podcastBannerThumb,
    width: 1920,
    height: 1080
  },
  {
    label: 'Opening poster, A4',
    url: openingPoster,
    thumb: openingPosterThumb,
    width: 2480,
    height: 3508
  }
];

/** Picked when the page opens, so one click on Resize makes something: Instagram's landscape and square posts. */
export const DEFAULT_PICKS = [
  'ly.img.page.presets.instagram.landscape',
  'ly.img.page.presets.instagram.square'
];

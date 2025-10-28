// lib/utils/fallback.ts
// Unified fallback/placeholders to always show content when network fails or returns empty.

import type { ImageItem } from '@/lib/models/image';
import type { DonkiMerged } from '@/lib/models/donki';
import type { ApproachItem } from '@/lib/models/neows';

const now = () => new Date().toISOString();

/** Image Library fallback items */
export function makeImageFallback(n = 8): ImageItem[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: `fallback-img-${i}`,
    title: `Placeholder Image #${i + 1}`,
    description: 'Fallback content while NASA Images is unavailable.',
    date: now(),
    center: 'N/A',
    photographer: null,
    keywords: ['fallback', 'placeholder'],
    preview:
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(svgPlaceholder(4, 3)),
    sources: {
      searchHref: null,
      assetHref: null,
      metadataHref: null,
    },
  }));
}

/** DONKI fallback items (alternating flare / cme), matching DonkiMerged */
export function makeDonkiFallback(n = 6): DonkiMerged[] {
  const items: DonkiMerged[] = [];
  for (let i = 0; i < n; i++) {
    const isFlare = i % 2 === 0;

    if (isFlare) {
      // FlareItem
      items.push({
        type: 'flare',
        id: `fallback-flare-${i}`,
        startTime: now(),
        // peakTime is optional (undefined for exactOptionalPropertyTypes compatibility)
        peakTime: undefined,
        classType: 'C',
        region: null,
        note: 'Fallback flare while DONKI is unavailable.',
      });
    } else {
      // CMEItem
      items.push({
        type: 'cme',
        id: `fallback-cme-${i}`,
        startTime: now(),
        speed: 450 + i * 20,
        direction: 'W',
        note: 'Fallback CME while DONKI is unavailable.',
      });
    }
  }
  return items;
}

/** NeoWs fallback items, matching ApproachItem */
export function makeNeowsFallback(n = 6): ApproachItem[] {
  const base = Date.now();
  return Array.from({ length: n }).map((_, i) => ({
    id: `fallback-neo-${i}`,
    epoch: base + i * 3600_000,
    distance_lunar: 5 + i * 0.5,
    diameter_km: 0.15 + i * 0.02,
    hazardous: i % 3 === 0,
  }));
}

/* -------- helpers -------- */

function svgPlaceholder(wRatio = 4, hRatio = 3): string {
  const w = 800,
    h = Math.round((800 * hRatio) / wRatio);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">
    <text x="${w / 2}" y="${h / 2}" font-size="28">Placeholder</text>
  </g>
</svg>
  `.trim();
}

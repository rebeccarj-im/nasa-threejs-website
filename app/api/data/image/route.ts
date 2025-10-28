// app/api/data/image/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';          // Run on the Edge — faster cold start
export const revalidate = 0;            // Use Cache-Control headers for caching

/* ---------------- Types exposed to the frontend ---------------- */

type ImageItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  center: string | null;
  photographer: string | null;
  keywords: string[];
  preview: string | null;
  sources: {
    searchHref: string | null;
    assetHref: string | null;
    metadataHref: string | null;
  };
};

type ImageSearchResponse = {
  lib: 'image';
  page: number;
  pageSize: number;
  total: number | null;     // NASA’s search API doesn’t return total; always null here (placeholder for unified API)
  hasMore: boolean;         // Roughly inferred by checking if the current page has data
  items: ImageItem[];
};

/* ---------------- NASA API helpers ---------------- */

const NASA_SEARCH = 'https://images-api.nasa.gov/search';
// Derived endpoints (can be built without extra requests)
const toAssetHref = (nasaId: string) => `https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`;
const toMetadataHref = (nasaId: string) => `https://images-api.nasa.gov/metadata/${encodeURIComponent(nasaId)}`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const yearStart = (url.searchParams.get('year_start') || '').trim();
    const yearEnd   = (url.searchParams.get('year_end') || '').trim();
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    // Build NASA search query (image-only)
    const sp = new URLSearchParams();
    sp.set('media_type', 'image');
    sp.set('page', String(page));
    if (q) sp.set('q', q);
    if (yearStart) sp.set('year_start', yearStart);
    if (yearEnd) sp.set('year_end', yearEnd);

    const searchHref = `${NASA_SEARCH}?${sp.toString()}`;

    // Request upstream NASA API (with moderate timeout)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000); // 12s timeout
    const res = await fetch(searchHref, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      // NASA’s side can cache; downstream caching is handled via Cache-Control
    }).catch((e) => {
      // Network or timeout errors
      throw new Error(`Upstream request failed: ${String(e)}`);
    });
    clearTimeout(t);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`NASA API ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }

    const json = (await res.json().catch(() => null)) as any;
    const itemsRaw: any[] = json?.collection?.items || [];

    // Convert to unified ImageItem[]
    const items: ImageItem[] = itemsRaw.map((it: any) => {
      const dataArr: any[] = Array.isArray(it?.data) ? it.data : [];
      const linksArr: any[] = Array.isArray(it?.links) ? it.links : [];

      const d = dataArr[0] || {};
      const nasaId: string = String(d?.nasa_id || '').trim();
      const title: string = String(d?.title || '').trim();
      const description: string = typeof d?.description === 'string' ? d.description : null;
      const date: string | null = (d?.date_created && typeof d.date_created === 'string') ? d.date_created : null;
      const center: string | null = d?.center ? String(d.center) : null;
      const photographer: string | null =
        (typeof d?.photographer === 'string' && d.photographer) ? d.photographer
        : (typeof d?.secondary_creator === 'string' && d.secondary_creator) ? d.secondary_creator
        : null;
      const keywords: string[] = Array.isArray(d?.keywords) ? d.keywords.filter((k: any) => typeof k === 'string') : [];

      // Preview image (find link with rel=preview or first link)
      const previewLink =
        linksArr.find((l: any) => l?.rel === 'preview' && typeof l?.href === 'string')?.href ||
        linksArr.find((l: any) => typeof l?.href === 'string')?.href ||
        null;

      const item: ImageItem = {
        id: nasaId || title || cryptoRandomId(),
        title: title || 'Untitled',
        description,
        date,
        center,
        photographer,
        keywords,
        preview: previewLink,
        sources: {
          searchHref,
          assetHref: nasaId ? toAssetHref(nasaId) : null,
          metadataHref: nasaId ? toMetadataHref(nasaId) : null,
        },
      };
      return item;
    });

    const pageSize = items.length;
    // Since NASA doesn’t return total, we infer hasMore simply by whether this page has data.
    // This could be improved later with next-page probing.
    const hasMore = items.length > 0;

    const payload: ImageSearchResponse = {
      lib: 'image',
      page,
      pageSize,
      total: null,
      hasMore,
      items,
    };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // 5 minutes freshness + 1 day stale-while-revalidate
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[api/data/image] error:', err?.message || err);
    return NextResponse.json(
      { message: err?.message || 'Internal Server Error' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

/* ---------------- utils ---------------- */

// Very short random ID (fallback when NASA doesn’t provide nasa_id; extremely rare)
function cryptoRandomId() {
  // Works under Edge runtime using Web Crypto API
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}

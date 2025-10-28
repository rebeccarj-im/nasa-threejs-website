// lib/api/client.ts
import { ImageSearchResponse } from '@/lib/models/image';
import { DonkiListResponse } from '@/lib/models/donki';
import { NeowsListResponse } from '@/lib/models/neows';
import { APP_ORIGIN, REQ_TIMEOUT_MS } from '@/lib/utils/constants';

type Json = Record<string, any> | any[];

async function withTimeout<T>(p: Promise<T>, ms = REQ_TIMEOUT_MS): Promise<T> {
  const t = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error(`Request timeout after ${ms}ms`)), ms)
  );
  return Promise.race([p, t]);
}

async function getJSON<T = Json>(url: string): Promise<T> {
  const res = await withTimeout(fetch(url, { headers: { Accept: 'application/json' } }));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

async function postJSON<T = Json>(url: string, body: unknown): Promise<T> {
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

/* ---------------- Image Library ---------------- */
export async function fetchImages(params: {
  page?: number;
  q?: string;
  year_start?: string;
  year_end?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.q) sp.set('q', params.q);
  if (params.year_start) sp.set('year_start', params.year_start);
  if (params.year_end) sp.set('year_end', params.year_end);
  return getJSON<ImageSearchResponse>(`/api/data/image?${sp.toString()}`);
}

/* ---------------- DONKI ---------------- */
export async function fetchDonki(params: {
  page?: number;
  limit?: number;
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.start) sp.set('start', params.start);
  if (params.end)   sp.set('end', params.end);
  return getJSON<DonkiListResponse>(`/api/data/donki?${sp.toString()}`);
}

/* ---------------- NeoWs ---------------- */
export async function fetchNeows(params: {
  page?: number;
  limit?: number;
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.start) sp.set('start', params.start);
  if (params.end)   sp.set('end', params.end);
  return getJSON<NeowsListResponse>(`/api/data/neows?${sp.toString()}`);
}

/* ---------------- Share ---------------- */
type ShareType = 'image' | 'donki' | 'neows';

export async function createShortLink(payload: {
  type: ShareType;
  id: string;
  title?: string;
  /** You may pass an absolute URL; if omitted, use the current location (browser) or APP_ORIGIN (SSR). */
  url?: string;
}): Promise<{ url: string }> {
  // Ensure the backend receives an absolute URL
  const absolute =
    payload.url ||
    (typeof window !== 'undefined' && window.location?.href)
      ? payload.url ?? window.location.href
      : `${APP_ORIGIN}/`;

  const res = await postJSON<{ shortUrl?: string; url?: string; shortId?: string }>(
    '/api/share/create',
    { ...payload, url: absolute }
  );

  // Normalize to { url }
  if (typeof res?.url === 'string' && res.url.trim()) {
    return { url: res.url };
  }
  if (typeof res?.shortUrl === 'string' && res.shortUrl.trim()) {
    return { url: res.shortUrl };
  }
  if (typeof res?.shortId === 'string' && res.shortId.trim()) {
    // In the browser we can use a relative path; in SSR/Node, make it absolute
    const path = `/s/${res.shortId}`;
    if (typeof window !== 'undefined') return { url: path };
    return { url: `${APP_ORIGIN}${path}` };
  }

  // Fallback: return the absolute URL we provided/inferred
  return { url: absolute };
}

export const api = { fetchImages, fetchDonki, fetchNeows, createShortLink };
export default api;

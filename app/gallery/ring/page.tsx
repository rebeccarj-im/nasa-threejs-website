// app/gallery/ring/page.tsx
import { headers } from 'next/headers';
import GalleryRingClient from '@/components/gallery/GalleryRingClient';

// Import shared types from models to avoid duplicate declarations
import type { ImageSearchResponse } from '@/lib/models/image';
import type { DonkiListResponse } from '@/lib/models/donki';
import type { NeowsListResponse } from '@/lib/models/neows';

export const metadata = { title: 'Gallery — Cosmos Oracle' };
export const revalidate = 300;

type SearchParams = { [k: string]: string | string[] | undefined };

function str(v: string | string[] | undefined) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}
function num(v: string | string[] | undefined) {
  const s = str(v);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const rawLib = (str(searchParams.lib) || 'image').toLowerCase();
  const lib: 'image' | 'donki' | 'neows' =
    (['image', 'donki', 'neows'] as const).includes(rawLib as any) ? (rawLib as any) : 'image';

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const base = `${proto}://${host}`;

  async function jsonGet<T>(pathWithSearch: string): Promise<T | null> {
    try {
      const res = await fetch(`${base}${pathWithSearch}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  let imageData: ImageSearchResponse | undefined;
  let donkiData: DonkiListResponse | undefined;
  let neowsData: NeowsListResponse | undefined;

  if (lib === 'image') {
    const q = str(searchParams.q);
    const yearStart = str(searchParams.year_start);
    const yearEnd = str(searchParams.year_end);
    const page = num(searchParams.page) || 1;
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    if (q) sp.set('q', q);
    if (yearStart) sp.set('year_start', yearStart);
    if (yearEnd) sp.set('year_end', yearEnd);
    imageData = (await jsonGet<ImageSearchResponse>(`/api/data/image?${sp.toString()}`)) ?? undefined;
  } else if (lib === 'donki') {
    const start = str(searchParams.start);
    const end = str(searchParams.end);
    const page = num(searchParams.page) || 1;
    const limit = num(searchParams.limit) || 24;
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    donkiData = (await jsonGet<DonkiListResponse>(`/api/data/donki?${sp.toString()}`)) ?? undefined;
  } else {
    const start = str(searchParams.start);
    const end = str(searchParams.end);
    const page = num(searchParams.page) || 1;
    const limit = num(searchParams.limit) || 24;
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (start) sp.set('start', start);
    if (end) sp.set('end', end);
    neowsData = (await jsonGet<NeowsListResponse>(`/api/data/neows?${sp.toString()}`)) ?? undefined;
  }

  // Use a unique key to ensure a full remount when switching data sources,
  // preventing React hook order mismatches.
  return (
    <div>
      {lib === 'image' && <GalleryRingClient key="image" lib="image" imageData={imageData} />}
      {lib === 'donki' && <GalleryRingClient key="donki" lib="donki" donkiData={donkiData} />}
      {lib === 'neows' && <GalleryRingClient key="neows" lib="neows" neowsData={neowsData} />}
    </div>
  );
}

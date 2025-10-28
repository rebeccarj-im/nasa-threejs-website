// app/api/data/donki/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 0;

/* ---------------- Types ---------------- */

type FlareItem = {
  type: 'flare';
  id: string;
  startTime: string;
  peakTime?: string | undefined;
  classType: string;
  region?: string | null | undefined;
  note?: string | null | undefined;
};

type CMEItem = {
  type: 'cme';
  id: string;
  startTime: string;
  speed?: number | null | undefined;
  direction?: string | null | undefined;
  note?: string | null | undefined;
};

type DonkiMerged = FlareItem | CMEItem;

type DonkiResp = {
  lib: 'donki';
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  items: DonkiMerged[];
};

/* ---------------- Config ---------------- */

const BASE = 'https://api.nasa.gov/DONKI';
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

// Chunked fetching strategy (to reduce first-screen latency)
const CHUNK_DAYS = 20;       // each chunk covers 20 days
const MAX_LOOKBACK = 60;     // go back at most 60 days (further data fetched via pagination)

// Soft in-memory cache (Edge runtime process memory, 5-minute lifetime)
const SOFT_TTL_MS = 300_000;
const mem = new Map<string, { ts: number; body: string }>();

function cacheGet(key: string) {
  const v = mem.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > SOFT_TTL_MS) return null;
  return v.body;
}
function cacheSet(key: string, body: string) {
  mem.set(key, { ts: Date.now(), body });
}

/* ---------------- Route ---------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qpStart = url.searchParams.get('start') || '';
    const qpEnd = url.searchParams.get('end') || '';

    // Default: end = today (UTC), initial window ≈ 60 days
    const today = toISODateUTC(new Date());
    let end = isISODate(qpEnd) ? minISO(qpEnd, today) : today;
    let tentativeStart = isISODate(qpStart) ? qpStart : addDaysISO(end, -59);

    // Swap if start > end
    if (new Date(tentativeStart) > new Date(end)) {
      const t = tentativeStart;
      tentativeStart = end;
      end = t;
    }

    const page = toInt(url.searchParams.get('page'), 1);
    const limit = clamp(toInt(url.searchParams.get('limit'), 24), 1, 96);

    // Query-level soft cache (extremely fast for identical parameters)
    const cacheKey = `donki:${end}:${tentativeStart}:${page}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return new NextResponse(cached, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
          'X-Hit': 'mem',
        },
      });
    }

    // Stop fetching once enough data is collected for the requested page
    const needCount = page * limit;

    let mergedAll: DonkiMerged[] = [];
    let curEnd = end;
    let lookback = 0;

    while (true) {
      const curStart = maxISO(tentativeStart, addDaysISO(curEnd, -(CHUNK_DAYS - 1)));

      // Concurrently fetch FLR (solar flares) and CME (coronal mass ejections) for this chunk
      const [flr, cme] = await Promise.all([fetchFlr(curStart, curEnd), fetchCme(curStart, curEnd)]);
      mergedAll.push(...flr, ...cme);

      if (mergedAll.length >= needCount) break; // Stop once we have enough for this page

      // Move backward one chunk
      curEnd = addDaysISO(curStart, -1);
      lookback += CHUNK_DAYS;

      // Stop if reaching start boundary or max lookback limit
      if (new Date(curStart) <= new Date(tentativeStart) || lookback >= MAX_LOOKBACK) break;
    }

    // Sort descending by time and paginate
    mergedAll.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const total = mergedAll.length; // Approximate total (for higher accuracy, fetch another chunk)
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const pageItems = mergedAll.slice(startIdx, endIdx);
    const hasMore = endIdx < total;

    const body = JSON.stringify({
      lib: 'donki',
      page,
      pageSize: limit,
      total,
      hasMore,
      items: pageItems,
    } as DonkiResp);

    cacheSet(cacheKey, body);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[api/data/donki] error:', err?.message || err);
    return NextResponse.json(
      { message: err?.message || 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

/* ---------------- Upstreams ---------------- */

async function fetchFlr(start: string, end: string): Promise<FlareItem[]> {
  const url = `${BASE}/FLR?startDate=${start}&endDate=${end}&api_key=${API_KEY}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const arr = (await res.json()) as any[];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((f) => ({
      type: 'flare' as const,
      id: String(f.flrID ?? f.id ?? cryptoId()),
      startTime: String(f.beginTime ?? f.startTime ?? f.peakTime ?? ''),
      peakTime: f.peakTime ? String(f.peakTime) : undefined,
      classType: String(f.classType ?? f.class ?? 'U'),
      region: f.activeRegionNum ? String(f.activeRegionNum) : undefined,
      note: f.note ? String(f.note) : undefined,
    }))
    .filter((x) => x.startTime);
}

async function fetchCme(start: string, end: string): Promise<CMEItem[]> {
  // Only take the "most accurate" record to reduce duplicates
  const url = `${BASE}/CME?startDate=${start}&endDate=${end}&mostAccurateOnly=true&api_key=${API_KEY}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const arr = (await res.json()) as any[];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c) => ({
      type: 'cme' as const,
      id: String(c.activityID ?? c.id ?? cryptoId()),
      startTime: String(c.startTime ?? c.eventTime ?? ''),
      speed: typeof c.speed === 'number' ? c.speed : c?.cmeAnalyses?.[0]?.speed ?? undefined,
      direction:
        c?.cmeAnalyses?.[0]?.longitude != null ? `${Math.round(c.cmeAnalyses[0].longitude)}°` : undefined,
      note: c.note ? String(c.note) : undefined,
    }))
    .filter((x) => x.startTime);
}

/* ---------------- Utils ---------------- */

function toISODateUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}
function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function addDaysISO(iso: string, delta: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return toISODateUTC(d);
}
function minISO(a: string, b: string) {
  return new Date(a) <= new Date(b) ? a : b;
}
function maxISO(a: string, b: string) {
  return new Date(a) >= new Date(b) ? a : b;
}
function toInt(s: string | null, def: number) {
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : def;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function cryptoId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

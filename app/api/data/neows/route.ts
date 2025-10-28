// app/api/data/neows/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 0;

/* ---------------- Types ---------------- */

type ApproachItem = {
  id: string;             // neo_reference_id + '_' + epoch
  epoch: number;          // milliseconds timestamp
  distance_lunar: number; // distance from Earth in lunar units
  diameter_km: number;    // estimated diameter (in kilometers, median value)
  hazardous: boolean;
};

type NeowsResp = {
  lib: 'neows';
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  items: ApproachItem[];
};

/* ---------------- Config ---------------- */

const BASE = 'https://api.nasa.gov/neo/rest/v1/feed';
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

// Soft in-memory cache (Edge process memory, 5-minute TTL)
const SOFT_TTL_MS = 300_000;
const mem = new Map<string, { ts: number; body: string }>();

const cacheGet = (k: string) => {
  const v = mem.get(k);
  return v && Date.now() - v.ts <= SOFT_TTL_MS ? v.body : null;
};
const cacheSet = (k: string, b: string) => {
  mem.set(k, { ts: Date.now(), body: b });
};

/* ---------------- Route ---------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qpStart = url.searchParams.get('start') || '';
    const qpEnd = url.searchParams.get('end') || '';

    // API constraint: window ≤ 7 days, and end ≤ today
    const today = toISODateUTC(new Date());
    let end = isISODate(qpEnd) ? minISO(qpEnd, today) : today;
    let start = isISODate(qpStart) ? qpStart : addDaysISO(end, -6);

    // Swap if start > end
    if (new Date(start) > new Date(end)) {
      const t = start;
      start = end;
      end = t;
    }
    // Ensure the date range is ≤ 7 days
    if (diffDays(start, end) > 6) start = addDaysISO(end, -6);

    const page = toInt(url.searchParams.get('page'), 1);
    const limit = clamp(toInt(url.searchParams.get('limit'), 24), 1, 96);

    const cacheKey = `neows:${start}:${end}:${page}:${limit}`;
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

    // Use detailed=false to get a lighter response
    const feedUrl = `${BASE}?start_date=${start}&end_date=${end}&detailed=false&api_key=${API_KEY}`;
    const res = await fetch(feedUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {}
      throw new Error(`NeoWs upstream ${res.status} ${res.statusText} — ${detail.slice(0, 160)}`);
    }

    const json = (await res.json()) as any;
    const neoByDate = json?.near_earth_objects || {};

    // Flatten into a list of approach events
    const items: ApproachItem[] = [];
    for (const day of Object.keys(neoByDate)) {
      const arr = neoByDate[day] as any[];
      if (!Array.isArray(arr)) continue;

      for (const obj of arr) {
        const neoId = String(obj?.neo_reference_id ?? obj?.id ?? '');
        const hazard = !!obj?.is_potentially_hazardous_asteroid;

        const est = obj?.estimated_diameter?.kilometers;
        const dMin = est?.estimated_diameter_min ?? 0;
        const dMax = est?.estimated_diameter_max ?? 0;
        const diameter = dMin && dMax ? (dMin + dMax) / 2 : dMin || dMax || 0;

        const approaches: any[] = Array.isArray(obj?.close_approach_data) ? obj.close_approach_data : [];
        for (const ap of approaches) {
          const epoch = toInt(String(ap?.epoch_date_close_approach), 0);
          if (!epoch) continue;

          const lunar = parseFloat(ap?.miss_distance?.lunar ?? 'NaN');
          if (!Number.isFinite(lunar)) continue;

          items.push({
            id: `${neoId}_${epoch}`,
            epoch,
            distance_lunar: lunar,
            diameter_km: Number.isFinite(diameter) ? diameter : 0,
            hazardous: hazard,
          });
        }
      }
    }

    // Sort descending by time + paginate
    items.sort((a, b) => b.epoch - a.epoch);
    const total = items.length;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const pageItems = items.slice(startIdx, endIdx);
    const hasMore = endIdx < total;

    const body = JSON.stringify({
      lib: 'neows',
      page,
      pageSize: limit,
      total,
      hasMore,
      items: pageItems,
    } as NeowsResp);

    cacheSet(cacheKey, body);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[api/data/neows] error:', err?.message || err);
    return NextResponse.json(
      { message: err?.message || 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
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
function diffDays(a: string, b: string) {
  const t = (x: string) => new Date(x + 'T00:00:00Z').getTime();
  return Math.round((t(b) - t(a)) / 86400000);
}
function toInt(s: string | null, def: number) {
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : def;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

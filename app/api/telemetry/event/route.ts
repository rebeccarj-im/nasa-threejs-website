// app/api/telemetry/event/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

/** ---------------- Types ---------------- */
type TelemetryEvent = {
  // Unified “event name” — regardless of whether it came from SDK (e.type) or directly from `event`, all end up here
  event: string;

  // Common optional fields
  ts?: number;
  uid?: string; // Anonymous ID (SDK envelope’s cid → mapped here)
  lib?: 'image' | 'donki' | 'neows' | string;
  page?: string;
  ref?: string | null;
  meta?: Record<string, unknown>;
};

/** ---- Compatible with SDK envelope type (format sent by analytics.ts) ----
 * { e: AnalyticsEvent, ts, ua, cid }
 * or an array: [{ e, ts, ua, cid }, ...]
 */
type SdkEnvelope = {
  e: {
    type: string;
    // Possible fields carried by the SDK event (see analytics.ts):
    lib?: 'image' | 'donki' | 'neows' | string;
    itemId?: string;
    shortId?: string;
    platform?: string;
    metric?: string;
    value?: number;
    ms?: number;
  };
  ts?: number;
  ua?: string;
  cid?: string;
};

/** ---------------- Dev Storage (In-memory buffer) ---------------- */
const g = globalThis as unknown as {
  __telemetryBuffer__?: TelemetryRecord[];
  __telemetryHits__?: Map<string, { count: number; resetAt: number }>;
};
if (!g.__telemetryBuffer__) g.__telemetryBuffer__ = [];
if (!g.__telemetryHits__) g.__telemetryHits__ = new Map();

type TelemetryRecord = {
  receivedAt: number;     // Server-side receive timestamp
  ipMasked: string | null;
  ua: string | null;      // Simplified user agent
  ev: TelemetryEvent;     // Cleaned/sanitized event data
};

/** ---------------- CORS Preflight ---------------- */
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/** ---------------- GET: Debug View ----------------
 * For development/debugging only: returns the most recent N events (default 100),
 * with all PII removed.
 * Supports ?limit=100&since=timestamp for filtering.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 100)));
  const since = Number(url.searchParams.get('since') || 0);

  const buf = g.__telemetryBuffer__ ?? [];
  const filtered = since > 0 ? buf.filter(r => r.receivedAt >= since) : buf;
  const out = filtered.slice(-limit);

  return withCors(
    NextResponse.json({ count: out.length, items: out }, { status: 200 })
  );
}

/** ---------------- POST: Telemetry Ingest Endpoint ---------------- */
export async function POST(req: Request) {
  try {
    // Rate limiting (per masked IP): 60 requests / 60 seconds
    const ip = maskIp(getIp(req));
    if (!allowHit(ip, 60, 60_000)) {
      return withCors(
        NextResponse.json({ message: 'Too Many Requests' }, { status: 429 })
      );
    }

    // Parse JSON; support both single objects and arrays; SDK envelope or direct event
    const body = await req.json().catch(() => null);
    if (!body) {
      return withCors(
        NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
      );
    }

    const ua = getUA(req);
    const now = Date.now();

    // Normalize everything into TelemetryEvent[]
    const parsed = parseToTelemetryEvents(body);
    if (!parsed.length) {
      return withCors(new NextResponse(null, { status: 204 }));
    }

    // Sanitize and trim
    const cleaned: TelemetryRecord[] = [];
    for (const raw of parsed) {
      const ev = sanitizeEvent(raw);
      if (!ev) continue;
      cleaned.push({
        receivedAt: now,
        ipMasked: ip,
        ua,
        ev,
      });
    }
    if (!cleaned.length) {
      return withCors(new NextResponse(null, { status: 204 }));
    }

    // Write into in-memory buffer (replace with persistence in production)
    g.__telemetryBuffer__!.push(...cleaned);
    // Cap buffer size at 10,000 entries
    if (g.__telemetryBuffer__!.length > 10_000) {
      g.__telemetryBuffer__ = g.__telemetryBuffer__!.slice(-5_000);
    }

    // Return number of accepted events (useful for client retry/metrics)
    return withCors(
      NextResponse.json({ accepted: cleaned.length }, { status: 202 })
    );
  } catch (err: any) {
    console.error('[api/telemetry/event] error:', err?.message || err);
    return withCors(
      NextResponse.json(
        { message: err?.message || 'Internal Server Error' },
        { status: 500 }
      )
    );
  }
}

/** ---------------- Parsing: Various Formats -> TelemetryEvent[] ---------------- */
function parseToTelemetryEvents(body: unknown): TelemetryEvent[] {
  const out: TelemetryEvent[] = [];
  const arr: unknown[] = Array.isArray(body) ? body : [body];

  for (const item of arr) {
    // 1) SDK envelope (analytics.ts): { e: {...}, ts?, ua?, cid? }
    if (isSdkEnvelope(item)) {
      const mapped = mapSdkEnvelopeToTelemetry(item);
      if (mapped) out.push(mapped);
      continue;
    }

    // 2) Direct TelemetryEvent (contains 'event' field)
    if (isDirectEvent(item)) {
      out.push(item as TelemetryEvent);
      continue;
    }

    // 3) Batch envelope format: { batch: [{ e, ts, cid }, ...] }
    if (isBatchEnvelope(item)) {
      for (const x of item.batch) {
        if (isSdkEnvelope(x)) {
          const mapped = mapSdkEnvelopeToTelemetry(x);
          if (mapped) out.push(mapped);
        }
      }
      continue;
    }
  }

  return out;
}

function isSdkEnvelope(x: unknown): x is SdkEnvelope {
  return !!x && typeof x === 'object' && 'e' in (x as any);
}

function isBatchEnvelope(x: any): x is { batch: SdkEnvelope[] } {
  return !!x && typeof x === 'object' && Array.isArray(x.batch);
}

function isDirectEvent(x: any): x is TelemetryEvent {
  return !!x && typeof x === 'object' && typeof x.event === 'string';
}

/** ---- Map SDK envelope -> Our unified TelemetryEvent ---- */
function mapSdkEnvelopeToTelemetry(env: SdkEnvelope): TelemetryEvent | null {
  if (!env?.e || typeof env.e !== 'object') return null;

  // Use SDK’s e.type directly as event name (for consistency)
  const event = String(env.e.type || '').trim();
  if (!event) return null;

  // Basic mapping
  const ev: TelemetryEvent = {
    event,
    ts: typeof env.ts === 'number' && isFinite(env.ts) ? Math.round(env.ts) : undefined,
    uid: env.cid || undefined,
    lib: env.e.lib,
    // SDK doesn’t have standard page/ref fields; clients can pass them via meta if needed
    meta: buildMetaFromSdkEvent(env.e),
  };

  return ev;
}

function buildMetaFromSdkEvent(e: SdkEnvelope['e']): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  // Consolidate SDK-specific fields into meta (to avoid schema divergence)
  if (e.itemId) meta.itemId = e.itemId;
  if (e.shortId) meta.shortId = e.shortId;
  if (typeof e.value === 'number') meta.value = e.value;
  if (typeof e.ms === 'number') meta.ms = e.ms;
  if (e.platform) meta.platform = e.platform;
  if (e.metric) meta.metric = e.metric;
  return Object.keys(meta).length ? meta : undefined;
}

/** ---------------- Helpers: Sanitization / De-PII / Trimming ---------------- */

// Get simplified User-Agent label
function getUA(req: Request): string | null {
  const ua = req.headers.get('user-agent');
  if (!ua) return null;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Mobile')) return 'Mobile';
  return 'Other';
}

// Remove PII + validate + trim field sizes
function sanitizeEvent(ev: TelemetryEvent): TelemetryEvent | null {
  if (!ev || typeof ev !== 'object') return null;

  const event = stringOrNull(ev.event)?.slice(0, 64);
  if (!event) return null;

  const ts =
    typeof ev.ts === 'number' && isFinite(ev.ts) ? Math.round(ev.ts) : undefined;

  const uid = stringOrNull(ev.uid)?.slice(0, 64);
  const lib = stringOrNull(ev.lib)?.slice(0, 24);
  const page = trimPath(stringOrNull(ev.page));
  const ref = trimOrigin(stringOrNull(ev.ref));
  const meta = pruneMeta(ev.meta);

  const result: TelemetryEvent = { event };
  if (ts !== undefined) result.ts = ts;
  if (uid !== undefined) result.uid = uid;
  if (lib !== undefined) result.lib = lib;
  if (page !== undefined) result.page = page;
  if (ref !== undefined) result.ref = ref;
  if (meta !== undefined) result.meta = meta;
  return result;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function trimPath(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    if (v.startsWith('http://') || v.startsWith('https://')) {
      return new URL(v).pathname.slice(0, 256) || '/';
    }
  } catch {}
  return v.slice(0, 256);
}

function trimOrigin(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    return (u.origin || '').slice(0, 256) || undefined;
  } catch {
    return v.slice(0, 128);
  }
}

// Prune meta object (single-layer only, ignores functions/symbols/large data)
function pruneMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;

  const out: Record<string, unknown> = {};
  let size = 0;

  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (typeof k !== 'string' || !k) continue;

    // Ignore potential PII keys
    const keyLower = k.toLowerCase();
    if (PII_KEYS.some((p) => keyLower.includes(p))) continue;

    // Keep only primitive or shallow object fields
    let val: unknown = v;
    if (typeof v === 'object' && v !== null) {
      const flat: Record<string, unknown> = {};
      let count = 0;
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (count >= 8) break;
        if (isPrimitive(v2)) {
          flat[k2] = v2;
          count++;
        }
      }
      val = flat;
    } else if (!isPrimitive(v)) {
      continue;
    }

    const entry = JSON.stringify({ [k]: val });
    size += entry.length;
    if (size > 1024) break;

    out[k] = val;
  }

  return Object.keys(out).length ? out : undefined;
}

function isPrimitive(v: unknown) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

const PII_KEYS = [
  'email', 'phone', 'mobile', 'name', 'passport', 'idcard',
  'address', 'ssn', 'token', 'password',
];

// Simple IP extraction and masking (/24 for IPv4, /48 for IPv6)
function getIp(req: Request): string | null {
  const h = req.headers;
  const fwd =
    h.get('x-forwarded-for') ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    null;
  if (!fwd) return null;
  const first = fwd.split(',')[0]?.trim();
  return first || null;
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;

  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length >= 4) return parts.slice(0, 3).join('.') + '.0/24';
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) return parts.slice(0, 3).join(':') + '::/48';
  }
  return null;
}

// Simple rate limiter: key allowed `max` hits per time window
function allowHit(key: string | null, max: number, windowMs: number) {
  const k = key || 'anon';
  const now = Date.now();
  const hits = g.__telemetryHits__!;
  const rec = hits.get(k);
  if (!rec || now > rec.resetAt) {
    hits.set(k, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count++;
  return true;
}

/** ---------------- CORS ---------------- */
function withCors(resp: NextResponse) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  resp.headers.set('Vary', 'Origin');
  return resp;
}

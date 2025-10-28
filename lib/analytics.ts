// lib/analytics.ts

export type LibKind = 'image' | 'donki' | 'neows';
export type WebVitalMetric = 'LCP' | 'CLS' | 'INP' | 'FID' | 'TTFB';

export type ShareOpenEvent = {
  type: 'share_open';
  lib: LibKind;
  itemId: string;
};

export type ShareCopyEvent = {
  type: 'share_copy';
  lib: LibKind;
  itemId: string;
  shortId: string;
};

export type ShareSystemEvent = {
  type: 'share_system';
  lib: LibKind;
  itemId: string;
  shortId: string;
};

export type SocialClickEvent = {
  type: 'social_click';
  network: 'instagram' | 'reddit' | 'x';
};

export type DeeplinkOpenEvent = {
  type: 'deeplink_open';
  shortId: string;
};

export type DeeplinkCtaClickEvent = {
  type: 'deeplink_cta_click';
  shortId: string;
  cta: 'enter_app' | 'follow_instagram' | 'follow_reddit';
};

export type RumWebVitalsEvent = {
  type: 'rum_webvitals';
  metric: WebVitalMetric;
  value: number;
};

export type SessionHeartbeatEvent = {
  type: 'session_heartbeat';
  at?: number;
};

export type AnalyticsEvent =
  | ShareOpenEvent
  | ShareCopyEvent
  | ShareSystemEvent
  | SocialClickEvent
  | DeeplinkOpenEvent
  | DeeplinkCtaClickEvent
  | RumWebVitalsEvent
  | SessionHeartbeatEvent;

export type ClientMeta = {
  tz?: string;
  lang?: string;
  viewport?: { w: number; h: number };
  referrer?: string;
  ua?: string;
};

export type SendOptions = {
  fetchImpl?: typeof fetch;
  sampleRate?: number;               // 0..1 (default 1)
  referrer?: string;
  consent?: { analytics: boolean };  // default true
  timeoutMs?: number;                // reserved
};

const ENDPOINT = '/api/telemetry/event';
const QUEUE_KEY = '__analytics_queue__';
const MAX_QUEUE = 100;

const LIBS: LibKind[] = ['image', 'donki', 'neows'];
const SOCIALS = ['instagram', 'reddit', 'x'] as const;
const CTAS = ['enter_app', 'follow_instagram', 'follow_reddit'] as const;
const VITALS: WebVitalMetric[] = ['LCP', 'CLS', 'INP', 'FID', 'TTFB'];

function isNonEmptyString(x: any): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

export function validateEvent(e: AnalyticsEvent): void {
  switch (e.type) {
    case 'share_open':
      if (!LIBS.includes(e.lib)) throw new Error('Invalid lib');
      if (!isNonEmptyString(e.itemId)) throw new Error('itemId required');
      return;

    case 'share_copy':
    case 'share_system':
      if (!LIBS.includes(e.lib)) throw new Error('Invalid lib');
      if (!isNonEmptyString(e.itemId)) throw new Error('itemId required');
      if (!isNonEmptyString((e as ShareCopyEvent | ShareSystemEvent).shortId)) {
        throw new Error('shortId required');
      }
      return;

    case 'social_click':
      if (!(SOCIALS as readonly string[]).includes(e.network)) {
        throw new Error('Unsupported social network');
      }
      return;

    case 'deeplink_open':
      if (!isNonEmptyString(e.shortId)) throw new Error('shortId required');
      return;

    case 'deeplink_cta_click':
      if (!isNonEmptyString(e.shortId)) throw new Error('shortId required');
      if (!(CTAS as readonly string[]).includes(e.cta)) {
        throw new Error('Unsupported CTA');
      }
      return;

    case 'rum_webvitals':
      if (!VITALS.includes(e.metric)) throw new Error('Unknown metric');
      if (typeof e.value !== 'number' || Number.isNaN(e.value)) {
        throw new Error('value must be a number');
      }
      if (e.metric === 'CLS' && (e.value < 0 || e.value > 3)) {
        throw new Error('CLS out of range');
      }
      if (['LCP', 'INP', 'FID', 'TTFB'].includes(e.metric) && e.value < 0) {
        throw new Error(`${e.metric} must be >= 0`);
      }
      return;

    case 'session_heartbeat':
      if (e.at !== undefined && typeof e.at !== 'number') {
        throw new Error('heartbeat.at must be a number');
      }
      return;

    default:
      const _never: never = e;
      throw new Error(`Unknown event ${( _never as any)?.type ?? ''}`);
  }
}

function localStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = '__ls_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readQueue(): AnalyticsEvent[] {
  if (!localStorageAvailable()) return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    return [];
  }
}

function writeQueue(q: AnalyticsEvent[]) {
  if (!localStorageAvailable()) return;
  const trimmed = q.slice(-MAX_QUEUE);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

function enqueue(e: AnalyticsEvent) {
  if (!localStorageAvailable()) return;
  const q = readQueue();
  q.push(e);
  writeQueue(q);
}

function buildMeta(referrer?: string): ClientMeta {
  const meta: ClientMeta = {};
  try {
    meta.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  if (typeof navigator !== 'undefined') {
    meta.lang = navigator.language;
    meta.ua = (navigator as any).userAgent;
  }
  if (typeof window !== 'undefined') {
    meta.viewport = { w: (window as any).innerWidth ?? 0, h: (window as any).innerHeight ?? 0 };
    if (referrer) meta.referrer = referrer;
    else if (typeof document !== 'undefined') meta.referrer = document.referrer || undefined;
  } else if (referrer) {
    meta.referrer = referrer;
  }
  return meta;
}

export async function sendEvent(e: AnalyticsEvent, opts: SendOptions = {}): Promise<void> {
  const {
    fetchImpl = fetch,
    sampleRate = 1,
    referrer,
    consent = { analytics: true },
  } = opts;

  if (!consent.analytics) return;

  if (sampleRate < 1) {
    const r = Math.random();
    if (r > sampleRate) return;
  }

  validateEvent(e);

  const meta = buildMeta(referrer);
  const history = readQueue();
  const events = history.length ? [...history, e] : [e];

  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events, meta }),
    });

    if (!res.ok) {
      enqueue(e);
      return;
    }

    if (localStorageAvailable()) writeQueue([]);
  } catch {
    enqueue(e);
  }
}

export default sendEvent;

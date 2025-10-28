// tests/analytics/analytics.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEvent, type AnalyticsEvent, validateEvent } from '@/lib/analytics';

const QUEUE_KEY = '__analytics_queue__';

function extractEventsFromBody(init?: RequestInit): any[] {
  if (!init?.body) return [];
  const parsed =
    typeof init.body === 'string'
      ? JSON.parse(init.body)
      : JSON.parse(new TextDecoder().decode(init.body as any));
  if (parsed && Array.isArray(parsed.events)) return parsed.events;
  return parsed ? [parsed] : [];
}

function getLastFetchCall(mockFetch: any): [string, RequestInit] {
  const len = mockFetch.mock.calls.length;
  return mockFetch.mock.calls[len - 1] as [string, RequestInit];
}

function safeParse<T = any>(str: string | null, fallback: T): T {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

const original = {
  localStorage: globalThis.localStorage as any,
  innerWidth: globalThis.innerWidth,
  innerHeight: globalThis.innerHeight,
};

const okFetch: typeof fetch = vi.fn(async () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 })
);

const badFetch500: typeof fetch = vi.fn(async () => new Response('err', { status: 500 }));
const timeoutFetch: typeof fetch = vi.fn(async () => { throw new Error('Timeout'); });

describe('analytics schema', () => {
  it('accepts a valid share_open', () => {
    expect(() =>
      validateEvent({ type: 'share_open', lib: 'donki', itemId: 'x' })
    ).not.toThrow();
  });

  it('rejects invalid lib', () => {
    expect(() =>
      validateEvent({ type: 'share_open', lib: 'foo' } as any)
    ).toThrow();
  });

  it('web vitals requires value', () => {
    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'LCP' } as any)
    ).toThrow();

    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'LCP', value: 1234 })
    ).not.toThrow();
  });

  it('deeplink requires shortId', () => {
    expect(() =>
      validateEvent({ type: 'deeplink_open' } as any)
    ).toThrow();
  });

  it('share_* events require appropriate fields', () => {
    expect(() =>
      validateEvent({ type: 'share_open', lib: 'image', itemId: 'img1' })
    ).not.toThrow();
    expect(() =>
      validateEvent({ type: 'share_open', lib: 'image' } as any)
    ).toThrow();

    expect(() =>
      validateEvent({ type: 'share_copy', lib: 'image', itemId: 'img1', shortId: 'abc' })
    ).not.toThrow();
    expect(() =>
      validateEvent({ type: 'share_copy', lib: 'image', itemId: 'img1' } as any)
    ).toThrow();

    expect(() =>
      validateEvent({ type: 'share_system', lib: 'donki', itemId: 'k2', shortId: 'xyz' })
    ).not.toThrow();
  });

  it('deeplink CTA events require shortId and cta', () => {
    expect(() =>
      validateEvent({ type: 'deeplink_open', shortId: 'abc' })
    ).not.toThrow();

    expect(() =>
      validateEvent({ type: 'deeplink_cta_click', shortId: 'abc', cta: 'enter_app' })
    ).not.toThrow();

    expect(() =>
      validateEvent({ type: 'deeplink_cta_click', cta: 'enter_app' } as any)
    ).toThrow();
  });

  it('web vitals metrics and value ranges', () => {
    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'LCP', value: 1200 })
    ).not.toThrow();

    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'CLS', value: 0.06 })
    ).not.toThrow();
    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'CLS', value: 5 })
    ).toThrow();

    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'INP', value: 180 })
    ).not.toThrow();

    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'TTFB', value: 20 })
    ).not.toThrow();

    expect(() =>
      validateEvent({ type: 'rum_webvitals', metric: 'XYZ', value: 1 } as any)
    ).toThrow();
  });

  it('requires itemId for content-bound events across libs', () => {
    const contentEvents = ['share_open', 'share_copy', 'share_system'] as const;

    for (const t of contentEvents) {
      expect(() =>
        validateEvent({
          type: t,
          lib: 'image',
          itemId: 'id1',
          ...(t !== 'share_open' ? { shortId: 's1' } : {}),
        } as any)
      ).not.toThrow();

      expect(() =>
        validateEvent({
          type: t,
          lib: 'image',
          ...(t !== 'share_open' ? { shortId: 's1' } : {}),
        } as any)
      ).toThrow();

      expect(() =>
        validateEvent({
          type: t,
          lib: 'donki',
          itemId: 'd1',
          ...(t !== 'share_open' ? { shortId: 's2' } : {}),
        } as any)
      ).not.toThrow();

      expect(() =>
        validateEvent({
          type: t,
          lib: 'neows',
          itemId: 'n1',
          ...(t !== 'share_open' ? { shortId: 's3' } : {}),
        } as any)
      ).not.toThrow();
    }
  });
});

describe('sendEvent', () => {
  beforeEach(() => {
    (okFetch as any).mockClear?.();
    (badFetch500 as any).mockClear?.();
    (timeoutFetch as any).mockClear?.();

    if (typeof localStorage !== 'undefined') localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { value: original.innerWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: original.innerHeight, configurable: true });
  });

  afterEach(() => {
    if (!('localStorage' in globalThis)) {
      (globalThis as any).localStorage = original.localStorage;
    }
  });

  it('posts to the telemetry endpoint with POST', async () => {
    await sendEvent(
      { type: 'share_copy', lib: 'image', itemId: 'img1', shortId: 'abc' },
      { fetchImpl: okFetch }
    );

    expect((okFetch as any).mock.calls.length).toBe(1);
    const [url, init] = getLastFetchCall(okFetch);
    expect(url).toBe('/api/telemetry/event');
    expect((init as RequestInit).method).toBe('POST');

    const events = extractEventsFromBody(init);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('share_copy');
  });

  it('queues on 500 and flushes on next success', async () => {
    await sendEvent(
      { type: 'share_open', lib: 'neows', itemId: 'k1' },
      { fetchImpl: badFetch500 }
    );

    const q1 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q1.length).toBe(1);

    await sendEvent(
      { type: 'share_system', lib: 'donki', itemId: 'k2', shortId: 's2' },
      { fetchImpl: okFetch }
    );

    expect((okFetch as any).mock.calls.length).toBeGreaterThanOrEqual(1);

    const [, init] = getLastFetchCall(okFetch);
    const events = extractEventsFromBody(init);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'share_system')).toBe(true);

    const q2 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q2.length).toBe(0);
  });

  it('queues on fetch timeout and flushes later', async () => {
    await sendEvent(
      { type: 'share_open', lib: 'image', itemId: '1' },
      { fetchImpl: timeoutFetch }
    );
    const q1 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q1.length).toBe(1);

    await sendEvent(
      { type: 'share_open', lib: 'image', itemId: '2' },
      { fetchImpl: okFetch }
    );
    const q2 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q2.length).toBe(0);
  });

  it('handles missing localStorage (SSR/locked environments) gracefully', async () => {
    const backup = (globalThis as any).localStorage;
    // @ts-ignore
    delete (globalThis as any).localStorage;

    await expect(
      sendEvent({ type: 'share_open', lib: 'image', itemId: '1' }, { fetchImpl: okFetch })
    ).resolves.toBeUndefined();

    expect((okFetch as any).mock.calls.length).toBeGreaterThanOrEqual(1);

    (globalThis as any).localStorage = backup;
  });

  it('recovers from a corrupted queue JSON by resetting it', async () => {
    localStorage.setItem(QUEUE_KEY, 'not-json');

    await expect(
      sendEvent({ type: 'share_open', lib: 'image', itemId: '1' }, { fetchImpl: okFetch })
    ).resolves.toBeUndefined();

    const q = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(Array.isArray(q)).toBe(true);
  });

  it('respects analytics consent gating (no send, no queue when declined)', async () => {
    await sendEvent(
      { type: 'share_open', lib: 'image', itemId: '1' },
      { fetchImpl: okFetch, consent: { analytics: false } as any }
    );

    expect((okFetch as any).mock.calls.length).toBe(0);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('respects sampling for high-frequency events (drop when sampleRate=0)', async () => {
    await sendEvent(
      { type: 'rum_webvitals', metric: 'LCP', value: 1000 },
      { fetchImpl: okFetch, sampleRate: 0 } as any
    );

    expect((okFetch as any).mock.calls.length).toBe(0);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('attaches client meta (tz/lang/viewport/referrer) to payload', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });

    await sendEvent(
      { type: 'share_open', lib: 'image', itemId: '1' },
      { fetchImpl: okFetch, referrer: 'https://example.com' } as any
    );

    const [, init] = getLastFetchCall(okFetch);
    const events = extractEventsFromBody(init);

    const payload =
      events.length > 1 || !('meta' in (events[0] || {}))
        ? (JSON.parse((init as any).body) as any)
        : (events[0] as any);

    const meta = payload.meta;
    expect(meta).toBeTruthy();
    expect(meta.viewport?.w).toBe(390);
    expect(meta.viewport?.h).toBe(844);
    expect(typeof meta.tz).toBe('string');
    expect(typeof meta.lang).toBe('string');
    expect(meta.referrer).toBe('https://example.com');
  });

  it('flush payload includes queued history (batched) or sends history before/with current', async () => {
    await sendEvent(
      { type: 'share_open', lib: 'neows', itemId: 'old1' },
      { fetchImpl: badFetch500 }
    );
    const q1 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q1.length).toBe(1);

    await sendEvent(
      { type: 'share_copy', lib: 'image', itemId: 'img1', shortId: 's1' },
      { fetchImpl: okFetch }
    );

    expect((okFetch as any).mock.calls.length).toBeGreaterThanOrEqual(1);

    const [url, init] = getLastFetchCall(okFetch);
    expect(url).toBe('/api/telemetry/event');

    const events = extractEventsFromBody(init);
    expect(events.length).toBeGreaterThanOrEqual(1);
    if (events.length >= 2) {
      const types = events.map((e) => e.type);
      expect(types).toContain('share_open');
      expect(types).toContain('share_copy');
    }

    const q2 = safeParse(localStorage.getItem(QUEUE_KEY), []);
    expect(q2.length).toBe(0);
  });
});

// tests/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

/** ─────────────────────────────────────────────────────────
 * Optional: use an in-memory array as a "telemetry bucket" during development,
 * so tests can assert against it. Don't do this in production; fine for tests.
 * ───────────────────────────────────────────────────────── */
const telemetryBuffer: any[] = [];

/** Helper: read fail/delay toggles from the request (query or JSON body) */
async function readToggles(req: Request) {
  const url = new URL(req.url);
  const fail =
    url.searchParams.get('fail') === '1' ||
    url.searchParams.get('fail') === 'true';

  const delayMs = Number(url.searchParams.get('delay') || '0') || 0;

  let fromBody: any = {};
  try {
    fromBody = await req.json();
  } catch {
    // ignore
  }
  const failByBody =
    fromBody?.__testFail === true || fromBody?.fail === true || fromBody?.fail === 1;
  const delayByBody =
    typeof fromBody?.__testDelay === 'number'
      ? fromBody.__testDelay
      : typeof fromBody?.delay === 'number'
      ? fromBody.delay
      : undefined;

  return {
    fail: fail || failByBody,
    delayMs: delayByBody ?? delayMs,
    body: fromBody,
  };
}

/** ─────────────────────────────────────────────────────────
 * Handlers
 * ───────────────────────────────────────────────────────── */
export const handlers = [
  /** Short-link creation: supports failure/latency injection for tests */
  http.post('/api/share/create', async ({ request }) => {
    const { fail, delayMs, body } = await readToggles(request);
    if (delayMs > 0) await delay(delayMs);

    if (fail) {
      return HttpResponse.json(
        { message: 'mocked shortener error' },
        { status: 500 }
      );
    }

    const id = body?.id ?? 'test';
    // Your frontend reads one of shortUrl / url / shortId
    return HttpResponse.json(
      {
        shortUrl: `https://sho.rt/${id}`,
        url: `https://example.com/s/${id}`,
        shortId: id,
      },
      { status: 200 }
    );
  }),

  /** Telemetry: keep the same contract as /app/api/telemetry/event */
  http.options('/api/telemetry/event', () => {
    return new HttpResponse(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),

  // POST accepts a single object or an array; supports SDK envelope or direct payload
  http.post('/api/telemetry/event', async ({ request }) => {
    const { fail, delayMs, body } = await readToggles(request);
    if (delayMs > 0) await delay(delayMs);
    if (fail) {
      return HttpResponse.json(
        { message: 'mocked telemetry error' },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Make it feel like a real service: parse & push into the in-memory bucket
    const items = Array.isArray(body) ? body : [body];
    for (const it of items) {
      // Keep a simple structure to make assertions easy in tests
      if (it?.event || it?.e?.type) {
        telemetryBuffer.push({
          receivedAt: Date.now(),
          ev: it.event ? it : { event: it.e?.type, meta: it.e },
        });
      }
    }
    return HttpResponse.json(
      { accepted: items.length },
      { status: 202, headers: corsHeaders() }
    );
  }),

  // GET endpoint to verify in tests whether telemetry was recorded
  http.get('/api/telemetry/event', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 100)));
    const since = Number(url.searchParams.get('since') || 0);

    const filtered = since > 0
      ? telemetryBuffer.filter((r) => r.receivedAt >= since)
      : telemetryBuffer;

    const items = filtered.slice(-limit);
    return HttpResponse.json(
      { count: items.length, items },
      { status: 200, headers: corsHeaders() }
    );
  }),

  /** NASA proxy (add more routes according to your project as needed) */
  http.get('/api/nasa/*', () => {
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),

  /** DONKI list (sample) */
  http.get('/api/data/donki', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    return HttpResponse.json(
      {
        page,
        pageSize: 24,
        hasMore: false,
        items: [],
      },
      { status: 200 }
    );
  }),

  /** NeoWs list (sample) */
  http.get('/api/data/neows', () => {
    return HttpResponse.json(
      {
        page: 1,
        pageSize: 24,
        hasMore: false,
        items: [],
      },
      { status: 200 }
    );
  }),

  /** Image Library (some list-page tests will use this) */
  http.get('/api/data/image', () => {
    return HttpResponse.json(
      {
        page: 1,
        pageSize: 24,
        hasMore: false,
        items: [
          {
            id: 'img-1',
            title: 'Nebula',
            description: 'A beautiful nebula.',
            date: '2024-01-01T00:00:00Z',
            center: 'JSC',
            photographer: 'NASA',
            keywords: ['nebula', 'space'],
            preview: 'https://picsum.photos/seed/nebula/640/480',
            sources: { searchHref: '', assetHref: '', metadataHref: '' },
          },
        ],
      },
      { status: 200 }
    );
  }),
];

/** ─────────────────────────────────────────────────────────
 * helpers
 * ───────────────────────────────────────────────────────── */
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

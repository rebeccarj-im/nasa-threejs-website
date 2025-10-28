// tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

/** ------- ① ResizeObserver polyfill (required by react-use-measure) ------- */
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Inject only when jsdom doesn't provide it
// @ts-ignore
if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-ignore
  globalThis.ResizeObserver = RO as any;
}

/** ------- ② navigator.clipboard mock ------- */
if (!('clipboard' in navigator)) {
  // @ts-expect-error polyfill for jsdom
  navigator.clipboard = {
    writeText: vi.fn(async (_t: string) => {}),
    readText: vi.fn(async () => ''),
  };
}

/** ------- ③ fetch mock ------- */
const originalFetch = globalThis.fetch;
globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method?.toUpperCase?.() || 'GET';

  if (url.includes('/api/share/create') && method === 'POST') {
    return new Response(
      JSON.stringify({ ok: true, shortId: 'short-abc', url: 'https://x/s/short-abc' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (url.includes('/api/telemetry/event') && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as unknown as typeof fetch;

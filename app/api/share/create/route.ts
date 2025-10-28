// app/api/share/create/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

type Body = {
  type?: string;   // 'image' | 'donki' | 'neows'
  id?: string;     // unique resource ID
  title?: string;  // optional: used for Open Graph (OG)
  url?: string;    // can be a relative path or absolute URL
};

type ShareRecord = {
  id: string;        // short link ID
  url: string;       // absolute URL (resolved)
  type: string;      // 'image' | 'donki' | 'neows'
  title?: string;    // optional, but must be a string if present (not undefined)
  createdAt: number;
  payload: { type: string; id: string; title?: string }; // same structure
};

// In-memory store (single-process, for development use only).
// In production, replace with a KV store or database.
const g = globalThis as unknown as { __shareKV?: Map<string, ShareRecord> };
if (!g.__shareKV) g.__shareKV = new Map();
const store = g.__shareKV as Map<string, ShareRecord>;

export async function POST(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json(
      { message: 'Content-Type must be application/json' },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const type = (body.type || '').toLowerCase();
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const rawTitle = typeof body.title === 'string' ? body.title : undefined;
  let url = typeof body.url === 'string' ? body.url.trim() : '';

  const ALLOWED = new Set(['image', 'donki', 'neows']);
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { message: "field 'type' must be one of 'image|donki|neows'" },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json(
      { message: "field 'id' is required (string)" },
      { status: 400 }
    );
  }

  // Resolve relative URLs to absolute ones
  let absoluteUrl = '';
  try {
    const origin = new URL(req.url).origin;
    absoluteUrl = new URL(url || '/', origin).toString();
  } catch {
    return NextResponse.json(
      { message: "field 'url' must be a valid URL or path" },
      { status: 400 }
    );
  }

  const shortId = makeId();

  const record: ShareRecord = {
    id: shortId,
    url: absoluteUrl,
    type,
    // Add `title` field only if it has a value (avoid writing undefined)
    ...(rawTitle ? { title: rawTitle } : {}),
    createdAt: Date.now(),
    payload: {
      type,
      id,
      ...(rawTitle ? { title: rawTitle } : {}),
    },
  };

  store.set(shortId, record);

  const origin = new URL(req.url).origin;
  const shortUrl = `${origin}/s/${shortId}`;

  return NextResponse.json(
    { shortId, shortUrl },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

// Generate a short random ID (hex-encoded)
function makeId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b).map(n => n.toString(16).padStart(2, '0')).join('');
}

// Disallow other methods (only POST is supported)
export async function GET() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
export async function PUT() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
export async function DELETE() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

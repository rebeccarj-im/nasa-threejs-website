// app/api/share/resolve/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

type ShareRecord = {
  id: string;
  url: string;    // absolute URL
  type: string;   // 'image' | 'donki' | 'neows'
  title?: string;
  createdAt: number;
  payload: { type: string; id: string; title?: string };
};

// Shared in-memory KV store with the "create" endpoint (development only)
const g = globalThis as unknown as { __shareKV?: Map<string, ShareRecord> };
if (!g.__shareKV) g.__shareKV = new Map();
const store = g.__shareKV as Map<string, ShareRecord>;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sid = (url.searchParams.get('sid') || '').trim();

    if (!sid) {
      return NextResponse.json(
        { message: 'Missing sid' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rec = store.get(sid);
    if (!rec) {
      return NextResponse.json(
        { message: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Optionally trim returned fields if needed
    return NextResponse.json(
      {
        id: rec.id,
        url: rec.url,
        type: rec.type,
        title: rec.title,
        createdAt: rec.createdAt,
        payload: rec.payload,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('[api/share/resolve] error:', err?.message || err);
    return NextResponse.json(
      { message: err?.message || 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// Explicitly disallow all other methods
export async function POST() {
  return NextResponse.json(
    { message: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
export async function PUT() {
  return NextResponse.json(
    { message: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
export async function DELETE() {
  return NextResponse.json(
    { message: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

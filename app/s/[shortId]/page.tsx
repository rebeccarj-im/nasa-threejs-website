// app/s/[shortId]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';

type Props = { params: { shortId: string } };

type ShareRecord = {
  id: string;
  url: string;
  type: string;       // 'image' | 'donki' | 'neows' | ...
  createdAt: number;
};

// To ensure SSR stability, wrap fetch in a safer helper
async function resolveShortId(shortId: string): Promise<ShareRecord | null> {
  try {
    // Use an absolute URL to avoid relative path resolution issues in RSC environments
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      // Fallback to localhost when running in RSC (no window object). Works for both dev and prod.
      'http://localhost:3000';
    const res = await fetch(`${base}/api/share/resolve?sid=${encodeURIComponent(shortId)}`, {
      // Disable caching so new short links are available immediately
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ShareRecord;
    return data && data.url ? data : null;
  } catch {
    return null;
  }
}

/* ---------------- Metadata (OG / Twitter) ---------------- */

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { shortId } = params;
  // Fetch basic information from the resolve API to generate OG metadata
  const rec = await resolveShortId(shortId);

  const titleBase = 'Cosmos Oracle';
  const title =
    rec?.type === 'image'
      ? `Shared NASA Image — ${titleBase}`
      : rec?.type === 'donki'
      ? `Solar Activity Snapshot — ${titleBase}`
      : rec?.type === 'neows'
      ? `Near-Earth Objects — ${titleBase}`
      : `Shared Item — ${titleBase}`;

  const description =
    rec?.type === 'image'
      ? 'Explore NASA Image & Video Library with Cosmos Oracle.'
      : rec?.type === 'donki'
      ? 'Solar flares & CMEs from NASA DONKI, visualized.'
      : rec?.type === 'neows'
      ? 'NEO close approaches & risk visuals.'
      : 'Visualize and share space data with Cosmos Oracle.';

  // Use dynamic OG image (does not fetch external preview images — stable and dependency-free)
  const og = {
    url: `/api/share/og?type=${encodeURIComponent(rec?.type || 'image')}&id=${encodeURIComponent(
      rec?.id || shortId
    )}`,
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [og],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [og.url],
    },
  };
}

/* ---------------- Page ---------------- */

export default async function ShortLandingPage({ params }: Props) {
  const { shortId } = params;
  const rec = await resolveShortId(shortId);

  if (!rec) {
    // 404 state: short link not found or expired
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Link not found</h1>
        <p className="mt-2 text-gray-600">
          This short link may have expired or never existed.
        </p>
        <div className="mt-6">
          <Link
            href="/gallery/ring?lib=image"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Explore Image Library
          </Link>
        </div>
      </main>
    );
  }

  const created = new Date(rec.createdAt);
  const createdDate = isNaN(created.getTime())
    ? null
    : created.toISOString().slice(0, 10);

  const primaryCta =
    rec.type === 'image'
      ? 'Open in app'
      : rec.type === 'donki'
      ? 'View solar activity'
      : rec.type === 'neows'
      ? 'View NEO details'
      : 'Open';

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span className="uppercase tracking-wide text-gray-700">{rec.type}</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Shared via Cosmos Oracle</h1>
        {createdDate && (
          <p className="mt-1 text-sm text-gray-500">Created on {createdDate}</p>
        )}
      </header>

      <section className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-gray-700">Destination</h2>
        <p className="mt-1 truncate text-sm text-gray-600" title={rec.url}>
          {rec.url}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {/* Primary action: open the original link */}
          <a
            href={rec.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {primaryCta}
          </a>

          {/* Secondary action: explore more */}
          <Link
            href={`/gallery/ring?lib=${
              rec.type === 'image'
                ? 'image'
                : rec.type === 'donki'
                ? 'donki'
                : rec.type === 'neows'
                ? 'neows'
                : 'image'
            }`}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Explore {rec.type === 'image' ? 'Images' : rec.type.toUpperCase()}
          </Link>

          {/* Social follow prompts */}
          <a
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
          >
            Follow on Instagram
          </a>
          <a
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            href="https://www.reddit.com"
            target="_blank"
            rel="noreferrer"
          >
            Discuss on Reddit
          </a>
        </div>
      </section>

      <footer className="mt-10 text-xs text-gray-500">
        <p>
          Note: This landing page resolves short links created in Cosmos Oracle. Please
          verify the destination before proceeding.
        </p>
      </footer>
    </main>
  );
}

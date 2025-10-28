// app/api/data/[lib]/route.ts
// Unified data proxy entry point (currently implements: image — connected to NASA Image Search API)
// Runs on Edge runtime, returns a list of ImageItem objects + pagination info as defined in the frontend contract

export const runtime = 'edge';

type ImageItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  center: string | null;
  photographer: string | null;
  keywords: string[];
  preview: string | null;
  sources: {
    searchHref: string | null;
    assetHref: string | null;
    metadataHref: string | null;
  };
};

type ImageSearchResponse = {
  lib: 'image';
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
  items: ImageItem[];
};

// Allowed query parameters for the image API
const IMAGE_ALLOWED_PARAMS = [
  'q',
  'year_start',
  'year_end',
  'center',
  'photographer',
  'keywords',
  'page',
] as const;

export async function GET(
  req: Request,
  ctx: { params: { lib: string } }
) {
  const lib = ctx.params?.lib;

  if (lib !== 'image') {
    // Other data libraries (donki/neows, etc.) can be added later here
    return json(
      { message: `Unsupported lib: ${lib}. Only 'image' is implemented.` },
      400
    );
  }

  try {
    const url = new URL(req.url);
    const search = new URLSearchParams();

    // Copy only whitelisted query parameters
    for (const key of IMAGE_ALLOWED_PARAMS) {
      const v = url.searchParams.get(key);
      if (v) search.set(key, v);
    }

    // Force media type to “image”
    search.set('media_type', 'image');
    if (!search.get('page')) search.set('page', '1');

    const upstream = `https://images-api.nasa.gov/search?${search.toString()}`;

    // Timeout control (10 seconds)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(upstream, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const text = await safeText(res);
      return json(
        {
          message: `Upstream ${res.status} ${res.statusText}`,
          detail: truncate(text, 500),
        },
        res.status
      );
    }

    const data = await res.json().catch(() => ({} as any));

    const rawItems: any[] = data?.collection?.items ?? [];
    const items: ImageItem[] = rawItems.map((it) => {
      const d = it?.data?.[0] ?? {};
      const links: any[] = it?.links ?? [];

      const preview =
        links.find((l) => l?.rel === 'preview')?.href ??
        links[0]?.href ??
        null;

      const nasaId: string | undefined = d?.nasa_id;

      return {
        id: nasaId ?? crypto.randomUUID(),
        title: d?.title ?? '',
        description: d?.description ?? '',
        date: d?.date_created ?? null,
        center: d?.center ?? null,
        photographer: d?.photographer ?? d?.secondary_creator ?? null,
        keywords: Array.isArray(d?.keywords) ? d.keywords : [],
        preview,
        sources: {
          searchHref: it?.href ?? null,
          assetHref: nasaId
            ? `https://images-api.nasa.gov/asset/${encodeURIComponent(
                nasaId
              )}`
            : null,
          metadataHref: nasaId
            ? `https://images-api.nasa.gov/metadata/${encodeURIComponent(
                nasaId
              )}`
            : null,
        },
      };
    });

    const page = Number(url.searchParams.get('page') ?? '1');
    const total: number | null =
      typeof data?.collection?.metadata?.total_hits === 'number'
        ? data.collection.metadata.total_hits
        : null;
    const pageSize = items.length;
    const hasMore =
      total != null ? page * pageSize < total : pageSize > 0; // If total unknown, assume there might be more

    const payload: ImageSearchResponse = {
      lib: 'image',
      page,
      pageSize,
      total,
      hasMore,
      items,
    };

    return json(payload, 200, {
      // Edge caching: 5 minutes fresh, up to 10 minutes stale
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return json(
      {
        message: aborted ? 'Upstream timeout' : 'Upstream fetch failed',
      },
      aborted ? 504 : 502
    );
  }
}

/* -------------------- helpers -------------------- */

function json(
  body: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(headers ?? {}),
    },
  });
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

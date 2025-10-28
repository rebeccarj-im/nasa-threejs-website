'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

/* ---------- models: shared types to avoid duplication ---------- */
import type { ImageSearchResponse, ImageItem } from '@/lib/models/image';
import type {
  DonkiListResponse,
  DonkiMerged as DonkiMergedModel,
} from '@/lib/models/donki';
import type { NeowsListResponse, ApproachItem } from '@/lib/models/neows';

/* ---------- components & visuals ---------- */
import ImageCard from '@/components/image/ImageCard';
import ImageSearchBar from '@/components/image/ImageSearchBar';
import ImageOverlay from '@/components/overlay/ImageOverlay';
import DonkiOverlay, { type DonkiItem as DonkiOverlayItem } from '@/components/overlay/DonkiOverlay';
import NeowsOverlay from '@/components/overlay/NeowsOverlay';

import { drawDonkiThumb, type DonkiMerged as VizDonkiMerged } from '@/components/donki/donki-visuals';
import { drawNeowsThumb } from '@/components/neows/neows-visuals';

/* ---------- favorites ---------- */
import FavoriteButton from '@/components/gallery/FavoriteButton';
import { useFavorites } from '@/components/gallery/favorites';

/* ---------- shared formatters ---------- */
import { safeIsoDate, safeIsoMinute } from '@/components/viz/common';

/* =========================================================
 * Props
 * =======================================================*/
type Props = {
  lib: 'image' | 'donki' | 'neows';
  imageData?: ImageSearchResponse | undefined;
  donkiData?: DonkiListResponse | undefined;
  neowsData?: NeowsListResponse | undefined;
};

/* =========================================================
 * Helpers
 * =======================================================*/
function usePagination(lib: 'image' | 'donki' | 'neows', page: number) {
  const sp = useSearchParams();
  return useMemo(() => {
    const base = new URLSearchParams(sp.toString());
    base.set('lib', lib);

    const prevParams = new URLSearchParams(base.toString());
    if (page > 1) prevParams.set('page', String(page - 1));
    else prevParams.delete('page');

    const nextParams = new URLSearchParams(base.toString());
    nextParams.set('page', String(page + 1));

    return {
      prevHref: `/gallery/ring?${prevParams.toString()}`,
      nextHref: `/gallery/ring?${nextParams.toString()}`,
    };
  }, [lib, page, sp]);
}

/* DONKI item → Overlay item (normalize null/undefined) */
function toDonkiOverlayItem(src: DonkiMergedModel): DonkiOverlayItem {
  if (src.type === 'flare') {
    return {
      id: `flare-${src.id}`,
      kind: 'FLR',
      title: `Flare ${src.classType ?? ''}`.trim(),
      startTime: src.startTime ?? null,
      peakTime: src.peakTime ?? null,
      endTime: null,
      classType: src.classType ?? null,
      speed: null,
      sourceLocation: src.region ?? null,
      instruments: [],
      link: null,
      preview: null,
      note: src.note ?? null,
      sources: { apiHref: null, detailHref: null },
    };
  }
  // cme
  return {
    id: `cme-${src.id}`,
    kind: 'CME',
    title: 'CME',
    startTime: src.startTime ?? null,
    peakTime: null,
    endTime: null,
    classType: null,
    speed: typeof src.speed === 'number' ? src.speed : null,
    sourceLocation: src.direction ?? null,
    instruments: [],
    link: null,
    preview: null,
    note: src.note ?? null,
    sources: { apiHref: null, detailHref: null },
  };
}

/* DONKI item → visual model (only include present optional fields) */
function toVizDonki(raw: DonkiMergedModel): VizDonkiMerged {
  if (raw.type === 'flare') {
    return {
      type: 'flare',
      id: raw.id,
      startTime: raw.startTime,
      ...(raw.classType ? { classType: raw.classType } : {}),
      ...(raw.region ? { region: raw.region } : {}),
      ...(raw.note != null ? { note: raw.note } : {}),
    };
  }
  return {
    type: 'cme',
    id: raw.id,
    startTime: raw.startTime,
    ...(typeof raw.speed === 'number' && Number.isFinite(raw.speed) ? { speed: raw.speed } : {}),
    ...(raw.direction ? { direction: raw.direction } : {}),
    ...(raw.note != null ? { note: raw.note } : {}),
  };
}

/* Auto-generate thumbnails for DONKI/NeoWs when no image is provided */
function useGeneratedThumb(
  lib: 'image' | 'donki' | 'neows',
  thumbUrl: string | null,
  genKey: string,
  raw: any
) {
  const [thumb, setThumb] = useState<string | null>(thumbUrl);
  const [loading, setLoading] = useState(!thumbUrl && lib !== 'image');
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;

    if (lib === 'image' || thumbUrl) {
      setThumb(thumbUrl);
      setLoading(false);
      setError(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(false);
        let dataUrl: string | null = null;
        if (lib === 'donki') dataUrl = await drawDonkiThumb(toVizDonki(raw as DonkiMergedModel));
        else if (lib === 'neows') dataUrl = await drawNeowsThumb(raw as ApproachItem);
        if (!alive) return;
        setThumb(dataUrl);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError(true);
        setLoading(false);
        console.error('thumb generate failed:', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lib, thumbUrl, genKey, raw]);

  return { thumb, loading, error };
}

/* =========================================================
 * Main component
 * =======================================================*/
export default function GalleryRingClient({ lib, imageData, donkiData, neowsData }: Props) {
  const sp = useSearchParams();

  /* favorites filter */
  const favMap = useFavorites((s) => s.entries);
  const onlyFav = sp.get('fav') === '1';

  /* unified cards (pure mapping) */
  const cards = useMemo(() => {
    if (lib === 'image') {
      const items = imageData?.items ?? [];
      const mapped = items.map((it) => {
        const subtitle = [it.center || 'Unknown center', safeIsoDate(it.date)]
          .filter(Boolean)
          .join(' · ');
        return {
          id: it.id,
          title: it.title || 'Untitled',
          subtitle,
          thumbUrl: it.preview || null,
          raw: it,
        };
      });
      return onlyFav ? mapped.filter((c) => !!favMap[`image:${c.id}`]) : mapped;
    }
    if (lib === 'donki') {
      const items = donkiData?.items ?? [];
      const mapped = items.map((it) => {
        const title = it.type === 'flare' ? `Flare ${it.classType ?? ''}`.trim() : 'CME';
        const subtitle =
          `${safeIsoMinute(it.startTime)}` +
          (it.type === 'cme' && typeof it.speed === 'number' ? ` · ${it.speed} km/s` : '');
        return {
          id: `${it.type}-${it.id}`,
          title,
          subtitle,
          thumbUrl: null,
          raw: it,
        };
      });
      return onlyFav ? mapped.filter((c) => !!favMap[`donki:${c.id}`]) : mapped;
    }
    // neows
    const items = neowsData?.items ?? [];
    const mapped = items.map((it) => {
      const subtitle = `${safeIsoMinute(it.epoch)} · ${it.distance_lunar.toFixed(1)} LD`;
      return {
        id: it.id,
        title: it.id,
        subtitle,
        thumbUrl: null,
        raw: it,
      };
    });
    return onlyFav ? mapped.filter((c) => !!favMap[`neows:${c.id}`]) : mapped;
  }, [lib, imageData, donkiData, neowsData, onlyFav, favMap]);

  /* overlay control */
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const onCardClick = useCallback((raw: any) => {
    setSelected(raw);
    setOpen(true);
  }, []);
  const onCloseOverlay = useCallback(() => {
    setOpen(false);
    setSelected(null);
  }, []);

  /* pagination from respective data sources */
  const page =
    lib === 'image' ? imageData?.page ?? 1 : lib === 'donki' ? donkiData?.page ?? 1 : neowsData?.page ?? 1;
  const hasMore =
    lib === 'image' ? !!imageData?.hasMore : lib === 'donki' ? !!donkiData?.hasMore : !!neowsData?.hasMore;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Header lib={lib} imageData={imageData} donkiData={donkiData} neowsData={neowsData} />

      {/* grid */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) =>
          lib === 'image' ? (
            <ImageCard
              key={c.id}
              id={c.id}
              title={c.title}
              subtitle={c.subtitle}
              thumbUrl={c.thumbUrl}
              onClick={() => onCardClick(c.raw)}
            />
          ) : (
            <DataCard
              key={c.id}
              id={c.id}
              lib={lib}
              title={c.title}
              subtitle={c.subtitle}
              thumbUrl={c.thumbUrl}
              raw={c.raw}
              onClick={() => onCardClick(c.raw)}
            />
          )
        )}
      </section>

      {/* pagination */}
      <Pager lib={lib} page={page} hasMore={hasMore} />

      {/* overlays (always use components/overlay/*) */}
      {lib === 'image' && (
        <ImageOverlay open={open} item={selected as ImageItem | null} onClose={onCloseOverlay} />
      )}
      {lib === 'donki' && (
        <DonkiOverlay
          open={open}
          item={selected ? toDonkiOverlayItem(selected as DonkiMergedModel) : null}
          onClose={onCloseOverlay}
        />
      )}
      {lib === 'neows' && (
        <NeowsOverlay open={open} item={selected as ApproachItem | null} onClose={onCloseOverlay} />
      )}
    </div>
  );
}

/* =========================================================
 * Header: library switch + filters
 * =======================================================*/
function Header({
  lib,
  imageData,
  donkiData,
  neowsData,
}: {
  lib: 'image' | 'donki' | 'neows';
  imageData?: ImageSearchResponse | undefined;
  donkiData?: DonkiListResponse | undefined;
  neowsData?: NeowsListResponse | undefined;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const onlyFav = sp.get('fav') === '1';

  const toggleFav = () => {
    const params = new URLSearchParams(sp.toString());
    if (onlyFav) params.delete('fav');
    else params.set('fav', '1');
    params.delete('page'); // back to page 1 after toggle
    router.push(`/gallery/ring?${params.toString()}`);
  };

  return (
    <header>
      <nav className="mb-4 flex gap-3 text-sm">
        <Link
          href={`/gallery/ring?${(() => { const p = new URLSearchParams(sp.toString()); p.set('lib','image'); p.delete('page'); return p.toString(); })()}`}
          className={`rounded px-3 py-1.5 ${lib === 'image' ? 'bg-blue-600 text-white' : 'border text-gray-700 hover:bg-gray-50'}`}
        >
          Image Library
        </Link>
        <Link
          href={`/gallery/ring?${(() => { const p = new URLSearchParams(sp.toString()); p.set('lib','donki'); p.delete('page'); return p.toString(); })()}`}
          className={`rounded px-3 py-1.5 ${lib === 'donki' ? 'bg-blue-600 text-white' : 'border text-gray-700 hover:bg-gray-50'}`}
        >
          DONKI
        </Link>
        <Link
          href={`/gallery/ring?${(() => { const p = new URLSearchParams(sp.toString()); p.set('lib','neows'); p.delete('page'); return p.toString(); })()}`}
          className={`rounded px-3 py-1.5 ${lib === 'neows' ? 'bg-blue-600 text-white' : 'border text-gray-700 hover:bg-gray-50'}`}
        >
          NeoWs
        </Link>
        <Link
          href="/favorites"
          className="rounded px-3 py-1.5 border text-gray-700 hover:bg-gray-50"
        >
          Favorites
        </Link>
      </nav>

      {/* favorites-only toggle */}
      <div className="mb-2 flex items-center gap-3 text-xs text-gray-600">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={!!onlyFav}
            onChange={toggleFav}
            className="h-3.5 w-3.5 accent-blue-600"
          />
          Show favorites only
        </label>
      </div>

      {lib === 'image' && <ImageSearchBar imageData={imageData} />}
      {lib === 'donki' && <DateRangeForm lib="donki" defaultLimit={donkiData?.pageSize ?? 24} />}
      {lib === 'neows' && <DateRangeForm lib="neows" defaultLimit={neowsData?.pageSize ?? 24} />}
    </header>
  );
}

function DateRangeForm({ lib, defaultLimit }: { lib: 'donki' | 'neows'; defaultLimit: number }) {
  const sp = useSearchParams();
  const start = sp.get('start') ?? '';
  const end = sp.get('end') ?? '';
  const limit = sp.get('limit') ?? String(defaultLimit || 24);
  const favOn = sp.get('fav') === '1';

  return (
    <form method="GET" className="space-y-3">
      <input type="hidden" name="lib" value={lib} />
      <input type="hidden" name="fav" value={favOn ? '1' : ''} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Start (YYYY-MM-DD)</label>
          <input className="w-full rounded border px-3 py-2 text-sm" name="start" defaultValue={start} placeholder="e.g., 2025-07-01" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">End (YYYY-MM-DD)</label>
          <input className="w-full rounded border px-3 py-2 text-sm" name="end" defaultValue={end} placeholder="e.g., 2025-07-31" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Per page</label>
          <input className="w-full rounded border px-3 py-2 text-sm" name="limit" type="number" min={1} max={96} defaultValue={limit} />
        </div>
      </div>
      <div className="flex gap-3">
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
        <Link href={`/gallery/ring?lib=${lib}`} className="rounded border px-4 py-2 text-sm">Reset</Link>
      </div>
    </form>
  );
}

/* =========================================================
 * Data cards (DONKI / NeoWs)
 * =======================================================*/
function DataCard({
  id,
  lib,
  title,
  subtitle,
  thumbUrl,
  raw,
  onClick,
}: {
  id: string;
  lib: 'donki' | 'neows';
  title: string;
  subtitle: string;
  thumbUrl: string | null;
  raw: any;
  onClick: () => void;
}) {
  // stable dependency string (only fields that affect the thumbnail)
  const depKey =
    lib === 'donki'
      ? `${raw.type}:${raw.id}:${raw.startTime}:${Number.isFinite(raw.speed) ? raw.speed : ''}:${raw.direction ?? ''}:${raw.classType ?? ''}:${raw.region ?? ''}:${raw.note ?? ''}`
      : `${raw.id}:${raw.epoch}:${raw.distance_lunar}:${raw.diameter_km}:${raw.hazardous ? 1 : 0}`;

  const { thumb, loading, error } = useGeneratedThumb(lib, thumbUrl, depKey, raw);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  return (
    <article
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${title}`}
    >
      {/* favorite button */}
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton
          id={id}
          lib={lib}
          title={title}
          subtitle={subtitle}
          thumbUrl={thumb ?? thumbUrl}
        />
      </div>

      {/* glossy hover overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -left-1/3 -top-1/3 h-[200%] w-[200%] rotate-12 bg-gradient-to-tr from-white/10 via-white/0 to-white/10" />
      </div>

      <div className="relative aspect-4/3 bg-gray-100">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">
            Failed to load
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">
            No preview
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{subtitle}</p>
      </div>
    </article>
  );
}

/* =========================================================
 * Pagination
 * =======================================================*/
function Pager({ lib, page, hasMore }: { lib: 'image' | 'donki' | 'neows'; page: number; hasMore: boolean }) {
  const { prevHref, nextHref } = usePagination(lib, page);

  return (
    <nav className="mt-8 flex items-center justify-between">
      <Link
        href={prevHref}
        className={`rounded-md border px-3 py-1.5 text-sm ${page > 1 ? 'text-gray-700 hover:bg-gray-50' : 'pointer-events-none text-gray-400 opacity-40'}`}
        aria-disabled={page <= 1}
      >
        ← Previous
      </Link>
      <span className="text-sm text-gray-500">Page {page}</span>
      {hasMore ? (
        <Link href={nextHref} className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Next →
        </Link>
      ) : (
        <span className="text-sm text-gray-400">No more results</span>
      )}
    </nav>
  );
}

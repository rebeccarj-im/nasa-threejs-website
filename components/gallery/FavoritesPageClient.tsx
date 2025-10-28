'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FavoriteButton from '@/components/gallery/FavoriteButton';
import { useFavorites, type FavEntry } from '@/components/gallery/favorites';

/** Fallback: convert legacy ids to FavEntry[] (ensure ts is a number, fields complete) */
function legacyIdsToEntries(ids: Record<string, number>): FavEntry[] {
  const pairs = Object.entries(ids);
  if (pairs.length === 0) return [];
  return pairs
    .map(([k, v]) => ({
      key: k,
      id: k.includes(':') ? k.split(':').slice(1).join(':') : k,
      lib: 'image' as const,
      title: k,
      ts: typeof v === 'number' ? v : 0,
    }))
    .sort((a, b) => b.ts - a.ts);
}

export default function FavoritesPageClient() {
  // ✅ Subscribe only to atomic slices
  const entriesMap = useFavorites((s) => s.entries);
  const idsMap     = useFavorites((s) => s.ids);

  // ✅ Purely derive the list once inside the component; no side effects
  const items = useMemo(() => {
    const list = Object.values(entriesMap);
    if (list.length > 0) {
      return [...list].sort((a, b) => b.ts - a.ts);
    }
    // Backward compatibility for legacy data
    return legacyIdsToEntries(idsMap as Record<string, number>);
  }, [entriesMap, idsMap]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-gray-700">
        You haven’t favorited any cards yet. Go
        <Link href="/gallery/ring?lib=image" className="mx-1 underline">
          Image Library
        </Link>
        and have a look!
      </div>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <article
          key={it.key}
          className="group relative overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md"
        >
          {/* Favorite button */}
          <div className="absolute right-2 top-2 z-10">
            <FavoriteButton
              id={it.id}
              lib={it.lib}
              // ⚠️ With exactOptionalPropertyTypes: true, avoid passing undefined
              {...(it.title !== undefined ? { title: it.title } : {})}
              {...(it.subtitle !== undefined ? { subtitle: it.subtitle } : {})}
              {...(it.thumbUrl !== undefined ? { thumbUrl: it.thumbUrl } : {})}
            />
          </div>

          {/* Gloss hover layer (consistent with DataCard) */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
            <div className="absolute -left-1/3 -top-1/3 h-[200%] w-[200%] rotate-12 bg-gradient-to-tr from-white/10 via-white/0 to-white/10" />
          </div>

          <Link
            href={`/gallery/ring?lib=${it.lib}&fav=1`}
            className="block"
            aria-label={`Open ${it.title || it.id}`}
          >
            <div className="relative aspect-4/3 bg-gray-100">
              {it.thumbUrl ? (
                <Image
                  src={it.thumbUrl}
                  alt={it.title || it.id}
                  fill
                  sizes="(max-width:768px) 50vw, (max-width:1200px) 33vw, 25vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">
                  No preview
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                {it.lib}
              </div>
              <h3 className="line-clamp-2 text-sm font-medium">
                {it.title || it.id}
              </h3>
              {it.subtitle ? (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{it.subtitle}</p>
              ) : null}
            </div>
          </Link>
        </article>
      ))}
    </section>
  );
}

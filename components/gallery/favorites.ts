'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type FavEntry = {
  /** Composite key: `${lib}:${id}` to avoid collisions across libraries */
  key: string;
  id: string;
  lib: 'image' | 'donki' | 'neows';
  title: string;
  subtitle?: string;
  thumbUrl?: string | null;
  ts: number; // time favorited (epoch ms)
};

type FavState = {
  /** Back-compat with old schema (id -> ts only). Some keys may be missing, hence Partial. */
  ids: Partial<Record<string, number>>;
  /** New schema: full entries */
  entries: Record<string, FavEntry>;

  /** Toggle favorite; `entry` provides metadata when adding a new favorite. */
  toggle: (key: string, entry?: Omit<FavEntry, 'ts' | 'key'> & { key?: string }) => void;
  /** Check if a key is favorited. */
  isFav: (key: string) => boolean;
  /** List favorites (sorted by time descending). */
  list: () => FavEntry[];
  /** Clear all favorites. */
  clear: () => void;
};

export const useFavorites = create<FavState>()(
  persist(
    (set, get) => ({
      ids: {},            // legacy
      entries: {},        // current

      toggle: (key, entry) =>
        set((state) => {
          // 1) If exists, remove it
          if (state.entries[key]) {
            const entries = { ...state.entries };
            delete entries[key];

            // Keep legacy ids in sync (delete from both to avoid stale data)
            const ids = { ...state.ids };
            if (key in ids) delete ids[key];

            return { entries, ids };
          }

          // 2) Otherwise, add new favorite
          const ts = Date.now();
          const entries = { ...state.entries };
          const ids = { ...state.ids };

          // Final key to use (allow external custom key)
          const finalKey = entry?.key ?? key;

          if (entry) {
            // Normalize fields to avoid persisting undefined (compatible with exactOptionalPropertyTypes)
            entries[finalKey] = {
              key: finalKey,
              id: entry.id,
              lib: entry.lib,
              title: entry.title ?? '',
              subtitle: entry.subtitle ?? '',
              thumbUrl: entry.thumbUrl ?? null,
              ts,
            };
          } else {
            // Fallback for extreme case: no metadata provided, write a placeholder
            entries[finalKey] = {
              key: finalKey,
              id: finalKey.includes(':') ? finalKey.split(':').slice(1).join(':') : finalKey,
              lib: 'image',
              title: finalKey,
              ts,
            };
          }

          // Sync legacy ids as well (use finalKey)
          ids[finalKey] = ts;

          return { entries, ids };
        }),

      isFav: (key) => {
        const st = get();
        return !!st.entries[key] || st.ids[key] != null;
      },

      list: () => {
        const st = get();
        const es = Object.values(st.entries);

        if (es.length > 0) {
          // Sort copy by ts descending
          return [...es].sort((a, b) => b.ts - a.ts);
        }

        // Back-compat: only legacy ids exist
        const pairs = Object.entries(st.ids ?? {});
        if (pairs.length === 0) return [];

        // Ensure ts is a number; default to 0; return FavEntry[]
        return pairs
          .map(([k, v]): FavEntry => ({
            key: k,
            id: k.includes(':') ? k.split(':').slice(1).join(':') : k,
            lib: 'image',
            title: k,
            ts: typeof v === 'number' ? v : 0,
          }))
          .sort((a, b) => b.ts - a.ts);
      },

      clear: () => ({ entries: {}, ids: {} }),
    }),
    {
      name: 'cosmic-oracle:favs',
      storage: createJSONStorage(() => localStorage),
      version: 2,
    }
  )
);

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import AudioToggle from './AudioToggle';

const tabs = [
  { href: '/', label: 'Home' },
  { href: '/gallery/ring?lib=image', label: 'Image Library' },
  { href: '/gallery/ring?lib=donki', label: 'DONKI' },
  { href: '/gallery/ring?lib=neows', label: 'NeoWs' },
  { href: '/favorites', label: 'Favorites' },
];

export default function Header() {
  const pathname = usePathname();
  const search = useSearchParams();
  const currentLib = search.get('lib');

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/favorites') return pathname === '/favorites';
    const url = new URL(href, 'http://x');
    const tabPath = url.pathname;
    const tabLib = url.searchParams.get('lib');
    if (pathname !== tabPath) return false;
    return tabLib ? currentLib === tabLib : true;
  };

  // Clean up irrelevant query parameters when switching between data libraries
  const makeHref = (rawHref: string) => {
    if (!rawHref.startsWith('/gallery/ring')) return rawHref;

    const url = new URL(rawHref, 'http://x');
    const targetLib = url.searchParams.get('lib') || 'image';

    const p = new URLSearchParams(search.toString());
    p.set('lib', targetLib);
    p.delete('page'); // Reset to the first page when switching libraries

    // Remove query parameters unrelated to the selected library
    if (targetLib === 'image') {
      // For "image", only keep q / year_start / year_end / fav
      for (const k of Array.from(p.keys())) {
        if (!['lib', 'q', 'year_start', 'year_end', 'fav'].includes(k)) p.delete(k);
      }
    } else {
      // For "donki" and "neows", only keep start / end / limit / fav
      for (const k of Array.from(p.keys())) {
        if (!['lib', 'start', 'end', 'limit', 'fav'].includes(k)) p.delete(k);
      }
    }

    return `/gallery/ring?${p.toString()}`;
  };

  const items = useMemo(
    () =>
      tabs.map((t) => {
        const active = isActive(t.href);
        const href = makeHref(t.href);
        return { ...t, active, href };
      }),
    // Recalculate when either pathname or search parameters change
    [pathname, search]
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-white">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold">NASA X Oracle</span>
        </Link>

        <nav className="hidden items-center gap-4 sm:flex">
          {items.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              aria-current={t.active ? 'page' : undefined}
              className={`rounded-md px-2 py-1 text-sm transition
                ${
                  t.active
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
            >
              {t.label}
            </Link>
          ))}
          <AudioToggle />
        </nav>

        {/* Compact audio toggle for mobile */}
        <div className="sm:hidden">
          <AudioToggle compact />
        </div>
      </div>
    </header>
  );
}

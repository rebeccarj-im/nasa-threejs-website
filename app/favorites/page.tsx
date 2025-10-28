// app/favorites/page.tsx
export const dynamic = 'force-dynamic';

import FavoritesPageClient from '@/components/gallery/FavoritesPageClient';

export const metadata = {
  title: 'Favorites · Cosmos Oracle',
};

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-lg font-semibold text-black">My Favorites</h1>
      <FavoritesPageClient />
    </div>
  );
}

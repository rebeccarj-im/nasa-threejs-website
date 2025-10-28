'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import FavoriteButton from '@/components/gallery/FavoriteButton';

type Props = {
  id: string;
  title: string;
  /** Always pass a string to avoid `undefined` under exactOptionalPropertyTypes */
  subtitle: string;
  /** Nullable; show image if present, otherwise show placeholder */
  thumbUrl: string | null;
  /** Callback to open overlay or details */
  onClick: () => void;
};

export default function ImageCard({ id, title, subtitle, thumbUrl, onClick }: Props) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <article
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${title}`}
    >
      {/* Favorite button (note exactOptionalPropertyTypes: do not pass undefined) */}
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton
          id={id}
          lib="image"
          title={title}
          subtitle={subtitle}
          thumbUrl={thumbUrl}
        />
      </div>

      {/* Gloss hover layer */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -left-1/3 -top-1/3 h-[200%] w-[200%] rotate-12 bg-gradient-to-tr from-white/10 via-white/0 to-white/10" />
      </div>

      <div className="relative aspect-4/3 bg-gray-100">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={title}
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
        <h3 className="line-clamp-2 text-sm font-medium">{title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{subtitle}</p>
      </div>
    </article>
  );
}

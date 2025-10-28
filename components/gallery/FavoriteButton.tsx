'use client';

import { useFavorites } from './favorites';

/** Simple className merger */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Inline heart icon */
function HeartIcon({
  filled,
  size = 18,
  className,
}: {
  filled: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function FavoriteButton({
  id,
  lib,
  title = '',
  subtitle = '',
  thumbUrl = null,
  className = '',
  size = 18,
  stopPropagation = true,
}: {
  id: string;
  lib: 'image' | 'donki' | 'neows';
  title?: string | undefined;
  subtitle?: string | undefined;
  thumbUrl?: string | null | undefined;
  className?: string | undefined;
  size?: number | undefined;
  stopPropagation?: boolean | undefined;
}) {
  const key = `${lib}:${id}`;
  const isFav = useFavorites((s) => s.isFav(key));
  const toggle = useFavorites((s) => s.toggle);

  return (
    <button
      type="button"
      aria-label={isFav ? 'Unfavorite' : 'Favorite'}
      aria-pressed={isFav}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        toggle(key, {
          id,
          lib,
          title: title ?? '',
          subtitle: subtitle ?? '',
          thumbUrl: thumbUrl ?? null,
        });
      }}
      className={cn(
        'rounded-full p-1.5 backdrop-blur-md transition active:scale-95',
        isFav ? 'bg-white/80' : 'bg:black/30 hover:bg-black/40',
        className
      )}
      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <HeartIcon
        size={size}
        filled={isFav}
        className={cn('drop-shadow', isFav ? 'text-red-600' : 'text-white')}
      />
    </button>
  );
}

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type ImageResp = {
  lib: 'image';
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
};

export default function ImageSearchBar({ imageData }: { imageData?: ImageResp | undefined }) {
  const sp = useSearchParams();
  const q  = sp.get('q') ?? '';
  const ys = sp.get('year_start') ?? '';
  const ye = sp.get('year_end') ?? '';
  const favOn = sp.get('fav') === '1';

  return (
    <form method="GET" className="space-y-3">
      <input type="hidden" name="lib" value="image" />
      {/* Always render to avoid hydration mismatch; browser won't submit if value is empty */}
      <input type="hidden" name="fav" value={favOn ? '1' : ''} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          name="q"
          defaultValue={q}
          placeholder="e.g., moon, mars, galaxy…"
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          name="year_start"
          type="number"
          min={1900}
          max={new Date().getFullYear()}
          defaultValue={ys}
          placeholder="Year from"
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          name="year_end"
          type="number"
          min={1900}
          max={new Date().getFullYear()}
          defaultValue={ye}
          placeholder="Year to"
        />
      </div>
      <div className="flex gap-3">
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Search
        </button>
        <Link href="/gallery/ring?lib=image" className="rounded border px-4 py-2 text-sm">
          Reset
        </Link>
      </div>
      {imageData && (
        <p className="text-xs text-gray-500">
          Page {imageData.page}
          {imageData.total !== null ? ` · Total ${imageData.total.toLocaleString()} results` : null}
        </p>
      )}
    </form>
  );
}

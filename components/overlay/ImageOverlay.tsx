// components/overlay/ImageOverlay.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { createShortLink } from '@/lib/api/client';
import { sendEvent } from '@/lib/analytics';

export type ImageItem = {
  id: string;
  title: string;
  description: string | null;
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

type Props = {
  open: boolean;
  item: ImageItem | null;
  onClose: () => void;
};

export default function ImageOverlay({ open, item, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // lightweight toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // Portal container (client only)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setContainer(document.body);
    }
  }, []);

  // Save and restore focus
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
    } else {
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus the close button after open
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  // Prevent background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Sharing: native share → fallback copy
  const shareTitle = useMemo(() => item?.title || 'Cosmos Oracle', [item]);

  const handleShare = useCallback(async () => {
    if (!item?.id) return;

    try {
      // Your API returns { url: string }
      const short = await createShortLink({
        type: 'image',
        id: item.id,
        title: shareTitle,
      });

      const finalUrl =
        short?.url ??
        (typeof window !== 'undefined' ? window.location.href : 'https://example.com');

      const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;

      // Always prepare analytics fields as strings to satisfy types
      const itemId = item.id ?? 'unknown';
      const shortId = extractShortId(finalUrl); // always returns string

      // Try native share first
      if (nav?.share) {
        try {
          await nav.share({
            title: shareTitle,
            text: 'Explore with Cosmos Oracle',
            url: finalUrl,
          });

          // Analytics: system share (always include itemId & shortId)
          await sendEvent({
            type: 'share_system',
            lib: 'image',
            itemId,
            shortId,
          });
          return;
        } catch {
          // user canceled / failed → fallback to copy
        }
      }

      // Fallback: copy to clipboard
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(finalUrl);
        showToast('Link copied');
      } else {
        showToast(finalUrl);
      }

      // Analytics: copy (always include itemId & shortId)
      await sendEvent({
        type: 'share_copy',
        lib: 'image',
        itemId,
        shortId,
      });
    } catch (e) {
      console.error('share failed', e);
      showToast('Share failed');
    }
  }, [item?.id, shareTitle, showToast]);

  if (!open || !item || !container) return null;

  const formattedDate = item.date ? new Date(item.date).toISOString().slice(0, 10) : null;

  const overlay = (
    <div aria-modal="true" role="dialog" aria-labelledby="image-overlay-title" className="fixed inset-0 z-[1000]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={handleOverlayClick} aria-hidden="true" />

      {/* Panel */}
      <div className="absolute inset-0 mx-auto my-6 flex max-w-6xl items-stretch">
        <div className="relative grid w-full grid-cols-1 overflow-hidden rounded-lg bg-white shadow-2xl md:grid-cols-2">
          {/* Close button (✕) */}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none"
          >
            ✕
          </button>

          {/* Left: large image */}
          <div className="relative min-h-[50vh] bg-black/5">
            {item.preview ? (
              <NextImage
                src={item.preview}
                alt={item.title || 'NASA Image'}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-gray-400" aria-label="No preview available">
                No preview
              </div>
            )}

            <div className="absolute left-3 top-3 flex gap-2">
              <a
                className="rounded-md bg-white/90 px-2 py-1 text-xs transition-colors duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                target="_blank"
                rel="noopener noreferrer"
                href={item.sources.assetHref ?? item.preview ?? '#'}
                aria-label="Open asset in new window"
              >
                Open Asset
              </a>
              {item.sources.metadataHref ? (
                <a
                  className="rounded-md bg-white/90 px-2 py-1 text-xs transition-colors duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={item.sources.metadataHref}
                  aria-label="View metadata in new window"
                >
                  Metadata
                </a>
              ) : null}
            </div>
          </div>

          {/* Right: info + analysis */}
          <div className="flex max-h-[80vh] flex-col overflow-y-auto p-4 md:p-6">
            <header>
              <h2 id="image-overlay-title" className="text-lg font-semibold leading-snug">
                {item.title || 'Untitled'}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {[item.center || 'Unknown center', item.photographer || undefined, formattedDate || undefined]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </header>

            {item.description && <p className="mt-3 text-sm text-gray-700">{item.description}</p>}

            {Array.isArray(item.keywords) && item.keywords.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-medium">Keywords</h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {item.keywords.slice(0, 12).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <VisualAnalysis url={item.preview} />

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleShare}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
          <div className="rounded bg-black/80 px-3 py-1.5 text-xs text-white">{toast}</div>
        </div>
      ) : null}
    </div>
  );

  return createPortal(overlay, container);
}

/* ---------------- Visual analysis ---------------- */

type AnalysisResult = {
  histogram: number[];
  paletteHex: string[];
};

function VisualAnalysis({ url }: { url: string | null }) {
  const [analysis, setAnalysis] = useState<AnalysisResult>({ histogram: [], paletteHex: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!url) {
      setAnalysis({ histogram: [], paletteHex: [] });
      setError(null);
      return;
    }

    const run = async () => {
      if (!mounted) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await analyzeImage(url);
        if (mounted) setAnalysis(result);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Analysis failed');
          setAnalysis({ histogram: [], paletteHex: [] });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [url]);

  return (
    <section className="mt-5" aria-labelledby="visual-analysis-heading">
      <h3 id="visual-analysis-heading" className="text-sm font-medium">
        Visual Analysis
      </h3>

      {isLoading && <div className="mt-2 text-xs text-gray-500">Analyzing image...</div>}
      {error && <div className="mt-2 text-xs text-red-500">Analysis failed: {error}</div>}

      {/* Dominant palette */}
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-3">
          {analysis.paletteHex.length > 0 ? (
            analysis.paletteHex.map((hex, index) => (
              <div key={`${hex}-${index}`} className="flex items-center gap-2">
                <span
                  className="inline-block h-6 w-6 rounded border border-gray-300"
                  style={{ backgroundColor: hex }}
                  aria-label={`Color ${index + 1}: ${hex}`}
                />
                <span className="text-xs text-gray-600">{hex}</span>
              </div>
            ))
          ) : !isLoading && !error ? (
            <span className="text-xs text-gray-400">No palette data</span>
          ) : null}
        </div>
      </div>

      {/* Luminance histogram */}
      <div className="mt-3">
        <Histogram bars={analysis.histogram} isLoading={isLoading} />
      </div>
    </section>
  );
}

function Histogram({ bars, isLoading }: { bars: number[]; isLoading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const normalizedBars = useMemo(() => {
    if (!Array.isArray(bars) || bars.length === 0 || isLoading) return [];
    const max = Math.max(...bars);
    if (!Number.isFinite(max) || max <= 0) return bars.map(() => 0);
    return bars.map((v) => v / max);
  }, [bars, isLoading]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    if (normalizedBars.length > 0) {
      // background
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      // bars
      const n = normalizedBars.length;
      const barW = width / n;
      ctx.fillStyle = '#60a5fa';
      for (let i = 0; i < n; i++) {
        const h = Math.round((normalizedBars[i] || 0) * (height - 4));
        ctx.fillRect(Math.floor(i * barW), height - h, Math.ceil(barW), h);
      }

      // frame
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    }
  }, [normalizedBars]);

  if (isLoading) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-gray-600">Luminance histogram</span>
          <span className="text-[10px] text-gray-400">0 → 255</span>
        </div>
        <div className="flex h-20 w-full items-center justify-center rounded border border-gray-200 bg-gray-100">
          <span className="text-xs text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-gray-600">Luminance histogram</span>
        <span className="text-[10px] text-gray-400">0 → 255</span>
      </div>
      <canvas
        ref={canvasRef}
        width={256}
        height={72}
        className="h-20 w-full rounded border border-gray-200"
        aria-label="Luminance histogram visualization"
      />
      {(!bars || bars.length === 0) && !isLoading && (
        <div className="mt-1 text-[11px] text-gray-400">No histogram data available</div>
      )}
    </div>
  );
}

/* ---------------- Image analysis ---------------- */

async function analyzeImage(src: string): Promise<AnalysisResult> {
  const img = await loadImage(src);

  // Limit sample size for performance
  const MAX_SIDE = 512;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    // return an empty analysis to keep upper layers safe
    return { histogram: Array.from({ length: 256 }, () => 0), paletteHex: [] };
  }

  // Draw and read pixels
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData?.data ?? new Uint8ClampedArray();

  // Init histogram and color buckets
  const histogram: number[] = Array.from({ length: 256 }, () => 0);
  const colorBuckets: Record<number, { r: number; g: number; b: number; count: number }> = {};

  // Sampling step (performance)
  const step = Math.max(1, Math.round(Math.max(width, height) / 256));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      if (index + 3 >= data.length) continue;

      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 255;

      if (alpha < 10) continue;

      // Luminance (BT.709)
      const luminance = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
      histogram[luminance] = (histogram[luminance] ?? 0) + 1;

      // 8x8x8 color quantization
      const rq = r >> 5;
      const gq = g >> 5;
      const bq = b >> 5;
      const bucketKey = (rq << 6) | (gq << 3) | bq;

      if (!colorBuckets[bucketKey]) colorBuckets[bucketKey] = { r: 0, g: 0, b: 0, count: 0 };
      const bucket = colorBuckets[bucketKey];
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    }
  }

  // Top-5 dominant colors
  const paletteHex = Object.values(colorBuckets)
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((b) => rgbToHex(Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)));

  return { histogram, paletteHex };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.Image) {
      reject(new Error('Image constructor is not available'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function rgbToHex(red: number, green: number, blue: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const toHex = (v: number) => {
    const s = clamp(v).toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

/* ---------------- Utilities ---------------- */

/** Extract a short id from URL, e.g. /s/abc123 → "abc123".
 *  Always returns a string ('' when not present) to satisfy strict typing. */
function extractShortId(u?: string | null): string {
  if (!u) return '';
  try {
    // Support absolute or relative paths
    const url = new URL(u, 'http://dummy.base');
    const m = url.pathname.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  } catch {
    const m = u.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  }
}

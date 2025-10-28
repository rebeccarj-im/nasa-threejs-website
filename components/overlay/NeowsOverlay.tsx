// components/overlay/NeowsOverlay.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createShortLink } from '@/lib/api/client';
import { sendEvent } from '@/lib/analytics';

export type NeowsItem = {
  id: string;              // neo_reference_id + '_' + epoch
  epoch: number;           // ms
  distance_lunar: number;  // L.D.
  diameter_km: number;     // km
  hazardous: boolean;
};

type Props = {
  open: boolean;
  item: NeowsItem | null;
  onClose: () => void;
  /** Optional: absolute URL of the current page, used as a fallback if short-link fails */
  permalink?: string;
};

export default function NeowsOverlay({ open, item, onClose, permalink }: Props) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevActive = useRef<Element | null>(null);

  // Share state
  const [shortUrl, setShortUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Portal container ---------------- */
  useEffect(() => {
    if (typeof document !== 'undefined') setContainer(document.body);
  }, []);

  /* ---------------- Keyboard Esc / focus trap ---------------- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* ---------------- Focus & scroll lock while open ---------------- */
  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (prevActive.current instanceof HTMLElement) prevActive.current.focus();
    };
  }, [open]);

  /* ---------------- Create short link when opened ---------------- */
  useEffect(() => {
    if (!open || !item) return;

    let alive = true;
    const makeShort = async () => {
      setIsCreating(true);
      setError(null);
      try {
        const created = await createShortLink({
          type: 'neows',
          id: item.id,
          title: buildShareTitle(item),
          // For backend reference; also our fallback when service fails
          url:
            permalink ||
            (typeof window !== 'undefined' ? window.location.href : 'https://example.com'),
        });

        const finalUrl =
          created?.url ||
          permalink ||
          (typeof window !== 'undefined' ? window.location.href : 'https://example.com');

        if (alive) setShortUrl(finalUrl);
      } catch (e) {
        console.error('[NeowsOverlay] short link failed:', e);
        const fallback =
          permalink ||
          (typeof window !== 'undefined' ? window.location.href : 'https://example.com');
        if (alive) {
          setShortUrl(fallback);
          setError('Short link service unavailable. Fallback to page URL.');
        }
      } finally {
        if (alive) {
          setIsCreating(false);
          setTimeout(() => copyBtnRef.current?.focus(), 0);
        }
      }
    };

    makeShort();
    return () => { alive = false; };
  }, [open, item, permalink]);

  /* ---------------- Click backdrop to close ---------------- */
  const handleMaskClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  /* ---------------- Share actions ---------------- */
  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function';

  const when = useMemo(() => isoSecond(item?.epoch), [item?.epoch]);
  const shareTitle = useMemo(() => buildShareTitle(item || null), [item]);

  const diaStr = useMemo(
    () =>
      Number.isFinite(item?.diameter_km)
        ? `${item!.diameter_km.toFixed(3)} km`
        : 'n/a',
    [item?.diameter_km]
  );
  const distLDStr = useMemo(
    () =>
      Number.isFinite(item?.distance_lunar)
        ? `${item!.distance_lunar.toFixed(2)} L.D.`
        : 'n/a',
    [item?.distance_lunar]
  );

  const handleCopy = useCallback(async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(shortUrl);
        toast('Link copied');
      } else {
        toast(shortUrl || 'No link');
      }

      // Analytics: copy (ALWAYS include itemId & shortId as strings to satisfy types)
      const itemId = item?.id ?? 'unknown';
      const shortId = extractShortId(shortUrl);
      await sendEvent({
        type: 'share_copy',
        lib: 'neows',
        itemId,
        shortId,
      });
    } catch {
      toast('Copy failed');
    }
  }, [shortUrl, item?.id]);

  const handleSystemShare = useCallback(async () => {
    if (!canWebShare) return;
    try {
      await (navigator as any).share({
        title: shareTitle,
        text: 'Near-Earth Object · Cosmos Oracle',
        url: shortUrl,
      });

      // Analytics: system share (ALWAYS include itemId & shortId)
      const itemId = item?.id ?? 'unknown';
      const shortId = extractShortId(shortUrl);
      await sendEvent({
        type: 'share_system',
        lib: 'neows',
        itemId,
        shortId,
      });
    } catch {
      // user cancelled / failed → ignore
    }
  }, [canWebShare, shareTitle, shortUrl, item?.id]);

  if (!open || !item || !container) return null;

  /* ---------------- Colors & styles ---------------- */
  const hazardColor = item.hazardous ? '#ef4444' : '#10b981'; // rose / emerald

  /* ---------------- Overlay UI ---------------- */
  const overlay = (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="NeoWs detail"
      className="fixed inset-0 z-[1000]"
    >
      <div
        className="absolute inset-0 bg-black/70"
        onClick={handleMaskClick}
        aria-hidden="true"
      />
      <div className="absolute inset-0 mx-auto my-6 flex max-w-3xl items-stretch px-3">
        <div
          ref={panelRef}
          className="relative w-full overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none"
          >
            ✕
          </button>

          {/* Header */}
          <div className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Near-Earth Object</h2>
                <p className="mt-1 text-xs text-gray-500">{when}</p>
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3">
            <SummaryCard title="Miss Distance" value={distLDStr} />
            <SummaryCard title="Estimated Diameter" value={diaStr} />
            <SummaryCard title="Object ID" value={item.id} mono />
          </div>

          {/* Visualization area */}
          <div className="grid gap-4 px-5 pb-2 sm:grid-cols-2">
            <VizCard title="Orbit Sketch">
              <OrbitCanvas
                distanceLD={safeNum(item.distance_lunar, 0)}
                diameterKm={safeNum(item.diameter_km, 0.1)}
                color={hazardColor}
              />
            </VizCard>
            <div className="grid gap-4">
              <VizCard title="Distance Meter (L.D.)">
                <DistanceMeterCanvas
                  distanceLD={safeNum(item.distance_lunar, 0)}
                  color={hazardColor}
                />
              </VizCard>
              <VizCard title="Size Scale">
                <SizeScaleCanvas
                  diameterKm={safeNum(item.diameter_km, 0.1)}
                  color={hazardColor}
                />
              </VizCard>
            </div>
          </div>

          {/* Share section */}
          <div className="border-t px-5 py-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Share link
            </label>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={isCreating ? 'Creating short link...' : shortUrl || 'Preparing...'}
                className="w-full truncate rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
              />
              <button
                ref={copyBtnRef}
                onClick={handleCopy}
                disabled={!shortUrl || isCreating}
                className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy
              </button>
              {canWebShare && (
                <button
                  onClick={handleSystemShare}
                  disabled={!shortUrl || isCreating}
                  className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Share
                </button>
              )}
            </div>
            {error && <p className="mt-1 text-xs text-amber-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, container);
}

/* ---------------- Small UI pieces ---------------- */

function SummaryCard({ title, value, mono = false }: { title: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`mt-1 text-base ${mono ? 'font-mono' : 'font-medium'}`}>{value}</div>
    </div>
  );
}

function VizCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 text-xs font-medium text-gray-600">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ---------------- Canvas visualizations ---------------- */

function useCanvasDraw(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void,
  deps: any[] = []
) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;

    const resize = () => {
      const rect = cvs.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(rect.width * dpr));
      cvs.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      draw(ctx, rect.width, rect.height, dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

function OrbitCanvas({ distanceLD, diameterKm, color }: { distanceLD: number; diameterKm: number; color: string }) {
  const ref = useCanvasDraw((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);

    // Background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#091c2b');
    g.addColorStop(1, '#13334a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Earth & Moon (schematic, not to scale)
    const cx = W * 0.22, cy = H * 0.65;
    // Earth
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.08, 0, Math.PI * 2); ctx.fill();

    // Moon orbit
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.setLineDash([4, 4]); ctx.beginPath();
    const moonR = Math.min(W, H) * 0.42;
    ctx.arc(cx, cy, moonR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Moon
    ctx.fillStyle = '#cbd5e1';
    const moonX = cx + moonR, moonY = cy;
    ctx.beginPath(); ctx.arc(moonX, moonY, Math.min(W, H) * 0.035, 0, Math.PI * 2); ctx.fill();

    // NEO path (bottom-left → top-right)
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const p0 = { x: cx - W * 0.2, y: cy + H * 0.25 };
    const p1 = { x: cx + W * 0.7, y: cy - H * 0.35 };
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

    // Closest approach along the path
    const t = clamp(distanceLD / 10, 0, 1); // map 0–10 L.D. to path interval
    const px = p0.x + (p1.x - p0.x) * (0.15 + 0.7 * t);
    const py = p0.y + (p1.y - p0.y) * (0.15 + 0.7 * t);

    // Target point size scales mildly with diameter
    const r = 4 + Math.min(10, Math.max(4, diameterKm * 0.8));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

    // Guide line
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.setLineDash([3, 3]); ctx.beginPath();
    ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`~${distanceLD.toFixed(2)} L.D.`, px + 8, py - 6);
    ctx.fillText('Moon orbit', cx + moonR + 8, cy - 8);
  }, [distanceLD, diameterKm, color]);

  return <canvas ref={ref} className="h-52 w-full rounded-md" />;
}

function DistanceMeterCanvas({ distanceLD, color }: { distanceLD: number; color: string }) {
  const ref = useCanvasDraw((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    // Axis
    const x0 = 12, x1 = W - 12, y = Math.floor(H / 2);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();

    // Ticks
    const ticks = [0, 0.1, 0.5, 1, 5, 10];
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ticks.forEach(t => {
      const tx = lerp(x0, x1, clamp(t / 10, 0, 1));
      ctx.beginPath();
      ctx.moveTo(tx, y - 6); ctx.lineTo(tx, y + 6); ctx.stroke();
      ctx.fillText(`${t}`, tx, y + 18);
    });

    // Indicator
    const pos = clamp(distanceLD / 10, 0, 1);
    const px = lerp(x0, x1, pos);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, y, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${distanceLD.toFixed(2)} L.D.`, Math.min(px + 10, W - 70), y - 10);
  }, [distanceLD, color]);

  return <canvas ref={ref} className="h-28 w-full rounded-md bg-white" />;
}

function SizeScaleCanvas({ diameterKm, color }: { diameterKm: number; color: string }) {
  const ref = useCanvasDraw((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const y0 = 18, h = 16;
    const maxKm = 1; // full scale at 1 km
    // Background bar
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(12, y0, W - 24, h);
    // Value bar
    const percent = clamp(diameterKm / maxKm, 0, 1);
    ctx.fillStyle = color;
    ctx.fillRect(12, y0, (W - 24) * percent, h);
    // Tick labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('10 m', 12, y0 + h + 16);
    ctx.fillText('100 m', 12 + (W - 24) * 0.1, y0 + h + 16);
    ctx.fillText('1 km', 12 + (W - 24) * 1.0 - 26, y0 + h + 16);

    // Numeric value
    ctx.fillStyle = '#111827';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`${diameterKm.toFixed(3)} km`, W - 12, y0 - 4);
  }, [diameterKm, color]);

  return <canvas ref={ref} className="h-24 w-full rounded-md bg-white" />;
}

/* ---------------- Utilities ---------------- */

function buildShareTitle(item: NeowsItem | null): string {
  if (!item) return 'Cosmos Oracle · NeoWs';
  const t = isoMinute(item.epoch);
  const dia = Number.isFinite(item.diameter_km)
    ? `${item.diameter_km.toFixed(1)} km`
    : 'n/a';
  const dist = Number.isFinite(item.distance_lunar)
    ? `${item.distance_lunar.toFixed(1)} L.D.`
    : 'n/a';
  return `NEO · ${dia} · ${dist} · ${t}`;
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const focusables = root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
  );
  if (!focusables || focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!first || !last) return;

  if (e.shiftKey && active === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && active === last) {
    first.focus();
    e.preventDefault();
  }
}

function toast(msg: string) {
  try {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;z-index:2000;opacity:0;transition:opacity .2s';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '0.95'; });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 1600);
  } catch {
    // ignore
  }
}

/* Safe time formatting */
function isoMinute(epoch?: number | null) {
  if (!Number.isFinite(epoch as number)) return 'Unknown';
  const d = new Date(epoch as number);
  if (isNaN(+d)) return 'Unknown';
  return d.toISOString().slice(0, 16) + 'Z';
}
function isoSecond(epoch?: number | null) {
  if (!Number.isFinite(epoch as number)) return 'Unknown';
  const d = new Date(epoch as number);
  if (isNaN(+d)) return 'Unknown';
  return d.toISOString().slice(0, 19).replace('T', ' ') + 'Z';
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function safeNum(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Extract shortId from URL (supports relative `/s/:id`). Always returns a string. */
function extractShortId(u?: string | null): string {
  if (!u) return '';
  try {
    const url = new URL(u, 'http://dummy.base'); // allow relative URL
    const m = url.pathname.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  } catch {
    const m = u.match(/\/s\/([^/?#]+)/i);
    return m?.[1] ?? '';
  }
}

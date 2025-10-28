'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Minimal subset of DONKI data model matching `/api/data/donki`.
 */
export type DonkiItem = {
  id: string;
  kind: string; // e.g. 'FLR' | 'CME' | ...
  title: string;
  startTime?: string | null;
  peakTime?: string | null;
  endTime?: string | null;
  classType?: string | null;       // e.g. 'X1.2' | 'M2.3'
  speed?: number | null;           // km/s (for CME)
  sourceLocation?: string | null;  // e.g. 'N12W33'
  instruments?: string[];
  link?: string | null;
  preview?: string | null;
  note?: string | null;
  sources?: { apiHref?: string | null; detailHref?: string | null };
};

type Props = {
  open: boolean;
  item: DonkiItem | null;
  onClose: () => void;
  permalink?: string;
};

/**
 * Main overlay component for displaying detailed information
 * about a DONKI solar event (flare, CME, etc.).
 */
export default function DonkiOverlay({ open, item, onClose, permalink }: Props) {
  // ——— Always call hooks unconditionally to maintain consistent order ——— //
  const panelRef = useRef<HTMLDivElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevActive = useRef<Element | null>(null);

  const [shortUrl, setShortUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine whether the overlay should render.
  const isOpen = open && !!item;

  /**
   * When opened, request a short link from `/api/share/create`.
   * Also disables body scroll and restores focus when closed.
   */
  useEffect(() => {
    if (!isOpen || !item) return;

    prevActive.current = document.activeElement;

    let alive = true;
    const makeShort = async () => {
      setIsCreating(true);
      setError(null);
      try {
        const res = await fetch('/api/share/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'donki',
            id: item.id,
            title: item.title,
            url: permalink || (typeof window !== 'undefined' ? window.location.href : ''),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const data = (await res.json()) as
          | { shortUrl?: string; url?: string; shortId?: string }
          | undefined;

        let finalUrl =
          data?.shortUrl ||
          data?.url ||
          (data?.shortId ? `/s/${data.shortId}` : '');

        if (!finalUrl) {
          finalUrl = permalink || (typeof window !== 'undefined' ? window.location.href : '');
          setError('Short link service unavailable. Falling back to page URL.');
        }

        if (!alive) return;
        setShortUrl(finalUrl);
      } catch (e) {
        if (!alive) return;
        console.error('[DonkiOverlay] short link failed:', e);
        const fallback = permalink || (typeof window !== 'undefined' ? window.location.href : '');
        setShortUrl(fallback);
        setError('Short link service unavailable. Falling back to page URL.');
      } finally {
        if (!alive) return;
        setIsCreating(false);
        // Focus the "Copy" button once short link is ready
        setTimeout(() => copyBtnRef.current?.focus(), 0);
      }
    };

    makeShort();

    // Prevent background scrolling
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Cleanup on close
    return () => {
      alive = false;
      document.body.style.overflow = prevOverflow;
      if (prevActive.current instanceof HTMLElement) prevActive.current.focus();
    };
  }, [isOpen, item, permalink]);

  /**
   * Handles keyboard interactions:
   * - ESC closes the overlay.
   * - TAB keeps focus trapped inside.
   */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  /** Close overlay when user clicks the mask (outside panel). */
  const handleMaskClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Determine if Web Share API is supported
  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function';

  const shareTitle = useMemo(
    () => (item?.title ? item.title : 'Shared via Cosmos Oracle'),
    [item?.title]
  );

  /** Copies the short URL to clipboard. */
  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shortUrl);
        toast('Link copied');
      } else {
        toast(shortUrl || 'No link');
      }
    } catch {
      toast('Copy failed');
    }
  }, [shortUrl]);

  /** Invokes native system share if supported. */
  const handleSystemShare = useCallback(async () => {
    if (!canWebShare) return;
    try {
      await (navigator as any).share({
        title: shareTitle,
        text: 'Explore solar activity with Cosmos Oracle',
        url: shortUrl,
      });
    } catch {
      // Ignore cancellation
    }
  }, [canWebShare, shareTitle, shortUrl]);

  // ——— Render ——— //
  if (!isOpen || !item) return null;

  /** Table of basic metadata to display. */
  const meta = [
    ['Type', item.kind],
    ['Start', asDate(item.startTime)],
    ['Peak', asDate(item.peakTime)],
    ['End', asDate(item.endTime)],
    ['Class', item.classType || '—'],
    ['Speed (km/s)', item.speed != null ? String(item.speed) : '—'],
    ['Source', item.sourceLocation || '—'],
  ] as const;

  const timeline = useMemo(() => {
    const t0 = ts(item.startTime);
    const tp = ts(item.peakTime);
    const te = ts(item.endTime);
    const all = [t0, tp, te].filter((v) => typeof v === 'number') as number[];
    if (all.length < 2) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    return { t0, tp, te, min, max };
  }, [item.startTime, item.peakTime, item.endTime]);

  const flareClass = useMemo(() => parseFlareClass(item.classType), [item.classType]);
  const helio = useMemo(() => parseHeliographic(item.sourceLocation), [item.sourceLocation]);
  const speed = typeof item.speed === 'number' && item.speed > 0 ? item.speed : null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="DONKI details"
      onClick={handleMaskClick}
    >
      <div
        ref={panelRef}
        className="absolute inset-x-0 top-[6vh] mx-auto w-[min(900px,94vw)] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Badge kind={item.kind} />
            <h3 className="text-base font-semibold">{item.title || 'Solar event'}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 px-5 py-5 md:grid-cols-5">
          {/* Left column: preview + share + external links */}
          <div className="md:col-span-2">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-gray-50">
              {item.preview ? (
                <img
                  src={item.preview}
                  alt={item.title || 'Solar event'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  No preview
                </div>
              )}
            </div>

            {/* Share section */}
            <div className="mt-4 space-y-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Share link</label>
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
              {error && <p className="text-xs text-amber-600">{error}</p>}

              {/* External references */}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    NASA detail
                  </a>
                )}
                {item.sources?.apiHref && (
                  <a
                    href={item.sources.apiHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    API source
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right column: details and visualizations */}
          <div className="md:col-span-3">
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Details</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {meta.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-gray-900">{v || '—'}</dd>
                  </div>
                ))}
                {Array.isArray(item.instruments) && item.instruments.length > 0 && (
                  <>
                    <dt className="text-gray-500">Instruments</dt>
                    <dd className="text-gray-900">
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.instruments.slice(0, 12).map((ins) => (
                          <span
                            key={ins}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                          >
                            {ins}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </>
                )}
              </dl>
            </section>

            {/* Visualization area */}
            <section className="mt-5 space-y-5">
              {timeline && <TimelineVis timeline={timeline} />}
              {flareClass && <FlareClassMeter klass={flareClass} />}
              {typeof speed === 'number' && <SpeedGauge speed={speed} />}
              {helio && <HeliographicMap coord={helio} />}
            </section>

            {item.note && (
              <section className="mt-5">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Notes</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {item.note}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Visualization Components ---------------- */

/**
 * Visualizes start, peak, and end times on a simple horizontal timeline.
 */
function TimelineVis({
  timeline,
}: {
  timeline: { t0?: number | null; tp?: number | null; te?: number | null; min: number; max: number };
}) {
  const { t0, tp, te, min, max } = timeline;
  const pct = (t?: number | null) => {
    if (typeof t !== 'number') return null;
    if (max === min) return 50;
    return Math.round(((t - min) / (max - min)) * 100);
  };
  const p0 = pct(t0), pp = pct(tp), pe = pct(te);

  return (
    <div>
      <h5 className="mb-2 text-xs font-semibold text-gray-700">Event timeline</h5>
      <div className="relative h-2 w-full rounded bg-gray-200">
        <div className="absolute left-0 top-0 h-2 rounded bg-blue-400" style={{ width: `${(pe ?? pp ?? p0 ?? 0)}%` }} />
        {p0 != null && <Tick label="Start" percent={p0} />}
        {pp != null && <Tick label="Peak" percent={pp} color="bg-amber-500" />}
        {pe != null && <Tick label="End" percent={pe} color="bg-emerald-500" />}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500">
        <span>{new Date(min).toISOString().slice(0, 19).replace('T', ' ')}</span>
        <span>{new Date(max).toISOString().slice(0, 19).replace('T', ' ')}</span>
      </div>
    </div>
  );
}

/**
 * A small vertical tick with label positioned at a percentage along the timeline.
 */
function Tick({ label, percent, color = 'bg-blue-600' }: { label: string; percent: number; color?: string }) {
  return (
    <div className="absolute -top-2 translate-x-[-50%]" style={{ left: `${percent}%` }}>
      <div className={`h-4 w-0.5 ${color}`} />
      <div className="mt-1 -translate-x-1/2 rounded bg-white px-1.5 py-0.5 text-[10px] shadow ring-1 ring-gray-200">
        {label}
      </div>
    </div>
  );
}

/**
 * Displays flare class (A–X) as a colored progress bar.
 */
function FlareClassMeter({ klass }: { klass: { band: 'A'|'B'|'C'|'M'|'X'; value: number; norm: number } }) {
  const colors: Record<typeof klass.band, string> = {
    A: '#9CA3AF', B: '#60A5FA', C: '#34D399', M: '#F59E0B', X: '#EF4444',
  };
  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold text-gray-700">Flare class</h5>
      <div className="flex items-center gap-3">
        <div className="relative h-3 w-full overflow-hidden rounded bg-gray-200">
          <div
            className="h-full"
            style={{ width: `${Math.round(klass.norm * 100)}%`, background: colors[klass.band] }}
          />
        </div>
        <div className="whitespace-nowrap text-sm font-semibold" style={{ color: colors[klass.band] }}>
          {klass.band}{klass.value}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>A</span><span>B</span><span>C</span><span>M</span><span>X</span>
      </div>
    </div>
  );
}

/**
 * Visual gauge showing CME speed on a semicircular meter.
 */
function SpeedGauge({ speed }: { speed: number }) {
  const MAX = 3000;
  const pct = Math.max(0, Math.min(1, speed / MAX));
  const angle = Math.PI * pct;
  const radius = 56;

  const ax = 60 + radius * Math.cos(Math.PI - angle);
  const ay = 60 - radius * Math.sin(Math.PI - angle);

  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold text-gray-700">CME speed</h5>
      <svg viewBox="0 0 120 70" className="w-full">
        <path d="M5,60 A55,55 0 0,1 115,60" fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <path
          d="M5,60 A55,55 0 0,1 115,60"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="10"
          strokeDasharray={`${Math.PI * 55} ${Math.PI * 55}`}
          strokeDashoffset={`${(1 - pct) * Math.PI * 55}`}
          strokeLinecap="round"
        />
        <line x1="60" y1="60" x2={ax} y2={ay} stroke="#111827" strokeWidth="3" />
        <circle cx="60" cy="60" r="4" fill="#111827" />
        <text x="60" y="66" textAnchor="middle" fontSize="10" fill="#6B7280">{`${speed.toFixed(0)} km/s`}</text>
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-gray-500">
        <span>0</span><span>1500</span><span>3000</span>
      </div>
    </div>
  );
}

/**
 * Displays heliographic coordinates (lat/lon) on a solar disk map.
 */
function HeliographicMap({ coord }: { coord: { lat: number; lon: number } }) {
  const r = 48;
  const x = (coord.lon / 90) * r;
  const y = -(coord.lat / 90) * r;

  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold text-gray-700">Heliographic location</h5>
      <svg viewBox="-60 -60 120 120" className="w-40">
        <defs>
          <radialGradient id="gSun" r="60%">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="100%" stopColor="#FDBA74" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r={r} fill="url(#gSun)" stroke="#F59E0B" strokeWidth="1" />
        <line x1={-r} y1="0" x2={r} y2="0" stroke="rgba(0,0,0,.2)" strokeWidth="0.5" />
        <line x1="0" y1={-r} x2="0" y2={r} stroke="rgba(0,0,0,.2)" strokeWidth="0.5" />
        <circle cx={x} cy={y} r="3.5" fill="#111827" />
      </svg>
      <div className="mt-1 text-[11px] text-gray-600">
        Lat: {coord.lat.toFixed(1)}°, Lon: {coord.lon.toFixed(1)}°
      </div>
    </div>
  );
}

/* ---------------- Utility Functions ---------------- */

/**
 * Colored label for event type (FLR, CME, etc.).
 */
function Badge({ kind }: { kind: string }) {
  const theme =
    kind === 'FLR'
      ? { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' }
      : kind === 'CME'
      ? { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' }
      : { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${theme.bg} ${theme.text}`}>
      <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
      {kind}
    </span>
  );
}

/**
 * Formats a timestamp to ISO-like `YYYY-MM-DD hh:mm:ss` or returns raw string.
 */
function asDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Converts date string to timestamp (ms) or null.
 */
function ts(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Parses a flare class string like "M2.3" into structured info.
 *
 * @returns { band, value, norm } where:
 *  - band is one of A/B/C/M/X
 *  - value is the numeric suffix (default 1)
 *  - norm is a normalized 0..1 value for visualization
 */
function parseFlareClass(raw?: string | null):
  | { band: 'A'|'B'|'C'|'M'|'X'; value: number; norm: number }
  | null {
  if (!raw) return null;
  const m = raw.trim().toUpperCase().match(/^([ABC MX])\s*([0-9.]+)?$/);
  if (!m) return null;
  const band = (m[1] as 'A'|'B'|'C'|'M'|'X');
  const value = parseFloat(m[2] ?? '1');
  const base = { A: 0, B: 0.1, C: 0.3, M: 0.6, X: 0.85 }[band];
  const bump = Math.min(0.15, (isFinite(value) ? value : 1) / 10 * 0.15);
  return { band, value: isFinite(value) ? value : 1, norm: Math.min(1, base + bump) };
}

/**
 * Parses heliographic coordinates like "N12W33" into latitude/longitude.
 */
function parseHeliographic(raw?: string | null): { lat: number; lon: number } | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const m = s.match(/^(N|S)?\s*([0-9]{1,2})\s*(E|W)?\s*([0-9]{1,3})$/);
  if (!m) return null;
  const ns = m[1] === 'S' ? -1 : 1;
  const lat = ns * parseInt(m[2] ?? '0', 10);
  const ew = m[3] === 'W' ? -1 : 1;
  const lon = ew * parseInt(m[4] ?? '0', 10);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Keeps keyboard focus trapped within a given root element (accessibility).
 */
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

/**
 * Displays a temporary toast notification.
 */
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
  } catch {}
}

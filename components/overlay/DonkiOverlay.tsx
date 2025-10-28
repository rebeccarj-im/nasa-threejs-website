// components/overlay/DonkiOverlay.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendEvent } from '@/lib/analytics';

/** Keep in sync with /api/data/donki front-end model (minimal subset) */
export type DonkiItem = {
  id: string;
  kind: string; // 'FLR' | 'CME' | ...
  title: string;
  startTime?: string | null;
  peakTime?: string | null;
  endTime?: string | null;
  classType?: string | null;    // e.g. 'X1.2' | 'M2.3'
  speed?: number | null;        // km/s (CME)
  direction?: string | null;    // e.g. 'NE' | 'S30W' | 'ENE' (CME)
  sourceLocation?: string | null; // e.g. 'N12W33'
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

export default function DonkiOverlay({ open, item, onClose, permalink }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevActive = useRef<Element | null>(null);

  const [shortUrl, setShortUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cover (prefer pre-provided preview; otherwise draw via Canvas and cache)
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverKey = useMemo(() => {
    if (!item) return '';
    return [
      item.kind,
      item.id,
      item.startTime ?? '',
      item.classType ?? '',
      String(item.speed ?? ''),
      item.direction ?? '',
      item.sourceLocation ?? '',
    ].join('|');
  }, [item]);
  const thumbCache = useRef<Map<string, string>>(new Map());

  /* ---------------- Keep hook order stable even with early returns ---------------- */

  // Lock page scroll and restore focus while open
  useEffect(() => {
    if (open) {
      prevActive.current = document.activeElement;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
        if (prevActive.current instanceof HTMLElement) prevActive.current.focus();
      };
    }
    return;
  }, [open]);

  // Create short link when opened
  useEffect(() => {
    if (!open || !item) return;

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
            url:
              permalink ||
              (typeof window !== 'undefined' ? window.location.href : ''),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const data = (await res.json()) as
          | { shortUrl?: string; url?: string; shortId?: string }
          | undefined;

        let finalUrl = '';
        if (data?.shortUrl) finalUrl = data.shortUrl;
        else if (data?.url) finalUrl = data.url;
        else if (data?.shortId) finalUrl = `/s/${data.shortId}`;

        if (!finalUrl) {
          finalUrl =
            permalink ||
            (typeof window !== 'undefined' ? window.location.href : '');
          if (alive) setError('Short link service unavailable. Falling back to page URL.');
        }
        if (alive) setShortUrl(finalUrl);
      } catch (e) {
        console.error('[DonkiOverlay] short link failed:', e);
        const fallback =
          permalink ||
          (typeof window !== 'undefined' ? window.location.href : '');
        if (alive) {
          setShortUrl(fallback);
          setError('Short link service unavailable. Falling back to page URL.');
        }
      } finally {
        if (alive) {
          setIsCreating(false);
          setTimeout(() => copyBtnRef.current?.focus(), 0);
        }
      }
    };

    makeShort();
    return () => {
      alive = false;
    };
  }, [open, item, permalink]);

  // Compute cover (preview -> cache -> generate)
  useEffect(() => {
    let alive = true;
    if (!open || !item) {
      setCoverUrl(null);
      return;
    }

    if (item.preview) {
      setCoverUrl(item.preview);
      return;
    }

    const cached = thumbCache.current.get(coverKey);
    if (cached) {
      setCoverUrl(cached);
      return;
    }

    (async () => {
      const url = await drawDonkiThumb(item);
      if (!alive) return;
      if (url) {
        thumbCache.current.set(coverKey, url);
        setCoverUrl(url);
      } else {
        setCoverUrl(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, item, coverKey]);

  // Esc to close / focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Click mask to close
  const handleMaskClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Share helpers
  const canWebShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function';

  const shareTitle = useMemo(
    () => (item?.title ? item.title : 'Shared via Cosmos Oracle'),
    [item?.title]
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
      // Analytics: always include itemId and shortId as strings
      const sid = extractShortId(shortUrl);
      const itemId = item?.id ?? 'unknown';

      await sendEvent({
        type: 'share_copy',
        lib: 'donki',
        itemId,
        shortId: sid,
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
        text: 'Explore solar activity with Cosmos Oracle',
        url: shortUrl,
      });

      // Analytics: always include itemId and shortId as strings
      const sid = extractShortId(shortUrl);
      const itemId = item?.id ?? 'unknown';

      await sendEvent({
        type: 'share_system',
        lib: 'donki',
        itemId,
        shortId: sid,
      });
    } catch {
      // ignore
    }
  }, [canWebShare, shareTitle, shortUrl, item?.id]);

  // —— Memoized derived values
  const meta = useMemo(() => {
    if (!item) return [] as Array<readonly [string, string | null]>;
    return [
      ['Type', item.kind],
      ['Start', asDate(item.startTime)],
      ['Peak', asDate(item.peakTime)],
      ['End', asDate(item.endTime)],
      ['Class', item.classType || '—'],
      ['Speed (km/s)', item.speed != null ? String(item.speed) : '—'],
      ['Source', item.sourceLocation || '—'],
    ] as const;
  }, [item]);

  const timeline = useMemo(() => {
    if (!item)
      return null as null | {
        t0?: number | null;
        tp?: number | null;
        te?: number | null;
        min: number;
        max: number;
      };
    const t0 = ts(item.startTime);
    const tp = ts(item.peakTime);
    const te = ts(item.endTime);
    const all = [t0, tp, te].filter((v) => typeof v === 'number') as number[];
    if (all.length < 2) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    return { t0, tp, te, min, max };
  }, [item]);

  const flareClass = useMemo(() => parseFlareClass(item?.classType), [item?.classType]);
  const helio = useMemo(() => parseHeliographic(item?.sourceLocation), [item?.sourceLocation]);
  const speed = useMemo(
    () => (typeof item?.speed === 'number' && item.speed > 0 ? item.speed : null),
    [item?.speed]
  );

  /* ---------------- Early return (hooks already declared) ---------------- */
  if (!open || !item) return null;

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
        // Constrain height and allow vertical scroll
        className="absolute inset-x-0 top-[6vh] mx-auto w-[min(900px,94vw)] max-h-[88vh] overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Badge kind={item.kind} />
            <h3 className="text-base font-semibold">{item.title || 'Solar event'}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 px-5 py-5 md:grid-cols-5">
          {/* Left: share + sources + preview */}
          <div className="md:col-span-2">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-gray-50">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={item.title || 'Solar event'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  No preview
                </div>
              )}
            </div>

            {/* Share zone */}
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

              {/* External links */}
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

          {/* Right: details + simple visualizations */}
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

            {/* Simplified visuals: flat, solid colors */}
            <section className="mt-5 space-y-5">
              {timeline && <TimelineVisSimple timeline={timeline} />}
              {flareClass && <FlareClassBar klass={flareClass} />}
              {typeof speed === 'number' && <SpeedBar speed={speed} />}
              {helio && <HelioDot coord={helio} />}
            </section>

            {item.note && (
              <section className="mt-5">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Notes</h4>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
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

/* ---------------- Generate cover (in-file, no extra modules) ---------------- */
async function drawDonkiThumb(raw: DonkiItem): Promise<string | null> {
  try {
    const W = 480, H = 360;
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d'); if (!ctx) return null;

    // Solid deep blue background
    ctx.fillStyle = '#0b1224';
    ctx.fillRect(0, 0, W, H);

    if (raw.kind === 'FLR') {
      // Sun (simple solid circle + faint glow)
      const sx = W * 0.42, sy = H * 0.55, sr = 86;
      ctx.fillStyle = 'rgba(245,158,11,0.18)'; // glow
      ctx.beginPath(); ctx.arc(sx, sy, sr * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Sweep arc (solid stroke)
      const baseAng = Math.PI * 0.3;
      const span = Math.PI * 0.45;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(baseAng);
      ctx.beginPath(); ctx.arc(0, 0, sr + 18, -span / 2, span / 2);
      ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.stroke();
      ctx.restore();

      // Class badge
      const cls = (raw.classType || 'C').toUpperCase();
      const col = cls.startsWith('X') ? '#ef4444' : cls.startsWith('M') ? '#f59e0b' : '#60a5fa';
      const cap = `Flare ${cls}`;
      drawBadge(ctx, cap, col, W - 16, 16, 'right');

      // Bottom info
      const t = safeIsoMinute(raw.startTime || '');
      drawInfoPlate(ctx, 14, H - 56, W - 28, 42, `${t}${raw.note ? `  ·  ${raw.note}` : ''}`);
    } else if (raw.kind === 'CME') {
      // Sun (simplified)
      const sx = 80, sy = H * 0.6, sr = 58;
      ctx.fillStyle = 'rgba(59,130,246,0.12)';
      ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Shock cone (simplified)
      const ang = parseDirectionAngle(raw.direction) ?? Math.PI * 0.1;
      const spd = clamp(raw.speed ?? 0, 0, 1500);
      const ratio = spd / 1500;
      const tipR = sr + 10;
      const coneR = 160 + ratio * 120;
      const half = Math.PI * (0.18 + ratio * 0.25);
      const coneColor = lerpColor('#60a5fa', '#ef4444', ratio);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(tipR, 0); ctx.arc(0, 0, coneR, -half, half); ctx.closePath();
      ctx.fillStyle = toRgba(coneColor, 0.18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = coneColor; ctx.stroke();
      ctx.restore();

      // Speed bar (simplified)
      const barX = 140, barY = H - 64, barW = W - barX - 20, barH = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(ctx, barX, barY, barW, barH, 4, true, false);
      ctx.fillStyle = coneColor;
      roundRect(ctx, barX, barY, barW * ratio, barH, 4, true, false);

      // Text + badge
      ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 18px system-ui'; ctx.fillText('CME', 140, 48);
      ctx.fillStyle = '#cbd5e1'; ctx.font = '13px system-ui';
      ctx.fillText(
        `${safeIsoMinute(raw.startTime || '')} · ${raw.speed ?? '—'} km/s${raw.direction ? ' · ' + raw.direction : ''}`,
        140, 68
      );
      drawBadge(ctx, raw.direction || 'Direction', coneColor, W - 16, 16, 'right');
    } else {
      // Other types: simple placeholder
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 28px system-ui';
      ctx.fillText(raw.kind || 'Event', 24, 48);
      ctx.font = '14px system-ui';
      ctx.fillText(safeIsoMinute(raw.startTime || ''), 24, 72);
    }

    return cvs.toDataURL('image/png');
  } catch {
    return null;
  }
}

/* ---------------- Simple visualization components ---------------- */

/** Timeline: gray bar + three dots */
function TimelineVisSimple({
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
      <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
        <span>Timeline</span>
        <span className="text-[10px] text-gray-400">
          {new Date(min).toISOString().slice(0, 19).replace('T', ' ')} → {new Date(max).toISOString().slice(0, 19).replace('T', ' ')}
        </span>
      </div>
      <div className="relative h-2 w-full rounded bg-gray-200">
        {p0 != null && <Dot percent={p0} label="S" className="bg-gray-800" />}
        {pp != null && <Dot percent={pp} label="P" className="bg-amber-600" />}
        {pe != null && <Dot percent={pe} label="E" className="bg-emerald-600" />}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>Start</span><span>Peak</span><span>End</span>
      </div>
    </div>
  );
}

function Dot({ percent, label, className }: { percent: number; label: string; className: string }) {
  return (
    <div className="absolute -top-1.5 translate-x-[-50%]" style={{ left: `${percent}%` }}>
      <div className={`h-3 w-3 rounded-full ${className}`} />
      <div className="mt-1 -translate-x-1/2 text-[10px] text-gray-600">{label}</div>
    </div>
  );
}

/** Flare class bar */
function FlareClassBar({ klass }: { klass: { band: 'A'|'B'|'C'|'M'|'X'; value: number; norm: number } }) {
  const bandColor: Record<typeof klass.band, string> = {
    A: '#9CA3AF', B: '#60A5FA', C: '#34D399', M: '#F59E0B', X: '#EF4444',
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">Flare class</span>
        <span className="text-xs" style={{ color: bandColor[klass.band] }}>
          {klass.band}{klass.value}
        </span>
      </div>
      <div className="h-3 w-full rounded bg-gray-200">
        <div
          className="h-3 rounded"
          style={{ width: `${Math.round(klass.norm * 100)}%`, background: bandColor[klass.band] }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>A</span><span>B</span><span>C</span><span>M</span><span>X</span>
      </div>
    </div>
  );
}

/** CME speed bar */
function SpeedBar({ speed }: { speed: number }) {
  const MAX = 3000;
  const pct = Math.max(0, Math.min(1, speed / MAX));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">CME speed</span>
        <span className="text-xs text-gray-600">{speed.toFixed(0)} km/s</span>
      </div>
      <div className="h-3 w-full rounded bg-gray-200">
        <div className="h-3 rounded bg-blue-500" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>0</span><span>1500</span><span>3000</span>
      </div>
    </div>
  );
}

/** Heliographic location (simple) */
function HelioDot({ coord }: { coord: { lat: number; lon: number } }) {
  const r = 48;
  const x = (coord.lon / 90) * r;
  const y = -(coord.lat / 90) * r;

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-700">Heliographic location</div>
      <svg viewBox="-60 -60 120 120" className="w-40">
        <circle cx="0" cy="0" r={r} fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
        <line x1={-r} y1="0" x2={r} y2="0" stroke="#00000033" strokeWidth="0.5" />
        <line x1="0" y1={-r} x2="0" y2={r} stroke="#00000033" strokeWidth="0.5" />
        <circle cx={x} cy={y} r="3.5" fill="#111827" />
      </svg>
      <div className="mt-1 text-[11px] text-gray-600">
        Lat {coord.lat.toFixed(1)}°, Lon {coord.lon.toFixed(1)}°
      </div>
    </div>
  );
}

/* ---------------- Small UI components / utils ---------------- */

function Badge({ kind }: { kind: string }) {
  const theme =
    kind === 'FLR'
      ? { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' }
      : kind === 'CME'
      ? { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' }
      : { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${theme.bg} ${theme.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
      {kind}
    </span>
  );
}

function asDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function ts(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function parseFlareClass(raw?: string | null):
  | { band: 'A'|'B'|'C'|'M'|'X'; value: number; norm: number }
  | null {
  if (!raw) return null;
  const m = raw.trim().toUpperCase().match(/^([ABCMX])\s*([0-9.]+)?$/);
  if (!m) return null;
  const band = (m[1] as 'A'|'B'|'C'|'M'|'X');
  const valueStr = m[2] ?? '1';
  const value = parseFloat(valueStr);
  const base = { A: 0, B: 0.1, C: 0.3, M: 0.6, X: 0.85 }[band];
  const bump = Math.min(0.15, (isFinite(value) ? value : 1) / 10 * 0.15);
  return { band, value: isFinite(value) ? value : 1, norm: Math.min(1, base + bump) };
}

function parseHeliographic(raw?: string | null): { lat: number; lon: number } | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const m = s.match(/^(N|S)?\s*([0-9]{1,2})\s*(E|W)?\s*([0-9]{1,3})$/);
  if (!m) return null;
  const ns = m[1] === 'S' ? -1 : 1;
  const latStr = m[2] ?? '0';
  const lat = ns * parseInt(latStr, 10);
  const ew = m[3] === 'W' ? -1 : 1;
  const lonStr = m[4] ?? '0';
  const lon = ew * parseInt(lonStr, 10);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { lat, lon };
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
  );
  if (nodes.length === 0) return;

  const first = nodes.item(0);
  const last = nodes.item(nodes.length - 1);
  if (!first || !last) return;

  const active = document.activeElement as HTMLElement | null;
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
  } catch {}
}

/* ---------------- Local helpers (no extra imports) ---------------- */
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill = true, stroke = false
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const num = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function lerpColor(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b), k = clamp(t, 0, 1);
  const r = Math.round(A.r + (B.r - A.r) * k);
  const g = Math.round(A.g + (B.g - A.g) * k);
  const b2 = Math.round(A.b + (B.b - A.b) * k);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1)}`;
}

function toRgba(hex: string, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function safeIsoMinute(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function parseDirectionAngle(dir?: string | null): number | null {
  if (!dir) return null;
  const s = dir.toUpperCase();
  let angle: number | null = null;
  if (s.includes('E')) angle = 0;
  if (s.includes('W')) angle = Math.PI;
  if (s.includes('N')) angle = angle == null ? -Math.PI / 2 : (angle - Math.PI / 2);
  if (s.includes('S')) angle = angle == null ?  Math.PI / 2 : (angle + Math.PI / 2);
  const m = s.match(/(\d{1,3})/);
  if (m?.[1]) {
    const deg = (parseInt(m[1], 10) % 360) * (Math.PI / 180);
    if (s.includes('NE')) angle = -deg;
    else if (s.includes('SE')) angle = deg;
    else if (s.includes('NW')) angle = Math.PI + deg;
    else if (s.includes('SW')) angle = Math.PI - deg;
  }
  return angle;
}

/* ---------------- Canvas drawing helpers ---------------- */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  right: number,
  top: number,
  align: 'right' | 'left' = 'right'
) {
  ctx.save();
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
  const padX = 10;
  const w = ctx.measureText(text).width + padX * 2;
  const x = align === 'right' ? right - w : right;
  ctx.fillStyle = toRgba(color, 0.16);
  ctx.strokeStyle = toRgba(color, 0.55);
  roundRect(ctx, x, top, w, 24, 12, true, true);
  ctx.fillStyle = color;
  ctx.fillText(text, x + padX, top + 16);
  ctx.restore();
}

function drawInfoPlate(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, text: string
) {
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, x, y, w, h, 10, true, false);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText(text, x + 10, y + h - 14);
}

/* ---------------- Extract shortId from a short URL (always string) ---------------- */
function extractShortId(url?: string | null): string {
  if (!url) return '';
  try {
    // supports '/s/xyz' and 'https://host/s/xyz'
    const u = url.startsWith('http') ? new URL(url) : null;
    const path = u ? u.pathname : url;
    const m = path.match(/\/s\/([^/?#]+)/);
    return m?.[1] ?? '';
  } catch {
    return '';
  }
}

// --- keep this at the very bottom of the file ---
export { parseFlareClass, parseHeliographic, clamp };

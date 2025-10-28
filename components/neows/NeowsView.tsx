'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { drawNeowsThumb, type ApproachItem } from './neows-visuals';

/* ---------- /api/data/neows response ---------- */
type NeowsResponse = {
  lib: 'neows';
  items: ApproachItem[];
  top5Hazardous: ApproachItem[];
};

/* ---------- Main component ---------- */
export default function NeowsView() {
  const [data, setData] = useState<NeowsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/data/neows', { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const json = (await res.json()) as NeowsResponse;
        if (!alive) return;
        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load NeoWs data');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { let _ = (alive = false); };
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">NeoWs · Near-Earth Objects</h2>
        <p className="text-sm text-gray-600">Approach timeline, distance vs. size, and Top 5 potentially hazardous objects.</p>
      </header>

      {loading && <Skeleton />}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <ApproachTimeline items={data.items} />
          <ScatterDistanceSize items={data.items} />
          <TopHazardous items={data.top5Hazardous} />
          {/* Example: latest 6 items with thumbnail + mini viz; API consistent with DONKI list */}
          <RecentList items={data.items} />
        </>
      )}

      {!loading && !error && !data && (
        <div className="text-sm text-gray-500">No data.</div>
      )}
    </section>
  );
}

/* ---------- Skeleton ---------- */
function Skeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((k) => (
        <div key={k} className="rounded-lg border bg-white p-4">
          <div className="mb-3 h-4 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-28 w-full animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Approach timeline ---------- */
function ApproachTimeline({ items }: { items: ApproachItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const list = useMemo(
    () => [...items].sort((a, b) => a_epoch(a) - a_epoch(b)).slice(0, 80),
    [items]
  );

  const range = useMemo(() => {
    if (list.length === 0) return { min: 0, max: 1 };
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const it of list) {
      const t = a_epoch(it);
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
    if (max <= min) max = min + 1;
    return { min, max };
  }, [list]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = 800, H = 160;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    cvs.style.width = W + 'px';
    cvs.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    const PAD_L = 60, PAD_R = 12, PAD_T = 16, PAD_B = 26;

    // x-axis
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(PAD_L, H - PAD_B);
    ctx.lineTo(W - PAD_R, H - PAD_B);
    ctx.stroke();

    // ticks
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const t = range.min + ((range.max - range.min) * i) / ticks;
      const x = PAD_L + ((W - PAD_L - PAD_R) * i) / ticks;
      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, H - PAD_B);
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatDate(t), x, H - 8);
    }

    // data points
    list.forEach((it) => {
      const x = PAD_L + ((W - PAD_L - PAD_R) * (a_epoch(it) - range.min)) / (range.max - range.min);
      const y = H / 2 + jitter(it.id);
      const r = clamp(2, 7, it.diameter_km * 5);
      ctx.fillStyle = it.hazardous ? '#ef4444' : '#60a5fa';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });

    // legend
    const legend = [
      { label: 'Hazardous', color: '#ef4444' },
      { label: 'Non-hazardous', color: '#60a5fa' },
    ];
    legend.forEach((lg, i) => {
      const x = PAD_L + i * 130, y = PAD_T;
      ctx.fillStyle = lg.color;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#374151';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lg.label, x + 8, y + 4);
    });
  }, [list, range]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Approach Timeline</h3>
        <span className="text-xs text-gray-500">{list.length} objects</span>
      </div>
      <div className="overflow-x-auto">
        <canvas ref={canvasRef} className="h-[160px] w-[800px]" />
      </div>
      {list.length === 0 && <p className="mt-2 text-sm text-gray-500">No approaches in range.</p>}
    </div>
  );
}

/* ---------- Distance–Size scatter plot ---------- */
function ScatterDistanceSize({ items }: { items: ApproachItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const list = useMemo(() => items.slice(0, 200), [items]);

  const xRange = useMemo(() => {
    if (list.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...list.map((d) => d.distance_lunar));
    const max = Math.max(...list.map((d) => d.distance_lunar));
    return expandRange({ min, max });
  }, [list]);

  const yRange = useMemo(() => {
    if (list.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...list.map((d) => d.diameter_km));
    const max = Math.max(...list.map((d) => d.diameter_km));
    return expandRange({ min, max });
  }, [list]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    const W = 800, H = 260;
    const PAD_L = 50, PAD_R = 12, PAD_T = 10, PAD_B = 28;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(PAD_L, H - PAD_B); ctx.lineTo(W - PAD_R, H - PAD_B); // x
    ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, H - PAD_B); // y
    ctx.stroke();

    // grid
    const gridX = 5, gridY = 4;
    for (let i = 1; i <= gridX; i++) {
      const x = PAD_L + ((W - PAD_L - PAD_R) * i) / gridX;
      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, H - PAD_B); ctx.stroke();
    }
    for (let j = 1; j <= gridY; j++) {
      const y = PAD_T + ((H - PAD_T - PAD_B) * j) / gridY;
      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    }

    // axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= gridX; i++) {
      const vx = xRange.min + ((xRange.max - xRange.min) * i) / gridX;
      const x = PAD_L + ((W - PAD_L - PAD_R) * i) / gridX;
      ctx.fillText(vx.toFixed(0) + ' LD', x, H - 8);
    }
    ctx.save();
    ctx.translate(14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Diameter (km)', 0, 0);
    ctx.restore();

    // points
    list.forEach((d) => {
      const x = map(d.distance_lunar, xRange, { min: PAD_L, max: W - PAD_R });
      const y = map(d.diameter_km, yRange, { min: H - PAD_B, max: PAD_T });
      const r = clamp(2, 7, d.diameter_km * 5);
      ctx.fillStyle = d.hazardous ? '#ef4444' : '#60a5fa';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });

    // reference lines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    const xDanger = map(10, xRange, { min: PAD_L, max: W - PAD_R });
    ctx.beginPath(); ctx.moveTo(xDanger, PAD_T); ctx.lineTo(xDanger, H - PAD_B); ctx.stroke();

    const yDanger = map(0.14, yRange, { min: H - PAD_B, max: PAD_T });
    ctx.beginPath(); ctx.moveTo(PAD_L, yDanger); ctx.lineTo(W - PAD_R, yDanger); ctx.stroke();
  }, [list, xRange, yRange]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Distance vs. Size</h3>
        <span className="text-xs text-gray-500">{list.length} points</span>
      </div>
      <div className="overflow-x-auto">
        <canvas ref={canvasRef} className="h-[260px] w-[800px]" />
      </div>
      {list.length === 0 && <p className="mt-2 text-sm text-gray-500">No scatter data.</p>}
      <div className="mt-2 text-xs text-gray-500">
        Reference lines: <span className="text-red-500">10 LD</span> &amp; <span className="text-red-500">0.14 km</span>
      </div>
    </div>
  );
}

/* ---------- Top 5 potentially hazardous ---------- */
function TopHazardous({ items }: { items: ApproachItem[] }) {
  const list = useMemo(
    () => [...items].sort((a, b) => b.diameter_km - a.diameter_km).slice(0, 5),
    [items]
  );

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">Top 5 Potentially Hazardous</h3>
      {list.length === 0 ? (
        <p className="text-sm text-gray-500">No hazardous objects in this sample.</p>
      ) : (
        <ul className="divide-y text-sm">
          {list.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{o.id}</div>
                <div className="truncate text-xs text-gray-500">
                  {new Date(o.epoch).toISOString()} · {o.distance_lunar.toFixed(1)} LD
                </div>
              </div>
              <div className="text-right">
                <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                  {o.diameter_km.toFixed(3)} km
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Local add-on: NeowsMiniViz (mini visualization) ---------- */
function NeowsMiniViz({ item }: { item: ApproachItem }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = 320, H = 120;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background panel
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e5e7eb';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // simple mapping: distance→x, diameter→y, hazard→color
    const x = map(item.distance_lunar, { min: 0, max: 50 }, { min: 20, max: W - 20 });
    const y = map(item.diameter_km,   { min: 0, max: 0.5 }, { min: H - 20, max: 20 });
    const r = Math.max(3, Math.min(10, item.diameter_km * 20));

    ctx.fillStyle = item.hazardous ? '#ef4444' : '#34d399';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#374151';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.distance_lunar.toFixed(1)} LD`, x, H - 6);
  }, [item]);

  return <canvas ref={canvasRef} className="h-[120px] w-[320px]" />;
}

/* ---------- Recent list (cover + mini viz) ---------- */
function RecentList({ items }: { items: ApproachItem[] }) {
  const list = useMemo(
    () => [...items].sort((a, b) => b.epoch - a.epoch).slice(0, 6),
    [items]
  );

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Approaches</h3>
        <span className="text-xs text-gray-500">{list.length} items</span>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500">No recent approaches.</p>
      ) : (
        <ul className="divide-y text-sm">
          {list.map((it) => (
            <li key={it.id} className="flex gap-3 py-3">
              <NeowsThumb item={it} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.id}</div>
                    <div className="truncate text-xs text-gray-500">
                      {new Date(it.epoch).toISOString().slice(0, 19)}Z · {it.distance_lunar.toFixed(1)} LD
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {it.diameter_km.toFixed(3)} km
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <NeowsMiniViz item={it} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NeowsThumb({ item }: { item: ApproachItem }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await drawNeowsThumb(item);
      if (alive) setSrc(s);
    })();
    return () => { let _ = (alive = false); };
  }, [item]);

  return (
    <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-gray-100 ring-1 ring-gray-200">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

/* ---------- helpers ---------- */
function a_epoch(a: ApproachItem) { return Number.isFinite(a.epoch) ? a.epoch : 0; }
function formatDate(ms: number) { const d = new Date(ms); return d.toISOString().slice(5, 10); } // MM-DD (UTC)
function jitter(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return (h % 15) - 7; }
function clamp(min: number, max: number, v: number) { return Math.max(min, Math.min(max, v)); }
function expandRange(r: { min: number; max: number }) {
  if (!Number.isFinite(r.min) || !Number.isFinite(r.max) || r.max <= r.min) return { min: 0, max: 1 };
  const span = r.max - r.min; const pad = span * 0.08;
  return { min: Math.max(0, r.min - pad), max: r.max + pad };
}
function map(v: number, from: { min: number; max: number }, to: { min: number; max: number }) {
  if (from.max === from.min) return to.min;
  const t = (v - from.min) / (from.max - from.min);
  return to.min + t * (to.max - to.min);
}

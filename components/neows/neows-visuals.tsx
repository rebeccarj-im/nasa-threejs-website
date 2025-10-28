// Pure Canvas version (no React hooks). Safely generate a NEO thumbnail dataURL.

export type ApproachItem = {
  id: string;
  epoch: number;            // ms
  distance_lunar: number;   // L.D.
  diameter_km: number;      // km
  hazardous: boolean;
};

export async function drawNeowsThumb(raw: ApproachItem): Promise<string | null> {
  try {
    const W = 480, H = 360;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d');
    if (!ctx) return null;

    // Background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1726');
    g.addColorStop(1, '#142a41');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Stars
    let seed = 0;
    for (const ch of `${raw.id}|${raw.epoch}`) seed = (seed * 131 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0, (seed & 0xffff) / 0xffff);
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * H, r = 0.4 + rnd() * 1.2;
      ctx.globalAlpha = 0.2 + rnd() * 0.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#dbeafe'; ctx.fill();
    }
    ctx.restore();

    // Earth
    const ex = W * 0.25, ey = H * 0.68, er = 44;
    const eg = ctx.createRadialGradient(ex - 10, ey - 10, 8, ex, ey, er);
    eg.addColorStop(0, '#93c5fd'); eg.addColorStop(1, '#2563eb');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();

    // Moon orbit (schematic)
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(ex, ey, er * 3.2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Moon
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.arc(ex + er * 3.2, ey, 10, 0, Math.PI * 2); ctx.fill();

    // NEO trajectory
    const p0 = { x: ex - W * 0.15, y: ey + H * 0.22 };
    const p1 = { x: ex + W * 0.65, y: ey - H * 0.38 };
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

    // Closest-approach point
    const t = clamp(raw.distance_lunar / 10, 0, 1);
    const px = lerp(p0.x, p1.x, 0.15 + 0.7 * t);
    const py = lerp(p0.y, p1.y, 0.15 + 0.7 * t);

    // Color by hazard
    const col = raw.hazardous ? '#ef4444' : '#10b981';

    // Target size by diameter
    const r = 4 + Math.min(10, Math.max(4, raw.diameter_km * 0.8));
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

    // Guide line & labels
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.setLineDash([3, 3]); ctx.beginPath();
    ctx.moveTo(px, py); ctx.lineTo(px, ey); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText('NEO', ex + 110, 48);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px system-ui';
    const when = isFinite(+raw.epoch) ? new Date(raw.epoch).toISOString().slice(0, 19).replace('T', ' ') + 'Z' : 'Unknown';
    ctx.fillText(`${when} · ${fmt(raw.distance_lunar, 2)} L.D. · ${fmt(raw.diameter_km, 3)} km`, ex + 110, 70);

    // Distance bar
    const bx = 110, by = H - 52, bw = W - bx - 24, bh = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(ctx, bx, by, bw, bh, 6, true, false);
    ctx.fillStyle = col; roundRect(ctx, bx, by, bw * clamp(raw.distance_lunar / 10, 0, 1), bh, 6, true, false);

    return cvs.toDataURL('image/png');
  } catch {
    return null;
  }
}

/* ---------- Utilities ---------- */
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function fmt(v: number, d = 1) { return Number.isFinite(v) ? v.toFixed(d) : 'n/a'; }
function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
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

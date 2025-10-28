'use client';

import React, { useEffect, useRef } from 'react';
import {
  roundRect, clamp, lerpColor, toRgba, safeIsoMinute, lerp,
} from '@/components/viz/common';

/* ───────────────────────── Types ───────────────────────── */
export type CMEItem = {
  type: 'cme';
  id: string;
  startTime: string;     // ISO string
  speed?: number;        // km/s
  direction?: string;    // e.g. NE / S30W / ENE ...
  note?: string | null;
};

export type FlareItem = {
  type: 'flare';
  id: string;
  startTime: string;     // ISO string
  classType?: string;    // X / M / C...
  region?: string | null; // Active region
  note?: string | null;
};

export type DonkiMerged = CMEItem | FlareItem;

/* ───────────────── drawDonkiThumb: Generate Thumbnail ──────────────── */
export async function drawDonkiThumb(raw: DonkiMerged): Promise<string | null> {
  try {
    const W = 480, H = 360;
    const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d'); if (!ctx) return null;

    // Background gradient + stars
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a1023'); bg.addColorStop(1, '#13233f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Simple star particles
    let seed = 0; for (const ch of `${raw.type}|${raw.id}|${(raw as any).startTime ?? ''}`) seed = (seed * 131 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0, (seed & 0xffff) / 0xffff);
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * H * 0.9, r = 0.4 + rnd() * 1.2;
      ctx.globalAlpha = 0.25 + rnd() * 0.55;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#dbeafe'; ctx.fill();
    }
    ctx.restore();

    if (raw.type === 'flare') {
      const f = raw as FlareItem;

      // Sun
      const sx = W * 0.42, sy = H * 0.55, sr = 86;
      const corona = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.2);
      corona.addColorStop(0, 'rgba(251,191,36,0.35)');
      corona.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();

      const sun = ctx.createRadialGradient(sx - 16, sy - 18, 14, sx, sy, sr);
      sun.addColorStop(0, '#ffd166'); sun.addColorStop(1, '#f59e0b');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Sweep arc
      const baseAng = rnd() * Math.PI * 2;
      const span = Math.PI * (0.35 + rnd() * 0.25);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(baseAng);
      ctx.beginPath(); ctx.arc(0, 0, sr + 22, -span / 2, span / 2); ctx.lineWidth = 18;
      const flareG = ctx.createLinearGradient(-(sr + 22), 0, sr + 22, 0);
      flareG.addColorStop(0, 'rgba(255,255,255,0)');
      flareG.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      flareG.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = flareG; ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 12; ctx.stroke();
      ctx.restore();

      // Hotspot
      const hx = sx + Math.cos(baseAng) * (sr - 6);
      const hy = sy + Math.sin(baseAng) * (sr - 6);
      const hotspot = ctx.createRadialGradient(hx, hy, 2, hx, hy, 16);
      hotspot.addColorStop(0, 'rgba(255,255,255,0.95)');
      hotspot.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hotspot; ctx.beginPath(); ctx.arc(hx, hy, 16, 0, Math.PI * 2); ctx.fill();

      // Class badge
      const cls = (f.classType || 'C').toUpperCase();
      const col = cls.startsWith('X') ? '#ef4444' : cls.startsWith('M') ? '#f59e0b' : '#60a5fa';
      const cap = `Flare ${cls}${f.region ? ` · AR ${f.region}` : ''}`;
      drawBadge(ctx, cap, col, W - 16, 16, 'right');

      // Bottom info bar
      const t = safeIsoMinute(f.startTime);
      drawInfoPlate(ctx, 14, H - 56, W - 28, 42, `${t}${f.note ? `  ·  ${f.note}` : ''}`);
    } else {
      const c = raw as CMEItem;

      // Sun on the left
      const sx = 80, sy = H * 0.6, sr = 58;
      const corona = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.6);
      corona.addColorStop(0, 'rgba(59,130,246,0.25)');
      corona.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(sx, sy, sr * 2.6, 0, Math.PI * 2); ctx.fill();
      const sun = ctx.createRadialGradient(sx - 10, sy - 10, 8, sx, sy, sr);
      sun.addColorStop(0, '#ffd166'); sun.addColorStop(1, '#f59e0b');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Direction angle
      const ang = parseDirectionAngle(c.direction) ?? Math.PI * 0.1;
      const speed = clamp(c.speed ?? 0, 0, 1500);
      const ratio = speed / 1500;

      // Shock cone
      const tipR = sr + 10;
      const coneR = 180 + ratio * 120;
      const half = Math.PI * (0.18 + ratio * 0.25);
      const coneColor = lerpColor('#60a5fa', '#ef4444', ratio);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(tipR, 0); ctx.arc(0, 0, coneR, -half, half); ctx.closePath();
      ctx.fillStyle = toRgba(coneColor, 0.18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = coneColor; ctx.stroke();

      // Arrow tip
      ctx.beginPath(); ctx.moveTo(coneR, 0); ctx.lineTo(coneR - 14, -6); ctx.lineTo(coneR - 14, 6); ctx.closePath();
      ctx.fillStyle = coneColor; ctx.fill();
      ctx.restore();

      // Speed bar
      const barX = 140, barY = H - 64, barW = W - barX - 20, barH = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(ctx, barX, barY, barW, barH, 5, true, false);
      ctx.fillStyle = coneColor;
      roundRect(ctx, barX, barY, barW * ratio, barH, 5, true, false);

      // Text + badge
      ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 18px system-ui'; ctx.fillText('CME', 140, 48);
      ctx.fillStyle = '#cbd5e1'; ctx.font = '13px system-ui';
      ctx.fillText(`${safeIsoMinute(c.startTime)} · ${c.speed ?? '—'} km/s${c.direction ? ' · ' + c.direction : ''}`, 140, 68);
      drawBadge(ctx, c.direction || 'Direction', coneColor, W - 16, 16, 'right');
    }

    return cvs.toDataURL('image/png');
  } catch {
    return null;
  }
}

/* ───────────── DonkiMiniViz: Compact Visualization for List/Popup ──────────── */
export function DonkiMiniViz({ item }: { item: DonkiMerged }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;

    const W = 320, H = 120, dpr = window.devicePixelRatio || 1;
    cvs.width = W * dpr; cvs.height = H * dpr; cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Background panel
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e5e7eb';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    if (item.type === 'flare') {
      const f = item as FlareItem;
      const cls = (f.classType || 'C').toUpperCase();
      const col = cls.startsWith('X') ? '#ef4444' : cls.startsWith('M') ? '#f59e0b' : '#60a5fa';

      // Sun + sweep arc
      const sx = 70, sy = H * 0.62, sr = 26;
      const g = ctx.createRadialGradient(sx - 6, sy - 6, 4, sx, sy, sr);
      g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#f59e0b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath(); ctx.arc(sx, sy, sr + 10, -0.5, 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, sr + 10, -0.35, 0.35);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();

      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px system-ui'; ctx.fillText(`Flare ${cls}`, 120, 42);
      ctx.fillStyle = '#6b7280'; ctx.font = '12px system-ui';
      ctx.fillText(safeIsoMinute(f.startTime) + (f.region ? ` · AR ${f.region}` : ''), 120, 62);
    } else {
      const c = item as CMEItem;
      const speed = clamp(c.speed ?? 0, 0, 1500);
      const ratio = speed / 1500;
      const col = lerpColor('#60a5fa', '#ef4444', ratio);

      ctx.fillStyle = '#f3f4f6'; ctx.fillRect(20, H / 2 - 10, W - 40, 20);
      ctx.fillStyle = col; ctx.fillRect(20, H / 2 - 10, (W - 40) * ratio, 20);

      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px system-ui'; ctx.fillText('CME', 20, 30);
      ctx.fillStyle = '#6b7280'; ctx.font = '12px system-ui';
      ctx.fillText(`${safeIsoMinute(c.startTime)} · ${c.speed ?? '—'} km/s${c.direction ? ' · ' + c.direction : ''}`, 20, 50);
    }
  }, [item]);

  return <canvas ref={canvasRef} className="h-[120px] w-[320px]" />;
}

/* ───────────────────────── Helpers ─────────────────────── */
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
  ctx.fillStyle = '#cbd5e1'; ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText(text, x + 10, y + h - 14);
}

/** Converts direction string (e.g. NE, S30W) to an angle in radians */
function parseDirectionAngle(dir?: string | null): number | null {
  if (!dir) return null;
  const s = dir.toUpperCase();

  // Base direction vector (robust handling)
  let angle: number | null = null;
  if (s.includes('E')) angle = 0;
  if (s.includes('W')) angle = Math.PI;
  if (s.includes('N')) angle = angle == null ? -Math.PI / 2 : (angle - Math.PI / 2);
  if (s.includes('S')) angle = angle == null ? Math.PI / 2 : (angle + Math.PI / 2);

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

/** Fix: trim spaces to avoid incorrect matches */
export function parseFlareClass(raw?: string | null):
  | { band: 'A'|'B'|'C'|'M'|'X'; value: number; norm: number }
  | null {
  if (!raw) return null;
  const m = raw.trim().toUpperCase().match(/^([ABCMX])\s*([0-9.]+)?$/);
  if (!m) return null;
  const band = (m[1] as 'A'|'B'|'C'|'M'|'X');
  const valueStr = m[2] ?? '1';
  const value = parseFloat(valueStr);
  // Map flare intensity to segment: A(0)→B(0.1)→C(0.3)→M(0.6)→X(1)
  const base = { A: 0, B: 0.1, C: 0.3, M: 0.6, X: 0.85 }[band];
  const bump = Math.min(0.15, (isFinite(value) ? value : 1) / 10 * 0.15);
  return { band, value: isFinite(value) ? value : 1, norm: Math.min(1, base + bump) };
}

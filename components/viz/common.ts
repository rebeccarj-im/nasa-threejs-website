// common tools

/* ---------- Canvas geometry ---------- */
export function roundRect(
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

/* ---------- Math ---------- */
export function map(v:number, from:{min:number;max:number}, to:{min:number;max:number}) {
  if (from.max === from.min) return to.min;
  const t = (v - from.min) / (from.max - from.min);
  return to.min + t * (to.max - to.min);
}
export function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }
export function clamp(v: number, lo: number, hi: number){ return Math.max(lo, Math.min(hi, v)); }
export function lerp(a:number, b:number, t:number){ return a + (b - a) * t; }

/* ---------- Colors ---------- */
export function toRgba(rgb: string, a: number) {
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(rgb)) {
    return rgb.replace('rgb', 'rgba').replace(')', `,${a})`);
  }
  return rgb;
}
export function parseHexColor(hex: string): [number, number, number] {
  const s = hex.replace('#','');
  const r = parseInt(s.slice(0,2),16);
  const g = parseInt(s.slice(2,4),16);
  const b = parseInt(s.slice(4,6),16);
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ];
}
export function lerpColor(c1: string, c2: string, t: number) {
  const [r1, g1, b1] = parseHexColor(c1);
  const [r2, g2, b2] = parseHexColor(c2);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r},${g},${b})`;
}

/* ---------- Random ---------- */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0, (s & 0xffff) / 0xffff);
}

/* ---------- Time ---------- */
export function safeIsoDate(s?: string | number | null): string {
  if (s == null || s === '') return '';
  const d = new Date(s as any);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}
export function safeIsoMinute(s?: string | number | null): string {
  if (s == null || s === '') return 'Unknown';
  const d = new Date(s as any);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 16) : 'Unknown';
}
export function safeIsoSecond(s?: string | number | null): string {
  if (s == null || s === '') return 'Unknown';
  const d = new Date(s as any);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 19) + 'Z' : 'Unknown';
}

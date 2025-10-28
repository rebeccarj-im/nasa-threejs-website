export function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v | 0));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;

  // Use non-null assertions or explicit checks
  const rStr = m[1];
  const gStr = m[2];
  const bStr = m[3];

  // Explicitly ensure the strings exist
  if (!rStr || !gStr || !bStr) return null;

  return {
    r: parseInt(rStr, 16),
    g: parseInt(gStr, 16),
    b: parseInt(bStr, 16),
  };
}

// Luminance (BT.709)
export function luminance(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
}

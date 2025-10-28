// The luminance function in colors.ts should be implemented like this
export function luminance(r: number, g: number, b: number): number {
  // Ensure inputs are valid numbers
  const validR = typeof r === 'number' && !isNaN(r) ? r : 0;
  const validG = typeof g === 'number' && !isNaN(g) ? g : 0;
  const validB = typeof b === 'number' && !isNaN(b) ? b : 0;

  const result = 0.2126 * validR + 0.7152 * validG + 0.0722 * validB;
  return Math.max(0, Math.min(255, Math.round(result)));
}

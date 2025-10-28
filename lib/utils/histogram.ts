// colors.ts 中的 luminance 函数应该这样实现
export function luminance(r: number, g: number, b: number): number {
  // 确保输入是有效的数字
  const validR = typeof r === 'number' && !isNaN(r) ? r : 0;
  const validG = typeof g === 'number' && !isNaN(g) ? g : 0;
  const validB = typeof b === 'number' && !isNaN(b) ? b : 0;
  
  const result = 0.2126 * validR + 0.7152 * validG + 0.0722 * validB;
  return Math.max(0, Math.min(255, Math.round(result)));
}
// tests/unit/utils.spec.ts
import { describe, it, expect } from 'vitest';

// Import directly from the component exports (exported at the bottom of the component)
import {
  parseHeliographic,
  parseFlareClass,
  clamp,
} from '@/components/overlay/DonkiOverlay';

describe('parseFlareClass', () => {
  it('parses band and number', () => {
    const r = parseFlareClass('M2.5');
    expect(r).toMatchObject({ band: 'M', value: 2.5 });
    expect(r!.norm).toBeGreaterThan(0.6);
  });

  it('accepts band only', () => {
    expect(parseFlareClass('C')).toMatchObject({ band: 'C', value: 1 });
  });

  it('rejects invalid', () => {
    expect(parseFlareClass('Z9')).toBeNull();
  });
});

describe('parseHeliographic', () => {
  it('N12W33 → lat +, lon -', () => {
    expect(parseHeliographic('N12W33')).toEqual({ lat: 12, lon: -33 });
  });
  it('S05E20 → lat -, lon +', () => {
    expect(parseHeliographic('S05E20')).toEqual({ lat: -5, lon: 20 });
  });
  it('invalid → null', () => {
    expect(parseHeliographic('abc')).toBeNull();
  });
});

describe('clamp', () => {
  it('works on boundaries', () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(3, 0, 5)).toBe(3);
  });
});

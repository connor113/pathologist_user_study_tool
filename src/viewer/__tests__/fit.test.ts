import { describe, it, expect } from 'vitest';
import { checkFitsAt5x, calculateStartLevel, calculateFit } from '../fit';

describe('checkFitsAt5x', () => {
  // At 5x, downsample = 40/5 = 8
  // So display pixels = slide pixels / 8

  it('returns true when slide fits in container', () => {
    // 10000/8 = 1250 wide, 8000/8 = 1000 tall → fits in 1920×1080
    expect(checkFitsAt5x(10000, 8000, 1920, 1080)).toBe(true);
  });

  it('returns false when slide is too wide', () => {
    // 20000/8 = 2500 wide → exceeds 1920
    expect(checkFitsAt5x(20000, 8000, 1920, 1080)).toBe(false);
  });

  it('returns false when slide is too tall', () => {
    // 10000/8 = 1250 wide (ok), 10000/8 = 1250 tall → exceeds 1080
    expect(checkFitsAt5x(10000, 10000, 1920, 1080)).toBe(false);
  });

  it('returns true at exact boundary', () => {
    // 1920*8 = 15360 wide, 1080*8 = 8640 tall → exactly fits
    expect(checkFitsAt5x(15360, 8640, 1920, 1080)).toBe(true);
  });

  it('returns false when one pixel over boundary', () => {
    expect(checkFitsAt5x(15361, 8640, 1920, 1080)).toBe(false);
  });
});

describe('calculateStartLevel', () => {
  it('returns 5 when slide fits at 5x', () => {
    expect(calculateStartLevel(10000, 8000, 1920, 1080)).toBe(5);
  });

  it('returns 2.5 when slide does not fit at 5x', () => {
    // Real-world large slide: 147184×49960
    expect(calculateStartLevel(147184, 49960, 1920, 1080)).toBe(2.5);
  });
});

describe('calculateFit', () => {
  it('returns full result object for a fitting slide', () => {
    const result = calculateFit(10000, 8000, 1920, 1080);
    expect(result).toEqual({
      fitsAt5x: true,
      startLevel: 5,
      containerWidth: 1920,
      containerHeight: 1080,
      displayWidthAt5x: 1250,
      displayHeightAt5x: 1000,
    });
  });

  it('returns full result object for a non-fitting slide', () => {
    const result = calculateFit(147184, 49960, 1920, 1080);
    expect(result.fitsAt5x).toBe(false);
    expect(result.startLevel).toBe(2.5);
    expect(result.displayWidthAt5x).toBe(147184 / 8);
    expect(result.displayHeightAt5x).toBe(49960 / 8);
  });
});

import { describe, it, expect } from 'vitest';
import { hashUserId, seededShuffle } from '../SlideQueue';

describe('hashUserId', () => {
  it('returns a deterministic value', () => {
    const a = hashUserId('user-abc-123');
    const b = hashUserId('user-abc-123');
    expect(a).toBe(b);
  });

  it('returns different values for different inputs', () => {
    const a = hashUserId('user-aaa');
    const b = hashUserId('user-bbb');
    expect(a).not.toBe(b);
  });

  it('returns a non-negative number', () => {
    const inputs = ['a', 'test', '550e8400-e29b-41d4-a716-446655440000', ''];
    for (const input of inputs) {
      expect(hashUserId(input)).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles UUID-shaped strings', () => {
    const hash = hashUserId('550e8400-e29b-41d4-a716-446655440000');
    expect(typeof hash).toBe('number');
    expect(Number.isFinite(hash)).toBe(true);
  });
});

describe('seededShuffle', () => {
  const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  it('same seed produces same order', () => {
    const a = seededShuffle(items, 'user-1');
    const b = seededShuffle(items, 'user-1');
    expect(a).toEqual(b);
  });

  it('different seed produces different order', () => {
    const a = seededShuffle(items, 'user-1');
    const b = seededShuffle(items, 'user-2');
    // Extremely unlikely to be the same with 8 items
    expect(a).not.toEqual(b);
  });

  it('preserves all elements', () => {
    const result = seededShuffle(items, 'user-1');
    expect(result.sort()).toEqual([...items].sort());
    expect(result.length).toBe(items.length);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    seededShuffle(items, 'user-1');
    expect(items).toEqual(original);
  });

  it('handles empty array', () => {
    expect(seededShuffle([], 'user-1')).toEqual([]);
  });

  it('handles single element', () => {
    expect(seededShuffle(['only'], 'user-1')).toEqual(['only']);
  });

  it('handles two elements', () => {
    const result = seededShuffle(['A', 'B'], 'user-1');
    expect(result.sort()).toEqual(['A', 'B']);
  });
});

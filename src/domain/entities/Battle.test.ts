import { describe, it, expect } from 'vitest';
import { calculateDamage } from './Battle.js';

describe('calculateDamage', () => {
  it('returns attack - defense when attack > defense', () => {
    expect(calculateDamage(84, 78)).toBe(6);
  });

  it('returns 1 when attack - defense equals 0 (minimum is 1)', () => {
    expect(calculateDamage(50, 50)).toBe(1);
  });

  it('returns 1 when attack - defense is negative', () => {
    expect(calculateDamage(84, 88)).toBe(1);
  });
});

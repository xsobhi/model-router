import { sum } from './money.js';

export const TAX_PERCENT = 8;
const EXEMPT_CATEGORIES = ['grocery'];

export function taxableCents(lines) {
  return sum(
    lines
      .filter((line) => !(line.category in EXEMPT_CATEGORIES))
      .map((line) => line.priceCents * line.qty),
  );
}

export function taxCents(lines) {
  return Math.round((taxableCents(lines) * TAX_PERCENT) / 100);
}

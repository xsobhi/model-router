import { sum } from './money.js';

export const FREE_SHIPPING_MIN_CENTS = 5000;
const BASE_CENTS = 499;
const FREE_GRAMS = 1000;
const STEP_GRAMS = 500;
const STEP_CENTS = 100;

export function shippingCents(lines, discountedSubtotalCents) {
  if (lines.length === 0) return 0;
  if (discountedSubtotalCents >= FREE_SHIPPING_MIN_CENTS) return 0;
  const grams = sum(lines.map((line) => line.weightG * line.qty));
  const extraSteps = Math.ceil(Math.max(0, grams - FREE_GRAMS) / STEP_GRAMS);
  return BASE_CENTS + extraSteps * STEP_CENTS;
}

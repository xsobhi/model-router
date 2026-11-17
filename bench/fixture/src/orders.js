import { applyDiscount } from './discounts.js';
import { taxCents } from './tax.js';
import { shippingCents } from './shipping.js';

export function checkout(cart, { coupon } = {}) {
  if (cart.isEmpty()) throw new Error('Cannot check out an empty cart');
  const lines = cart.lines();
  const subtotalCents = cart.subtotalCents();
  const { code, discountCents } = applyDiscount(subtotalCents, coupon);
  const discounted = subtotalCents - discountCents;
  const tax = taxCents(lines);
  const shipping = shippingCents(lines, discounted);
  return {
    lines,
    coupon: code,
    subtotalCents,
    discountCents,
    taxCents: tax,
    shippingCents: shipping,
    totalCents: discounted + tax + shipping,
  };
}

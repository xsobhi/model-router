import { isValidCouponFormat } from './validate.js';

const COUPONS = {
  SAVE10: (subtotal) => Math.round(subtotal * 0.1),
  FIVEOFF: (subtotal) => (subtotal >= 2000 ? 500 : 0),
};

export function applyDiscount(subtotalCents, code) {
  if (code === undefined || code === null) return { code: null, discountCents: 0 };
  if (!isValidCouponFormat(code) || !COUPONS[code]) throw new Error(`Invalid coupon: ${code}`);
  const discountCents = Math.min(subtotalCents, COUPONS[code](subtotalCents));
  return { code, discountCents };
}

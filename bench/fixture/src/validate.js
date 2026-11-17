import { CATALOG } from './catalog.js';

export function isValidQty(qty) {
  return Number.isInteger(qty) && qty >= 1 && qty <= 99;
}

export function isValidSku(sku) {
  return Object.hasOwn(CATALOG, sku);
}

export function isValidCouponFormat(code) {
  return typeof code === 'string' && /^[A-Z0-9]{4,12}$/.test(code);
}

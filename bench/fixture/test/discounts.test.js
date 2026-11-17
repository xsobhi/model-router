import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from '../src/discounts.js';

test('no coupon means no discount', () => {
  assert.deepEqual(applyDiscount(5000), { code: null, discountCents: 0 });
});

test('SAVE10 takes 10% rounded half up', () => {
  assert.equal(applyDiscount(1000, 'SAVE10').discountCents, 100);
  assert.equal(applyDiscount(1005, 'SAVE10').discountCents, 101);
});

test('FIVEOFF needs a 2000 cent subtotal', () => {
  assert.equal(applyDiscount(1999, 'FIVEOFF').discountCents, 0);
  assert.equal(applyDiscount(2000, 'FIVEOFF').discountCents, 500);
});

test('a discount never exceeds the subtotal', () => {
  assert.equal(applyDiscount(0, 'SAVE10').discountCents, 0);
});

test('unknown or malformed coupons throw', () => {
  assert.throws(() => applyDiscount(1000, 'NOPE10'), /Invalid coupon/);
  assert.throws(() => applyDiscount(1000, 'bad'), /Invalid coupon/);
});

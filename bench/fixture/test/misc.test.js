import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, formatMoney, sum } from '../src/money.js';
import { isValidQty, isValidSku, isValidCouponFormat } from '../src/validate.js';
import { Cart } from '../src/cart.js';
import { checkout } from '../src/orders.js';
import { receiptText } from '../src/receipt.js';

test('toCents rounds dollars to integer cents', () => {
  assert.equal(toCents(1.005 + 0.001), 101);
  assert.equal(toCents(12), 1200);
});

test('formatMoney pads cents and handles negatives', () => {
  assert.equal(formatMoney(5), '$0.05');
  assert.equal(formatMoney(12345), '$123.45');
  assert.equal(formatMoney(-250), '-$2.50');
});

test('sum of an empty list is 0', () => {
  assert.equal(sum([]), 0);
  assert.equal(sum([1, 2, 3]), 6);
});

test('validators', () => {
  assert.equal(isValidQty(0), false);
  assert.equal(isValidQty(99), true);
  assert.equal(isValidQty(100), false);
  assert.equal(isValidQty(1.5), false);
  assert.equal(isValidSku('MUG-1'), true);
  assert.equal(isValidSku('toString'), false);
  assert.equal(isValidCouponFormat('SAVE10'), true);
  assert.equal(isValidCouponFormat('save10'), false);
  assert.equal(isValidCouponFormat('AB'), false);
});

test('receipt lists lines, discount and totals', () => {
  const cart = new Cart().addItem('MUG-1', 2).addItem('LMP-1');
  const text = receiptText(checkout(cart, { coupon: 'FIVEOFF' }));
  const rows = text.split('\n');
  assert.equal(rows[0], '2 x Mug  $24.00');
  assert.equal(rows[1], '1 x Lamp  $35.00');
  assert.equal(rows[2], 'Subtotal  $59.00');
  assert.equal(rows[3], 'Discount  -$5.00');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../src/cart.js';
import { checkout } from '../src/orders.js';

test('checkout refuses an empty cart', () => {
  assert.throws(() => checkout(new Cart()), /empty cart/);
});

test('plain order: subtotal, tax, shipping and total', () => {
  const order = checkout(new Cart().addItem('MUG-1', 2));
  assert.equal(order.subtotalCents, 2400);
  assert.equal(order.discountCents, 0);
  assert.equal(order.taxCents, 192);
  assert.equal(order.shippingCents, 499);
  assert.equal(order.totalCents, 3091);
});

test('grocery is not taxed at checkout', () => {
  const order = checkout(new Cart().addItem('APL-1', 5).addItem('BRD-1'));
  assert.equal(order.subtotalCents, 950);
  assert.equal(order.taxCents, 0);
  assert.equal(order.totalCents, 950 + 599);
});

test('coupon lowers the total but not the tax', () => {
  const order = checkout(new Cart().addItem('MUG-1', 2), { coupon: 'SAVE10' });
  assert.equal(order.discountCents, 240);
  assert.equal(order.taxCents, 192);
  assert.equal(order.totalCents, 2400 - 240 + 192 + 499);
});

test('repeat adds are priced as one bigger line', () => {
  const cart = new Cart().addItem('NTB-1', 2).addItem('NTB-1', 2);
  const order = checkout(cart);
  assert.equal(order.subtotalCents, 1996);
  assert.equal(order.taxCents, 160);
});

test('free shipping uses the discounted subtotal', () => {
  const big = checkout(new Cart().addItem('LMP-1', 2).addItem('PEN-1'), { coupon: 'SAVE10' });
  assert.equal(big.subtotalCents, 7199);
  assert.equal(big.shippingCents, 0);
  // Mug x4 + Bread x2 = 5500; FIVEOFF brings it to exactly 5000, which ships free.
  const edge = checkout(new Cart().addItem('MUG-1', 4).addItem('BRD-1', 2), { coupon: 'FIVEOFF' });
  assert.equal(edge.shippingCents, 0);
});

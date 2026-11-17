import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../src/cart.js';
import { checkout } from '../src/orders.js';
import * as report from '../src/report.js';

const orders = () => [
  checkout(new Cart().addItem('MUG-1', 2).addItem('APL-1', 4)),
  checkout(new Cart().addItem('LMP-1').addItem('MUG-1').addItem('MUG-1')),
  checkout(new Cart().addItem('PEN-1', 5).addItem('BRD-1')),
];

test('summarize of no orders', () => {
  assert.deepEqual(report.summarize([]), { orderCount: 0, revenueCents: 0, averageOrderCents: 0 });
});

test('summarize totals revenue across orders', () => {
  const s = report.summarize(orders());
  assert.equal(s.orderCount, 3);
  assert.equal(s.revenueCents, 3671 + 6372 + 1924);
  assert.equal(s.averageOrderCents, 3989);
});

test('revenueByCategory sums line totals', () => {
  assert.deepEqual(report.revenueByCategory(orders()), {
    home: 2400 + 3500 + 2400,
    grocery: 480 + 350,
    stationery: 995,
  });
});

test('topSkus ranks by revenue, highest first', () => {
  const top = report.topSkus(orders(), 3);
  assert.deepEqual(top.map((t) => t.sku), ['MUG-1', 'LMP-1', 'PEN-1']);
  assert.deepEqual(top[0], { sku: 'MUG-1', name: 'Mug', units: 4, revenueCents: 4800 });
});

test('topSkus defaults to 3 entries', () => {
  assert.equal(report.topSkus(orders()).length, 3);
});

test('topSkus returns everything when n is large, nothing when n <= 0', () => {
  assert.equal(report.topSkus(orders(), 50).length, 5);
  assert.deepEqual(report.topSkus(orders(), 0), []);
  assert.deepEqual(report.topSkus(orders(), -2), []);
});

test('topSkus breaks revenue ties by SKU', () => {
  // MUG-1 x1 and APL-1 x10 both earn 1200 cents.
  const tie = [checkout(new Cart().addItem('MUG-1').addItem('APL-1', 10).addItem('PEN-1'))];
  assert.deepEqual(report.topSkus(tie, 3).map((t) => t.sku), ['APL-1', 'MUG-1', 'PEN-1']);
});

test('topSkus does not modify the orders', () => {
  const o = orders();
  const copy = structuredClone(o);
  report.topSkus(o, 3);
  assert.deepEqual(o, copy);
});

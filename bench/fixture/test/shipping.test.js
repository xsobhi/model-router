import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shippingCents } from '../src/shipping.js';
import { getProduct } from '../src/catalog.js';

const line = (sku, qty) => ({ ...getProduct(sku), qty });

test('an empty cart ships free', () => {
  assert.equal(shippingCents([], 0), 0);
});

test('light orders pay the flat rate', () => {
  assert.equal(shippingCents([line('PEN-1', 2)], 398), 499);
});

test('every started 500 g above 1000 g adds 100 cents', () => {
  assert.equal(shippingCents([line('LMP-1', 1)], 3500), 599);
  assert.equal(shippingCents([line('LMP-1', 1), line('MUG-1', 1)], 4700), 699);
});

test('exactly 1000 g is still the flat rate', () => {
  assert.equal(shippingCents([line('BRD-1', 2)], 700), 499);
});

test('discounted subtotals of 5000 cents or more ship free', () => {
  assert.equal(shippingCents([line('LMP-1', 2)], 5000), 0);
  assert.equal(shippingCents([line('LMP-1', 2)], 4999), 899);
});

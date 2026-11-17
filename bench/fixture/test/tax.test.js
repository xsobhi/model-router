import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxableCents, taxCents } from '../src/tax.js';
import { getProduct } from '../src/catalog.js';

const line = (sku, qty) => ({ ...getProduct(sku), qty });

test('non-exempt lines are taxed at 8%', () => {
  assert.equal(taxCents([line('MUG-1', 1)]), 96);
});

test('grocery is exempt', () => {
  assert.equal(taxableCents([line('APL-1', 10), line('BRD-1', 2)]), 0);
  assert.equal(taxCents([line('APL-1', 10)]), 0);
});

test('mixed carts only tax the non-exempt part', () => {
  const lines = [line('BRD-1', 2), line('NTB-1', 1)];
  assert.equal(taxableCents(lines), 499);
  assert.equal(taxCents(lines), 40);
});

test('tax rounds to the nearest cent', () => {
  assert.equal(taxCents([line('PEN-1', 1)]), 16);
  assert.equal(taxCents([line('PEN-1', 3)]), 48);
});

test('no lines, no tax', () => {
  assert.equal(taxCents([]), 0);
});

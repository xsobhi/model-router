import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../src/cart.js';

test('new cart is empty with zero subtotal', () => {
  const cart = new Cart();
  assert.equal(cart.isEmpty(), true);
  assert.equal(cart.subtotalCents(), 0);
});

test('addItem adds a line with the catalog price', () => {
  const cart = new Cart().addItem('MUG-1', 2);
  assert.deepEqual(cart.lines().map((l) => [l.sku, l.qty]), [['MUG-1', 2]]);
  assert.equal(cart.subtotalCents(), 2400);
});

test('adding the same SKU twice adds the quantities', () => {
  const cart = new Cart().addItem('PEN-1', 2).addItem('PEN-1', 3);
  assert.equal(cart.lines().length, 1);
  assert.equal(cart.lines()[0].qty, 5);
  assert.equal(cart.subtotalCents(), 995);
});

test('addItem rejects bad quantities and unknown SKUs', () => {
  const cart = new Cart();
  assert.throws(() => cart.addItem('PEN-1', 0), RangeError);
  assert.throws(() => cart.addItem('PEN-1', 100), RangeError);
  assert.throws(() => cart.addItem('NOPE-1'), /Unknown SKU/);
});

test('removeItem drops the whole line', () => {
  const cart = new Cart().addItem('PEN-1', 2).addItem('MUG-1').removeItem('PEN-1');
  assert.deepEqual(cart.lines().map((l) => l.sku), ['MUG-1']);
});

test('lines() returns copies', () => {
  const cart = new Cart().addItem('PEN-1');
  cart.lines()[0].qty = 50;
  assert.equal(cart.lines()[0].qty, 1);
});

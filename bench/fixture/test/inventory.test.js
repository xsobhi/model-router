import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { Cart } from '../src/cart.js';

test('available is zero for unknown SKUs', () => {
  assert.equal(new Inventory().available('MUG-1'), 0);
});

test('restock adds to the stock', () => {
  const inv = new Inventory({ 'MUG-1': 2 });
  inv.restock('MUG-1', 3);
  assert.equal(inv.available('MUG-1'), 5);
});

test('reserveCart takes stock for every line', () => {
  const inv = new Inventory({ 'MUG-1': 5, 'PEN-1': 10 });
  inv.reserveCart(new Cart().addItem('MUG-1', 2).addItem('PEN-1', 4));
  assert.equal(inv.available('MUG-1'), 3);
  assert.equal(inv.available('PEN-1'), 6);
});

test('reserveCart is all-or-nothing', () => {
  const inv = new Inventory({ 'MUG-1': 5, 'PEN-1': 1 });
  const cart = new Cart().addItem('MUG-1', 2).addItem('PEN-1', 4);
  assert.throws(() => inv.reserveCart(cart), /Out of stock: PEN-1/);
  assert.equal(inv.available('MUG-1'), 5);
});

test('a cart that adds the same SKU twice reserves the combined quantity', () => {
  const inv = new Inventory({ 'MUG-1': 4 });
  const cart = new Cart().addItem('MUG-1', 2).addItem('MUG-1', 2);
  inv.reserveCart(cart);
  assert.equal(inv.available('MUG-1'), 0);
  assert.throws(() => inv.reserveCart(new Cart().addItem('MUG-1')), /Out of stock/);
});

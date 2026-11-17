import { getProduct } from './catalog.js';
import { isValidQty } from './validate.js';
import { sum } from './money.js';

export class Cart {
  #lines = new Map();

  addItem(sku, qty = 1) {
    if (!isValidQty(qty)) throw new RangeError('qty must be an integer from 1 to 99');
    const product = getProduct(sku);
    const line = this.#lines.get(sku);
    if (line) {
      line.qty = qty;
    } else {
      this.#lines.set(sku, { ...product, qty });
    }
    return this;
  }

  removeItem(sku) {
    this.#lines.delete(sku);
    return this;
  }

  lines() {
    return [...this.#lines.values()].map((line) => ({ ...line }));
  }

  isEmpty() {
    return this.#lines.size === 0;
  }

  subtotalCents() {
    return sum(this.lines().map((line) => line.priceCents * line.qty));
  }
}

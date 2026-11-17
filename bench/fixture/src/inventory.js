export class Inventory {
  #stock;

  constructor(initial = {}) {
    this.#stock = new Map(Object.entries(initial));
  }

  available(sku) {
    return this.#stock.get(sku) ?? 0;
  }

  restock(sku, qty) {
    this.#stock.set(sku, this.available(sku) + qty);
  }

  // All-or-nothing: either every line of the cart is reserved or nothing changes.
  reserveCart(cart) {
    const lines = cart.lines();
    const short = lines.filter((line) => this.available(line.sku) < line.qty);
    if (short.length > 0) {
      throw new Error(`Out of stock: ${short.map((line) => line.sku).join(', ')}`);
    }
    for (const line of lines) this.#stock.set(line.sku, this.available(line.sku) - line.qty);
  }
}

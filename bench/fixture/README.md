# shopcalc

Tiny order-pricing library: a cart, coupons, tax, shipping, checkout, stock reservation and sales reports. Money is always integer cents.

Rules:

- Tax is 8% of the non-exempt lines (price x qty), rounded half up. Grocery is tax-exempt. Coupons do not change the tax base.
- Shipping is a flat 499 cents plus 100 cents for every started 500 g above 1000 g of total weight. An empty cart ships free.
  An order ships free when its discounted subtotal is at least 5000 cents.
- Coupons: `SAVE10` takes 10% off (rounded half up); `FIVEOFF` takes 500 cents off orders of at least 2000 cents. A discount never exceeds the subtotal.
- `Cart.addItem` for a SKU that is already in the cart adds to its quantity.

Run the tests with `npm test`.

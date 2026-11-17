# Feature request: best sellers report

Add `topSkus(orders, n = 3)` to `src/report.js` and export it from `src/index.js`.

- `orders` are the objects returned by `checkout()`.
- Returns the `n` best-selling SKUs across all orders, ranked by revenue (`priceCents * qty`, summed over every line of every order), highest first. Ties are broken by SKU, alphabetically.
- Each entry is `{ sku, name, units, revenueCents }`.
- `n` larger than the number of SKUs returns all of them. `n <= 0` returns `[]`.
- It must not modify the orders passed in.

Tests are already in `test/report.test.js`.

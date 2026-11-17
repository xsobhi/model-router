import { sum } from './money.js';

export function summarize(orders) {
  const revenueCents = sum(orders.map((order) => order.totalCents));
  return {
    orderCount: orders.length,
    revenueCents,
    averageOrderCents: orders.length === 0 ? 0 : Math.round(revenueCents / orders.length),
  };
}

export function revenueByCategory(orders) {
  const byCategory = {};
  for (const order of orders) {
    for (const line of order.lines) {
      byCategory[line.category] = (byCategory[line.category] ?? 0) + line.priceCents * line.qty;
    }
  }
  return byCategory;
}

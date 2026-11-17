import { formatMoney } from './money.js';

export function receiptText(order) {
  const rows = order.lines.map(
    (line) => `${line.qty} x ${line.name}  ${formatMoney(line.priceCents * line.qty)}`,
  );
  rows.push(`Subtotal  ${formatMoney(order.subtotalCents)}`);
  if (order.discountCents > 0) rows.push(`Discount  -${formatMoney(order.discountCents)}`);
  rows.push(`Tax  ${formatMoney(order.taxCents)}`);
  rows.push(`Shipping  ${formatMoney(order.shippingCents)}`);
  rows.push(`Total  ${formatMoney(order.totalCents)}`);
  return rows.join('\n');
}

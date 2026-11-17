export const toCents = (dollars) => Math.round(dollars * 100);

export const sum = (values) => values.reduce((a, b) => a + b, 0);

export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

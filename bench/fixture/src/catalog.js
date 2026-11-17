export const CATALOG = {
  'APL-1': { name: 'Apple', priceCents: 120, category: 'grocery', weightG: 150 },
  'BRD-1': { name: 'Bread', priceCents: 350, category: 'grocery', weightG: 500 },
  'MUG-1': { name: 'Mug', priceCents: 1200, category: 'home', weightG: 400 },
  'LMP-1': { name: 'Lamp', priceCents: 3500, category: 'home', weightG: 1500 },
  'NTB-1': { name: 'Notebook', priceCents: 499, category: 'stationery', weightG: 300 },
  'PEN-1': { name: 'Pen', priceCents: 199, category: 'stationery', weightG: 20 },
};

export function getProduct(sku) {
  const product = CATALOG[sku];
  if (!product) throw new Error(`Unknown SKU: ${sku}`);
  return { sku, ...product };
}

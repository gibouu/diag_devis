export function makeDefaultPrices(diagnostics) {
  return diagnostics.reduce((acc, diag) => {
    acc[diag.id] = { base: 0, rent: 0, sale: 0 };
    return acc;
  }, {});
}

export function seedSpecDefaults(prices) {
  return JSON.parse(JSON.stringify(prices));
}

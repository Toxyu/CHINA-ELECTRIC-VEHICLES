function toCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new RangeError("Amounts must be finite and non-negative.");
  return Math.round(numeric * 100);
}

export function calculateCommercialDiscount(price, kind, value) {
  const priceCents = toCents(price);
  const discountCents = kind === "PERCENT"
    ? Math.round(priceCents * Number(value) / 100)
    : toCents(value);
  if (!Number.isFinite(discountCents) || discountCents < 0) throw new RangeError("Discount must be finite and non-negative.");
  return Math.min(priceCents, discountCents) / 100;
}

export function calculateQuoteTotal({ vehiclePrice, discountAmount, exportCosts, freight, insurance, taxesAndDuties }) {
  return (
    toCents(vehiclePrice) -
    toCents(discountAmount) +
    toCents(exportCosts) +
    toCents(freight) +
    toCents(insurance) +
    toCents(taxesAndDuties)
  ) / 100;
}

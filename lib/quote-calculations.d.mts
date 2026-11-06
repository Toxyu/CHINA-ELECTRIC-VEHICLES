export function calculateCommercialDiscount(price: number | string, kind: "PERCENT" | "FIXED", value: number | string): number;
export function calculateQuoteTotal(amounts: {
  vehiclePrice: number | string;
  discountAmount: number | string;
  exportCosts: number | string;
  freight: number | string;
  insurance: number | string;
  taxesAndDuties: number | string;
}): number;

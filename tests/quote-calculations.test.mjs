import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommercialDiscount, calculateQuoteTotal } from "../lib/quote-calculations.mjs";

test("percentage commercial discount rounds to cents and stays within vehicle price", () => {
  assert.equal(calculateCommercialDiscount(100.05, "PERCENT", 10), 10.01);
  assert.equal(calculateCommercialDiscount(100, "PERCENT", 150), 100);
});

test("fixed commercial discount cannot exceed vehicle price", () => {
  assert.equal(calculateCommercialDiscount(99.99, "FIXED", 25), 25);
  assert.equal(calculateCommercialDiscount(99.99, "FIXED", 150), 99.99);
});

test("quote total adds verified costs and keeps sub-cent binary floats out", () => {
  assert.equal(calculateQuoteTotal({
    vehiclePrice: 100.05,
    discountAmount: 10.01,
    exportCosts: 5.25,
    freight: 3.1,
    insurance: 0.1 + 0.2,
    taxesAndDuties: 0,
  }), 98.69);
});

test("negative or non-finite amounts are rejected", () => {
  assert.throws(() => calculateCommercialDiscount(100, "FIXED", -1), RangeError);
  assert.throws(() => calculateQuoteTotal({
    vehiclePrice: 100, discountAmount: 0, exportCosts: 0, freight: -1, insurance: 0, taxesAndDuties: 0,
  }), RangeError);
});

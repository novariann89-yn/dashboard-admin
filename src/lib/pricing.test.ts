import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  changeDue,
  computeTotals,
  marginPercent,
  paymentStatusFor,
  roundToStep,
} from "./pricing";

describe("roundToStep", () => {
  it("rounds to the nearest step", () => {
    assert.equal(roundToStep(12345, 100), 12300);
    assert.equal(roundToStep(12350, 100), 12400);
  });

  it("falls back to whole numbers for invalid steps", () => {
    assert.equal(roundToStep(1234.6, 0), 1235);
    assert.equal(roundToStep(1234.6, Number.NaN), 1235);
  });
});

describe("computeTotals", () => {
  it("applies rounding and reports the adjustment", () => {
    const totals = computeTotals({
      subtotal: 12345,
      roundingEnabled: true,
      roundingStep: 100,
    });
    assert.equal(totals.finalTotal, 12300);
    assert.equal(totals.roundingAdjust, -45);
  });

  it("skips rounding when disabled", () => {
    const totals = computeTotals({
      subtotal: 12345,
      roundingEnabled: false,
      roundingStep: 100,
    });
    assert.equal(totals.finalTotal, 12345);
    assert.equal(totals.roundingAdjust, 0);
  });

  it("never returns a negative total", () => {
    const totals = computeTotals({
      subtotal: 1000,
      discountTotal: 5000,
      roundingEnabled: false,
      roundingStep: 100,
    });
    assert.equal(totals.finalTotal, 0);
  });
});

describe("marginPercent", () => {
  it("returns null when cost or price is not usable", () => {
    assert.equal(marginPercent(0, 1000), null);
    assert.equal(marginPercent(5000, 0), null);
  });

  it("computes margin against the sell price", () => {
    assert.equal(marginPercent(5000, 3000), 40);
  });
});

describe("changeDue / paymentStatusFor", () => {
  it("floors change at zero", () => {
    assert.equal(changeDue(10000, 7000), 0);
    assert.equal(changeDue(10000, 13000), 3000);
  });

  it("classifies payment status", () => {
    assert.equal(paymentStatusFor(10000, 10000), "paid");
    assert.equal(paymentStatusFor(10000, 5000), "partial");
    assert.equal(paymentStatusFor(10000, 0), "unpaid");
  });
});

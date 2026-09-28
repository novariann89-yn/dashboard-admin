import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTotals,
  changeDue,
  marginPercent,
  paymentStatusFor,
  roundToStep,
} from "./pricing";

describe("roundToStep", () => {
  it("rounds to the nearest step", () => {
    assert.equal(roundToStep(1249, 500), 1000);
    assert.equal(roundToStep(1250, 500), 1500);
    assert.equal(roundToStep(10000, 500), 10000);
  });

  it("falls back to whole numbers for invalid steps", () => {
    assert.equal(roundToStep(1249.4, 0), 1249);
    assert.equal(roundToStep(1249.6, 1), 1250);
  });
});

describe("computeTotals", () => {
  it("applies rounding to the nearest 500", () => {
    const totals = computeTotals({
      subtotal: 12500,
      roundingEnabled: true,
      roundingStep: 500,
    });
    assert.equal(totals.finalTotal, 12500);
    assert.equal(totals.roundingAdjust, 0);
  });

  it("computes positive rounding adjustment", () => {
    const totals = computeTotals({
      subtotal: 12300,
      roundingEnabled: true,
      roundingStep: 500,
    });
    assert.equal(totals.finalTotal, 12500);
    assert.equal(totals.roundingAdjust, 200);
  });

  it("can be disabled", () => {
    const totals = computeTotals({
      subtotal: 12300,
      roundingEnabled: false,
      roundingStep: 500,
    });
    assert.equal(totals.finalTotal, 12300);
    assert.equal(totals.roundingAdjust, 0);
  });

  it("applies discounts before rounding", () => {
    const totals = computeTotals({
      subtotal: 20000,
      discountTotal: 1000,
      roundingEnabled: true,
      roundingStep: 500,
    });
    assert.equal(totals.discountTotal, 1000);
    assert.equal(totals.finalTotal, 19000);
  });

  it("never goes below zero", () => {
    const totals = computeTotals({
      subtotal: 1000,
      discountTotal: 5000,
      roundingEnabled: true,
      roundingStep: 500,
    });
    assert.equal(totals.finalTotal, 0);
  });
});

describe("marginPercent", () => {
  it("computes margin from sell and cost price", () => {
    assert.equal(marginPercent(5000, 3000), 40);
    assert.equal(marginPercent(10000, 6000), 40);
  });

  it("returns null when data is incomplete", () => {
    assert.equal(marginPercent(5000, 0), null);
    assert.equal(marginPercent(0, 3000), null);
  });
});

describe("change and payment status", () => {
  it("computes change due", () => {
    assert.equal(changeDue(10000, 20000), 10000);
    assert.equal(changeDue(10000, 10000), 0);
    assert.equal(changeDue(10000, 5000), 0);
  });

  it("derives payment status", () => {
    assert.equal(paymentStatusFor(10000, 10000), "paid");
    assert.equal(paymentStatusFor(10000, 12000), "paid");
    assert.equal(paymentStatusFor(10000, 5000), "partial");
    assert.equal(paymentStatusFor(10000, 0), "unpaid");
  });
});
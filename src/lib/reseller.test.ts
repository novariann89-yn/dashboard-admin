import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { levelMarginWarning, resolveResellerPrice } from "./reseller";

const levels = [
  { id: "dasar", name: "Reseller Dasar", minBottles: 24, active: true, prices: { kecil: 4200 } },
  { id: "menengah", name: "Reseller Menengah", minBottles: 48, active: true, prices: { kecil: 4000 } },
  { id: "besar", name: "Reseller Besar", minBottles: 100, active: true, prices: { kecil: 3800 } },
];

describe("resolveResellerPrice", () => {
  it("picks the highest tier reached by total bottles", () => {
    const result = resolveResellerPrice({
      totalBottles: 60,
      moq: 24,
      levels,
      lockedLevelId: null,
      variantId: "kecil",
      fallbackPrice: 4500,
    });
    assert.equal(result.price, 4000);
    assert.equal(result.levelId, "menengah");
    assert.equal(result.eligible, true);
    assert.equal(result.reason, "tier");
  });

  it("is not eligible below MOQ", () => {
    const result = resolveResellerPrice({
      totalBottles: 10,
      moq: 24,
      levels,
      lockedLevelId: null,
      variantId: "kecil",
      fallbackPrice: 4500,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "below-moq");
  });

  it("uses the locked level even for small orders", () => {
    const result = resolveResellerPrice({
      totalBottles: 2,
      moq: 24,
      levels,
      lockedLevelId: "besar",
      variantId: "kecil",
      fallbackPrice: 4500,
    });
    assert.equal(result.price, 3800);
    assert.equal(result.eligible, true);
    assert.equal(result.reason, "locked");
  });

  it("falls back to the base reseller price when the tier has no price", () => {
    const result = resolveResellerPrice({
      totalBottles: 60,
      moq: 24,
      levels,
      lockedLevelId: null,
      variantId: "besar",
      fallbackPrice: 8500,
    });
    assert.equal(result.price, 8500);
    assert.equal(result.levelId, "menengah");
  });

  it("falls back to the base reseller price when no levels are configured", () => {
    const result = resolveResellerPrice({
      totalBottles: 5,
      moq: 1,
      levels: [],
      lockedLevelId: null,
      variantId: "kecil",
      fallbackPrice: 4500,
    });
    assert.equal(result.price, 4500);
    assert.equal(result.eligible, true);
    assert.equal(result.reason, "base");
  });

  it("ignores inactive levels", () => {
    const inactive = levels.map((level) =>
      level.id === "menengah" ? { ...level, active: false } : level,
    );
    const result = resolveResellerPrice({
      totalBottles: 60,
      moq: 24,
      levels: inactive,
      lockedLevelId: null,
      variantId: "kecil",
      fallbackPrice: 4500,
    });
    assert.equal(result.price, 4200);
    assert.equal(result.levelId, "dasar");
  });
});

describe("levelMarginWarning", () => {
  it("warns when the price is at or below cost + 10%", () => {
    assert.equal(levelMarginWarning(3000, 3000), true);
    assert.equal(levelMarginWarning(3200, 3000), true);
    assert.equal(levelMarginWarning(4000, 3000), false);
  });

  it("warns when data is missing", () => {
    assert.equal(levelMarginWarning(0, 3000), true);
    assert.equal(levelMarginWarning(4000, 0), true);
  });
});
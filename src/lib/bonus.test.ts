import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPurchase } from "./bonus";

describe("applyPurchase", () => {
  it("increments progress below threshold", () => {
    assert.deepEqual(applyPurchase(0, 10), { progress: 1, bonusEarned: false, bonusesEarned: 0 });
    assert.deepEqual(applyPurchase(8, 10), { progress: 9, bonusEarned: false, bonusesEarned: 0 });
  });

  it("resets to zero when threshold is reached", () => {
    assert.deepEqual(applyPurchase(9, 10), { progress: 0, bonusEarned: true, bonusesEarned: 1 });
  });

  it("keeps remainder when threshold is exceeded", () => {
    assert.deepEqual(applyPurchase(14, 10), { progress: 5, bonusEarned: true, bonusesEarned: 1 });
  });

  it("handles threshold of 1 as a bonus every purchase", () => {
    assert.deepEqual(applyPurchase(0, 1), { progress: 0, bonusEarned: true, bonusesEarned: 1 });
  });

  it("ignores invalid thresholds and just increments", () => {
    assert.deepEqual(applyPurchase(3, 0), { progress: 4, bonusEarned: false, bonusesEarned: 0 });
    assert.deepEqual(applyPurchase(3, -1), { progress: 4, bonusEarned: false, bonusesEarned: 0 });
  });

  it("treats negative progress as zero", () => {
    assert.deepEqual(applyPurchase(-5, 10), { progress: 1, bonusEarned: false, bonusesEarned: 0 });
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profitPerUnit } from "./products";

describe("profitPerUnit", () => {
  it("uses the owner-set snapshot when positive", () => {
    assert.equal(
      profitPerUnit({ netProfitSnapshot: 2500, unitPrice: 10000, unitCost: 6000 }),
      2500,
    );
  });

  it("falls back to price minus cost when snapshot is missing or zero", () => {
    assert.equal(
      profitPerUnit({ netProfitSnapshot: undefined, unitPrice: 10000, unitCost: 6000 }),
      4000,
    );
    assert.equal(
      profitPerUnit({ netProfitSnapshot: 0, unitPrice: 5000, unitCost: 3000 }),
      2000,
    );
  });
});

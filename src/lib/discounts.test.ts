import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDiscount, type DiscountContext, type DiscountLine } from "./discounts";
import type { DiscountRule } from "./types";

const lines: DiscountLine[] = [
  { variantId: "kecil", productId: "sari", category: "Minuman", qty: 2, unitPrice: 5000 },
  { variantId: "besar", productId: "sari", category: "Minuman", qty: 1, unitPrice: 10000 },
];

function rule(partial: Partial<DiscountRule>): DiscountRule {
  return {
    id: partial.id ?? "r1",
    name: partial.name ?? "Aturan",
    appliesTo: partial.appliesTo ?? "umum",
    targetType: partial.targetType ?? "all",
    targetId: partial.targetId ?? null,
    conditionType: partial.conditionType ?? "none",
    conditionValue: partial.conditionValue ?? 0,
    effectType: partial.effectType ?? "percent",
    effectValue: partial.effectValue ?? 10,
    bonusVariantId: partial.bonusVariantId ?? null,
    bonusQty: partial.bonusQty ?? 0,
    priority: partial.priority ?? 10,
    startsAt: partial.startsAt ?? null,
    endsAt: partial.endsAt ?? null,
    active: partial.active ?? true,
    createdAt: 0,
    ...partial,
  };
}

function ctx(overrides: Partial<DiscountContext>): DiscountContext {
  return {
    buyerType: "umum",
    lines,
    rules: [],
    variantSellPrices: { kecil: 5000, besar: 10000 },
    ...overrides,
  };
}

describe("computeDiscount", () => {
  it("applies a percentage to the whole cart", () => {
    const result = computeDiscount(
      ctx({ rules: [rule({ effectType: "percent", effectValue: 10 })] }),
    );
    assert.equal(result.discountTotal, 2000);
    assert.equal(result.ruleName, "Aturan");
    assert.equal(result.lineDiscounts.kecil + result.lineDiscounts.besar, 2000);
  });

  it("applies a fixed amount capped at the subtotal", () => {
    const result = computeDiscount(
      ctx({ rules: [rule({ effectType: "amount", effectValue: 999999 })] }),
    );
    assert.equal(result.discountTotal, 20000);
  });

  it("applies a special price only to targeted variants", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({
            effectType: "special_price",
            effectValue: 4000,
            targetType: "variant",
            targetId: "kecil",
          }),
        ],
      }),
    );
    assert.equal(result.discountTotal, 2000);
    assert.equal(result.lineDiscounts.kecil, 2000);
    assert.equal(result.lineDiscounts.besar, undefined);
  });

  it("adds a bonus product without reducing the total", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({
            effectType: "bonus_product",
            bonusVariantId: "kecil",
            bonusQty: 1,
            conditionType: "min_bottles",
            conditionValue: 3,
          }),
        ],
      }),
    );
    assert.equal(result.discountTotal, 0);
    assert.deepEqual(result.bonusItems, [{ variantId: "kecil", qty: 1 }]);
  });

  it("multiplies bonuses for every N bottles", () => {
    const many: DiscountLine[] = [
      { variantId: "kecil", productId: "sari", category: "Minuman", qty: 25, unitPrice: 5000 },
    ];
    const result = computeDiscount(
      ctx({
        lines: many,
        rules: [
          rule({
            effectType: "bonus_product",
            bonusVariantId: "kecil",
            bonusQty: 1,
            conditionType: "multiple_bottles",
            conditionValue: 10,
          }),
        ],
      }),
    );
    assert.deepEqual(result.bonusItems, [{ variantId: "kecil", qty: 2 }]);
  });

  it("picks the most valuable rule and does not stack", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({ id: "a", name: "10%", effectType: "percent", effectValue: 10 }),
          rule({ id: "b", name: "Potong 3000", effectType: "amount", effectValue: 3000 }),
        ],
      }),
    );
    assert.equal(result.ruleId, "b");
    assert.equal(result.discountTotal, 3000);
  });

  it("breaks ties by priority", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({ id: "a", effectType: "amount", effectValue: 2000, priority: 1 }),
          rule({ id: "b", effectType: "amount", effectValue: 2000, priority: 9 }),
        ],
      }),
    );
    assert.equal(result.ruleId, "b");
  });

  it("ignores rules for other buyer types, inactive rules and unmet conditions", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({ id: "a", appliesTo: "member", effectType: "amount", effectValue: 5000 }),
          rule({ id: "b", active: false, effectType: "amount", effectValue: 5000 }),
          rule({
            id: "c",
            conditionType: "min_bottles",
            conditionValue: 10,
            effectType: "amount",
            effectValue: 5000,
          }),
        ],
      }),
    );
    assert.equal(result.ruleId, null);
    assert.equal(result.discountTotal, 0);
  });

  it("ignores expired rules", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({
            effectType: "amount",
            effectValue: 5000,
            startsAt: 1000,
            endsAt: 2000,
          }),
        ],
        now: 3000,
      }),
    );
    assert.equal(result.ruleId, null);
  });

  it("compares bonus value using the sell price", () => {
    const result = computeDiscount(
      ctx({
        rules: [
          rule({ id: "persen", effectType: "percent", effectValue: 10 }),
          rule({
            id: "bonus",
            effectType: "bonus_product",
            bonusVariantId: "besar",
            bonusQty: 1,
            conditionType: "min_bottles",
            conditionValue: 1,
          }),
        ],
      }),
    );
    assert.equal(result.ruleId, "bonus");
    assert.deepEqual(result.bonusItems, [{ variantId: "besar", qty: 1 }]);
  });
});
import type { BuyerType, DiscountRule } from "./types";

export interface DiscountLine {
  variantId: string;
  productId: string;
  category: string;
  qty: number;
  unitPrice: number;
}

export interface DiscountContext {
  buyerType: BuyerType;
  lines: DiscountLine[];
  rules: DiscountRule[];
  variantSellPrices: Record<string, number>;
  now?: number;
}

export interface DiscountOutcome {
  ruleId: string | null;
  ruleName: string | null;
  discountTotal: number;
  lineDiscounts: Record<string, number>;
  bonusItems: { variantId: string; qty: number }[];
}

export const EMPTY_DISCOUNT: DiscountOutcome = {
  ruleId: null,
  ruleName: null,
  discountTotal: 0,
  lineDiscounts: {},
  bonusItems: [],
};

function matchesTarget(rule: DiscountRule, line: DiscountLine): boolean {
  switch (rule.targetType) {
    case "all":
      return true;
    case "product":
      return line.productId === rule.targetId;
    case "variant":
      return line.variantId === rule.targetId;
    case "category":
      return line.category === rule.targetId;
    default:
      return false;
  }
}

function conditionMet(
  rule: DiscountRule,
  targetQty: number,
  targetAmount: number,
): boolean {
  switch (rule.conditionType) {
    case "none":
      return true;
    case "min_bottles":
      return targetQty >= rule.conditionValue;
    case "min_amount":
      return targetAmount >= rule.conditionValue;
    case "multiple_bottles":
      return targetQty >= rule.conditionValue;
    default:
      return false;
  }
}

function distribute(
  total: number,
  lines: DiscountLine[],
): Record<string, number> {
  const result: Record<string, number> = {};
  const base = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  if (base <= 0 || total <= 0) return result;

  let allocated = 0;
  lines.forEach((line, index) => {
    const share =
      index === lines.length - 1
        ? total - allocated
        : Math.round((total * (line.unitPrice * line.qty)) / base);
    allocated += share;
    result[line.variantId] = (result[line.variantId] ?? 0) + share;
  });

  return result;
}

function buildOutcome(
  rule: DiscountRule,
  targeted: DiscountLine[],
  ctx: DiscountContext,
): DiscountOutcome | null {
  const targetQty = targeted.reduce((sum, line) => sum + line.qty, 0);
  const targetAmount = targeted.reduce(
    (sum, line) => sum + line.unitPrice * line.qty,
    0,
  );

  switch (rule.effectType) {
    case "percent": {
      const total = Math.min(
        targetAmount,
        Math.round((targetAmount * rule.effectValue) / 100),
      );
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        discountTotal: total,
        lineDiscounts: distribute(total, targeted),
        bonusItems: [],
      };
    }
    case "amount": {
      const total = Math.min(targetAmount, Math.max(0, rule.effectValue));
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        discountTotal: total,
        lineDiscounts: distribute(total, targeted),
        bonusItems: [],
      };
    }
    case "special_price": {
      const lineDiscounts: Record<string, number> = {};
      let total = 0;
      for (const line of targeted) {
        const diff = Math.max(0, line.unitPrice - rule.effectValue) * line.qty;
        lineDiscounts[line.variantId] =
          (lineDiscounts[line.variantId] ?? 0) + diff;
        total += diff;
      }
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        discountTotal: total,
        lineDiscounts,
        bonusItems: [],
      };
    }
    case "bonus_product": {
      if (!rule.bonusVariantId || rule.bonusQty <= 0) return null;
      const multiplier =
        rule.conditionType === "multiple_bottles" && rule.conditionValue > 0
          ? Math.floor(targetQty / rule.conditionValue)
          : 1;
      const qty = multiplier * rule.bonusQty;
      if (qty <= 0) return null;
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        discountTotal: 0,
        lineDiscounts: {},
        bonusItems: [{ variantId: rule.bonusVariantId, qty }],
      };
    }
    default:
      return null;
  }
}

function ruleValue(
  rule: DiscountRule,
  outcome: DiscountOutcome,
  ctx: DiscountContext,
): number {
  if (rule.effectType === "bonus_product") {
    return outcome.bonusItems.reduce(
      (sum, item) =>
        sum + (ctx.variantSellPrices[item.variantId] ?? 0) * item.qty,
      0,
    );
  }
  return outcome.discountTotal;
}

export function computeDiscount(ctx: DiscountContext): DiscountOutcome {
  const now = ctx.now ?? Date.now();
  let best: { value: number; priority: number; outcome: DiscountOutcome } | null =
    null;

  for (const rule of ctx.rules) {
    if (!rule.active) continue;
    if (rule.appliesTo !== ctx.buyerType) continue;
    if (rule.startsAt !== null && now < rule.startsAt) continue;
    if (rule.endsAt !== null && now > rule.endsAt) continue;

    const targeted = ctx.lines.filter((line) => matchesTarget(rule, line));
    if (targeted.length === 0) continue;

    const targetQty = targeted.reduce((sum, line) => sum + line.qty, 0);
    const targetAmount = targeted.reduce(
      (sum, line) => sum + line.unitPrice * line.qty,
      0,
    );
    if (!conditionMet(rule, targetQty, targetAmount)) continue;

    const outcome = buildOutcome(rule, targeted, ctx);
    if (!outcome) continue;

    const value = ruleValue(rule, outcome, ctx);
    if (value <= 0) continue;

    if (
      !best ||
      value > best.value ||
      (value === best.value && rule.priority > best.priority)
    ) {
      best = { value, priority: rule.priority, outcome };
    }
  }

  return best?.outcome ?? { ...EMPTY_DISCOUNT };
}
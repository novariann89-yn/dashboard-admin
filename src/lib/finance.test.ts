import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  byBuyerType,
  byProduct,
  dailySeries,
  resolvePeriod,
  summarize,
} from "./finance";
import type {
  Expense,
  StockMovement,
  Transaction,
  TransactionItem,
} from "./types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "t1",
    occurredAt: partial.occurredAt ?? 0,
    buyerType: partial.buyerType ?? "umum",
    customerId: null,
    customerName: null,
    subtotal: partial.subtotal ?? 0,
    discountTotal: partial.discountTotal ?? 0,
    discountRuleId: null,
    discountRuleName: null,
    roundingAdjust: partial.roundingAdjust ?? 0,
    finalTotal: partial.finalTotal ?? 0,
    paymentMethod: "cash",
    paymentStatus: "paid",
    paidAmount: partial.finalTotal ?? 0,
    note: null,
    cancelled: partial.cancelled ?? false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: 0,
    ...partial,
  };
}

function item(partial: Partial<TransactionItem>): TransactionItem {
  return {
    id: partial.id ?? Math.random().toString(36),
    transactionId: partial.transactionId ?? "t1",
    variantId: partial.variantId ?? "small",
    productName: partial.productName ?? "Sari Kedelai",
    sizeName: partial.sizeName ?? "Botol Kecil",
    qty: partial.qty ?? 1,
    unitPrice: partial.unitPrice ?? 5000,
    unitCost: partial.unitCost ?? 3000,
    lineDiscount: partial.lineDiscount ?? 0,
    isBonus: partial.isBonus ?? false,
    ...partial,
  };
}

function movement(partial: Partial<StockMovement>): StockMovement {
  return {
    id: partial.id ?? Math.random().toString(36),
    variantId: partial.variantId ?? "small",
    occurredAt: partial.occurredAt ?? 0,
    type: partial.type ?? "damage",
    qty: partial.qty ?? -1,
    refTransactionId: null,
    note: null,
    ...partial,
  };
}

function expense(partial: Partial<Expense>): Expense {
  return {
    id: partial.id ?? Math.random().toString(36),
    occurredAt: partial.occurredAt ?? 0,
    category: partial.category ?? "Bahan Baku",
    amount: partial.amount ?? 0,
    note: null,
    ...partial,
  };
}

const WIB = 7 * 60 * 60 * 1000;
const dayPeriod = resolvePeriod("day", "2026-09-14");
const INSIDE = Date.UTC(2026, 8, 14, 3); // 10:00 WIB
const OUTSIDE = Date.UTC(2026, 8, 12, 3);

describe("resolvePeriod", () => {
  const now = new Date("2026-09-14T07:30:00.000Z");

  it("resolves today in WIB", () => {
    const period = resolvePeriod("today", undefined, now);
    assert.equal(new Date(period.from).toISOString(), "2026-09-13T17:00:00.000Z");
    assert.equal(period.to, period.from + 86400000);
  });

  it("resolves yesterday", () => {
    const period = resolvePeriod("yesterday", undefined, now);
    assert.equal(new Date(period.from).toISOString(), "2026-09-12T17:00:00.000Z");
  });

  it("resolves the last 7 days", () => {
    const period = resolvePeriod("week", undefined, now);
    assert.equal(period.to - period.from, 7 * 86400000);
  });

  it("resolves the calendar month in WIB", () => {
    const period = resolvePeriod("month", undefined, now);
    assert.equal(new Date(period.from).toISOString(), "2026-08-31T17:00:00.000Z");
    assert.equal(new Date(period.to).toISOString(), "2026-09-30T17:00:00.000Z");
  });

  it("resolves a specific day", () => {
    const period = resolvePeriod("day", "2026-09-10", now);
    assert.equal(new Date(period.from).toISOString(), "2026-09-09T17:00:00.000Z");
  });
});

describe("summarize", () => {
  const input = {
    transactions: [tx({ occurredAt: INSIDE, subtotal: 15000, discountTotal: 1000, finalTotal: 14000 })],
    items: [item({ transactionId: "t1", qty: 3, unitPrice: 5000, unitCost: 3000 })],
    movements: [] as StockMovement[],
    expenses: [] as Expense[],
    variantCosts: { small: 3000 },
    period: dayPeriod,
  };

  it("computes the full profit and loss lines", () => {
    const summary = summarize(input);
    assert.equal(summary.grossSales, 15000);
    assert.equal(summary.discount, 1000);
    assert.equal(summary.netSales, 14000);
    assert.equal(summary.rounding, 0);
    assert.equal(summary.netRevenue, 14000);
    assert.equal(summary.hpp, 9000);
    assert.equal(summary.grossProfit, 5000);
    assert.equal(summary.transactionCount, 1);
    assert.equal(summary.bottlesSold, 3);
  });

  it("includes bonus cost in HPP but not in sales", () => {
    const summary = summarize({
      ...input,
      items: [
        item({ transactionId: "t1", qty: 2, unitPrice: 5000, unitCost: 3000 }),
        item({ transactionId: "t1", qty: 1, unitPrice: 0, unitCost: 3000, isBonus: true }),
      ],
    });
    assert.equal(summary.grossSales, 10000);
    assert.equal(summary.hpp, 9000);
    assert.equal(summary.bottlesSold, 2);
    assert.equal(summary.bottlesBonus, 1);
  });

  it("subtracts damage loss and expenses from profit", () => {
    const summary = summarize({
      ...input,
      movements: [movement({ occurredAt: INSIDE, qty: -1, unitCost: 3000 })],
      expenses: [expense({ occurredAt: INSIDE, amount: 2000 })],
    });
    assert.equal(summary.damageLoss, 3000);
    assert.equal(summary.expenses, 2000);
    assert.equal(summary.netProfit, 0);
    assert.equal(summary.marginPercent, 0);
  });

  it("falls back to the current variant cost for damage without a snapshot", () => {
    const summary = summarize({
      ...input,
      movements: [movement({ occurredAt: INSIDE, qty: -2 })],
    });
    assert.equal(summary.damageLoss, 6000);
  });

  it("ignores cancelled and out-of-period records", () => {
    const summary = summarize({
      ...input,
      transactions: [
        ...input.transactions,
        tx({ id: "t2", occurredAt: INSIDE, cancelled: true, finalTotal: 50000 }),
        tx({ id: "t3", occurredAt: OUTSIDE, finalTotal: 50000 }),
      ],
      movements: [movement({ occurredAt: OUTSIDE, qty: -5, unitCost: 3000 })],
      expenses: [expense({ occurredAt: OUTSIDE, amount: 9000 })],
    });
    assert.equal(summary.transactionCount, 1);
    assert.equal(summary.damageLoss, 0);
    assert.equal(summary.expenses, 0);
  });
});

describe("byProduct", () => {
  it("ranks products by profit and includes bonus cost", () => {
    const rows = byProduct({
      transactions: [tx({ id: "t1", occurredAt: INSIDE, finalTotal: 30000 })],
      items: [
        item({ transactionId: "t1", variantId: "small", sizeName: "Kecil", qty: 4, unitPrice: 5000, unitCost: 3000, lineDiscount: 2000 }),
        item({ transactionId: "t1", variantId: "small", sizeName: "Kecil", qty: 1, unitPrice: 0, unitCost: 3000, isBonus: true }),
        item({ transactionId: "t1", variantId: "big", sizeName: "Besar", qty: 1, unitPrice: 10000, unitCost: 9000 }),
      ],
      movements: [],
      expenses: [],
      variantCosts: {},
      period: dayPeriod,
    });

    assert.equal(rows[0].variantId, "small");
    assert.equal(rows[0].revenue, 4 * 5000 - 2000);
    assert.equal(rows[0].cost, 5 * 3000);
    assert.equal(rows[0].qtySold, 4);
    assert.equal(rows[0].qtyBonus, 1);
    assert.equal(rows[1].variantId, "big");
    assert.equal(rows[1].profit, 1000);
  });
});

describe("byBuyerType", () => {
  it("groups revenue and profit per buyer type", () => {
    const rows = byBuyerType({
      transactions: [
        tx({ id: "t1", occurredAt: INSIDE, buyerType: "umum", finalTotal: 10000 }),
        tx({ id: "t2", occurredAt: INSIDE, buyerType: "reseller", finalTotal: 4000 }),
      ],
      items: [
        item({ transactionId: "t1", qty: 2, unitPrice: 5000, unitCost: 3000 }),
        item({ transactionId: "t2", qty: 1, unitPrice: 4000, unitCost: 3000 }),
      ],
      movements: [],
      expenses: [],
      variantCosts: {},
      period: dayPeriod,
    });

    const umum = rows.find((row) => row.buyerType === "umum");
    const reseller = rows.find((row) => row.buyerType === "reseller");
    const member = rows.find((row) => row.buyerType === "member");

    assert.equal(umum?.revenue, 10000);
    assert.equal(umum?.profit, 4000);
    assert.equal(reseller?.profit, 1000);
    assert.equal(member?.transactions, 0);
  });
});

describe("dailySeries", () => {
  it("returns one point per day with totals", () => {
    const series = dailySeries(
      {
        transactions: [
          tx({ id: "t1", occurredAt: INSIDE, finalTotal: 14000 }),
          tx({ id: "t2", occurredAt: INSIDE - 86400000, finalTotal: 5000 }),
        ],
        items: [
          item({ transactionId: "t1", qty: 3, unitPrice: 5000, unitCost: 3000 }),
          item({ transactionId: "t2", qty: 1, unitPrice: 5000, unitCost: 3000 }),
        ],
        movements: [],
        expenses: [],
        variantCosts: {},
      },
      3,
      new Date("2026-09-14T07:30:00.000Z"),
    );

    assert.equal(series.length, 3);
    assert.equal(series[2].date, "2026-09-14");
    assert.equal(series[2].omzet, 14000);
    assert.equal(series[2].laba, 5000);
    assert.equal(series[1].omzet, 5000);
    assert.equal(series[0].omzet, 0);
  });
});
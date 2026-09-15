import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { createDiscountRule, createResellerLevel, setLevelPrice } from "./repos/discounts";
import { createCustomer } from "./repos/customers";
import {
  createProduct,
  createVariant,
  listVariants,
  updateVariant,
} from "./repos/products";
import {
  closeDay,
  getDaySummary,
  recordAddition,
  recordDamage,
  saveOpening,
} from "./repos/stock-days";
import {
  createTransaction,
  listReceivables,
  recordPayment,
} from "./repos/transactions";
import { listReturns, recordReturn } from "./repos/returns";
import { ensureSeeded } from "./seed";
import { updateSettings } from "./settings";
import type { DiscountRule } from "./types";

async function freshDb() {
  try {
    await getDb().delete();
  } catch {
    // ignore
  }
  resetDbInstance();
}

beforeEach(freshDb);

function baseRule(partial: Partial<DiscountRule>): Omit<DiscountRule, "id" | "createdAt"> {
  return {
    name: "Aturan",
    appliesTo: "umum",
    targetType: "all",
    targetId: null,
    conditionType: "none",
    conditionValue: 0,
    effectType: "percent",
    effectValue: 10,
    bonusVariantId: null,
    bonusQty: 0,
    priority: 10,
    startsAt: null,
    endsAt: null,
    active: true,
    ...partial,
  };
}

describe("discounts in transactions", () => {
  it("applies the best rule and stores the rule name", async () => {
    await ensureSeeded();
    await createDiscountRule(baseRule({ name: "Diskon 10%", effectValue: 10 }));
    const [small] = await listVariants(true);

    const result = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 2 }],
    });

    assert.equal(result.transaction.subtotal, 10000);
    assert.equal(result.transaction.discountTotal, 1000);
    assert.equal(result.transaction.finalTotal, 9000);
    assert.equal(result.transaction.discountRuleName, "Diskon 10%");

    const items = await getDb().transactionItems.toArray();
    assert.equal(
      items.reduce((sum, item) => sum + item.lineDiscount, 0),
      1000,
    );
  });

  it("adds bonus items to the transaction and stock", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);
    await createDiscountRule(
      baseRule({
        name: "Beli 3 Gratis 1",
        effectType: "bonus_product",
        effectValue: 0,
        bonusVariantId: small.id,
        bonusQty: 1,
        conditionType: "min_bottles",
        conditionValue: 3,
      }),
    );

    const result = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 3 }],
    });

    assert.equal(result.transaction.discountTotal, 0);
    assert.equal(result.transaction.finalTotal, 15000);
    assert.equal(result.totalCost, 4 * 3000);
    assert.equal(result.marginWarning, false);

    const items = await getDb().transactionItems.toArray();
    const bonus = items.find((item) => item.isBonus);
    assert.ok(bonus);
    assert.equal(bonus?.qty, 1);
    assert.equal(bonus?.unitPrice, 0);
    assert.equal(bonus?.unitCost, 3000);

    const [variant] = await listVariants();
    assert.equal(variant.stock, -4);

    const movements = await getDb().stockMovements.toArray();
    assert.equal(movements.filter((movement) => movement.type === "bonus").length, 1);
  });

  it("flags transactions that fall below the margin guard", async () => {
    await ensureSeeded();
    await createDiscountRule(
      baseRule({ name: "Setengah harga", effectValue: 50 }),
    );
    const [small] = await listVariants(true);

    const result = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 1 }],
    });

    assert.equal(result.transaction.finalTotal, 2500);
    assert.equal(result.totalCost, 3000);
    assert.equal(result.marginWarning, true);
  });
});

describe("reseller tiers", () => {
  it("applies the flat tier price when MOQ is reached", async () => {
    await ensureSeeded();
    await updateSettings({ resellerMoq: 24 });
    const [small] = await listVariants(true);

    const level = await createResellerLevel({ name: "Reseller Menengah", minBottles: 48 });
    await setLevelPrice(level.id, small.id, 4000);

    const customer = await createCustomer({
      type: "reseller",
      name: "Grosir Budi",
      phone: "081200000123",
    });

    const result = await createTransaction({
      buyerType: "reseller",
      customerId: customer.id,
      paymentMethod: "transfer",
      paidAmount: 0,
      items: [{ variantId: small.id, qty: 60 }],
    });

    assert.equal(result.transaction.subtotal, 60 * 4000);
    assert.equal(result.resellerLevelName, "Reseller Menengah");
  });

  it("uses retail price below MOQ without a locked level", async () => {
    await ensureSeeded();
    await updateSettings({ resellerMoq: 24 });
    const [small] = await listVariants(true);
    const customer = await createCustomer({
      type: "reseller",
      name: "Warung Kecil",
      phone: "081200000124",
    });

    const result = await createTransaction({
      buyerType: "reseller",
      customerId: customer.id,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 5 }],
    });

    assert.equal(result.transaction.subtotal, 5 * 5000);
    assert.equal(result.resellerLevelName, null);
  });
});

describe("receivables and payments", () => {
  it("tracks unpaid transactions and records payments", async () => {
    await ensureSeeded();
    await updateSettings({ resellerMoq: 1 });
    const [small] = await listVariants(true);
    const customer = await createCustomer({
      type: "reseller",
      name: "Toko Jaya",
      phone: "081200000125",
    });

    const { transaction } = await createTransaction({
      buyerType: "reseller",
      customerId: customer.id,
      paymentMethod: "transfer",
      paidAmount: 0,
      items: [{ variantId: small.id, qty: 2 }],
    });

    let receivables = await listReceivables();
    assert.equal(receivables.length, 1);
    assert.equal(receivables[0].remaining, transaction.finalTotal);
    assert.equal(receivables[0].ageDays, 0);

    await recordPayment(transaction.id, 3000);
    const afterPartial = await getDb().transactions.get(transaction.id);
    assert.equal(afterPartial?.paymentStatus, "partial");

    await recordPayment(transaction.id, transaction.finalTotal - 3000);
    const afterFull = await getDb().transactions.get(transaction.id);
    assert.equal(afterFull?.paymentStatus, "paid");

    receivables = await listReceivables();
    assert.equal(receivables.length, 0);
  });
});

describe("stock days", () => {
  it("tracks opening, additions, damage and closing differences", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);

    await saveOpening(small.id, 50);
    let [variant] = await listVariants();
    assert.equal(variant.stock, 50);

    await recordDamage(small.id, 5);
    await recordAddition(small.id, 10);

    const beforeClose = await getDaySummary();
    const row = beforeClose.rows.find((item) => item.variantId === small.id);
    assert.equal(row?.openingQty, 50);
    assert.equal(row?.addedQty, 10);
    assert.equal(row?.damagedQty, 5);
    assert.equal(row?.soldQty, 0);
    assert.equal(row?.expectedQty, 55);

    const closing = await closeDay({ [small.id]: 53 });
    assert.equal(closing.date, beforeClose.date);

    [variant] = await listVariants();
    assert.equal(variant.stock, 53);

    const afterClose = await getDaySummary();
    const closedRow = afterClose.rows.find((item) => item.variantId === small.id);
    assert.equal(closedRow?.closedActual, 53);
    assert.equal(closedRow?.closedDifference, -2);

    await assert.rejects(closeDay({ [small.id]: 53 }));
  });

  it("suggests today's opening from the last closing", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);
    await saveOpening(small.id, 40);
    await closeDay({ [small.id]: 38 });

    const db = getDb();
    const opening = await db.stockOpenings
      .where("[date+variantId]")
      .equals([(await getDaySummary()).date, small.id])
      .first();
    assert.equal(opening?.qty, 40);
  });
});

describe("returns", () => {
  it("adds stock back for sellable returns and records all returns", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);
    await saveOpening(small.id, 20);

    await recordReturn({
      customerId: null,
      variantId: small.id,
      qty: 3,
      sellable: true,
      refundValue: 15000,
    });

    let [variant] = await listVariants();
    assert.equal(variant.stock, 23);

    await recordReturn({
      customerId: null,
      variantId: small.id,
      qty: 2,
      sellable: false,
      refundValue: 10000,
    });

    [variant] = await listVariants();
    assert.equal(variant.stock, 23);

    const returns = await listReturns();
    assert.equal(returns.length, 2);
    assert.equal(returns[0].refundValue, 10000);
  });
});
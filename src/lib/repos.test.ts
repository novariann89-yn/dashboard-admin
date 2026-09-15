import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { createProduct, createVariant, listVariants, updateVariant } from "./repos/products";
import { createCustomer, searchCustomerRows } from "./repos/customers";
import { createTransaction, getTransactionItems } from "./repos/transactions";
import { ensureSeeded, DEFAULT_PIN } from "./seed";
import { getSettings, updateSettings } from "./settings";
import { verifyPin } from "./pin";

async function freshDb() {
  try {
    await getDb().delete();
  } catch {
    // ignore
  }
  resetDbInstance();
}

beforeEach(freshDb);

describe("seed", () => {
  it("creates starter products and default PIN once", async () => {
    await ensureSeeded();
    await ensureSeeded();

    const variants = await listVariants(true);
    assert.equal(variants.length, 2);
    assert.equal(variants[0].sellPrice, 5000);
    assert.equal(variants[1].sellPrice, 10000);

    const settings = await getSettings();
    assert.ok(settings.pinHash);
    assert.ok(settings.pinSalt);
    assert.equal(
      await verifyPin(DEFAULT_PIN, settings.pinSalt ?? "", settings.pinHash ?? ""),
      true,
    );
  });
});

describe("products", () => {
  it("writes price history when the price changes", async () => {
    const product = await createProduct({ name: "Sari Kedelai" });
    const variant = await createVariant({
      productId: product.id,
      sizeName: "Kecil",
      sellPrice: 5000,
      resellerPrice: 4200,
      costPrice: 3000,
    });

    await updateVariant(variant.id, { sellPrice: 6000 });

    const history = await getDb().priceHistory.toArray();
    assert.equal(history.length, 1);
    assert.equal(history[0].variantId, variant.id);
    assert.equal(history[0].sellPrice, 6000);

    const [updated] = await listVariants();
    assert.equal(updated.sellPrice, 6000);
  });
});

describe("customers", () => {
  it("normalizes and rejects duplicate phones per type", async () => {
    const created = await createCustomer({
      type: "member",
      name: "Budi Santoso",
      phone: "+62 812-3456-7890",
    });
    assert.equal(created.phoneNormal, "081234567890");
    assert.equal(created.nameNormal, "budi santoso");

    await assert.rejects(
      createCustomer({ type: "member", name: "Budi Lain", phone: "081234567890" }),
    );

    await createCustomer({
      type: "reseller",
      name: "Budi Grosir",
      phone: "081234567890",
    });

    const found = await searchCustomerRows("budi", "member");
    assert.equal(found.length, 1);
  });
});

describe("transactions", () => {
  it("saves snapshots and decrements stock", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);

    const { transaction } = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      paidAmount: 10000,
      items: [{ variantId: small.id, qty: 2 }],
    });

    assert.equal(transaction.subtotal, 10000);
    assert.equal(transaction.finalTotal, 10000);
    assert.equal(transaction.paymentStatus, "paid");

    const items = await getTransactionItems(transaction.id);
    assert.equal(items.length, 1);
    assert.equal(items[0].unitPrice, 5000);
    assert.equal(items[0].unitCost, 3000);
    assert.equal(items[0].qty, 2);

    const [variant] = await listVariants();
    assert.equal(variant.stock, -2);

    const movements = await getDb().stockMovements.toArray();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, "sale");
    assert.equal(movements[0].qty, -2);
  });

  it("keeps old snapshots when prices change later", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);

    const { transaction } = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 1 }],
    });

    await updateVariant(small.id, { sellPrice: 6000, costPrice: 3500 });

    const { transaction: transaction2 } = await createTransaction({
      buyerType: "umum",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 1 }],
    });

    const items1 = await getTransactionItems(transaction.id);
    const items2 = await getTransactionItems(transaction2.id);
    assert.equal(items1[0].unitPrice, 5000);
    assert.equal(items1[0].unitCost, 3000);
    assert.equal(items2[0].unitPrice, 6000);
    assert.equal(items2[0].unitCost, 3500);
  });

  it("uses the reseller price for resellers", async () => {
    await ensureSeeded();
    await updateSettings({ resellerMoq: 1 });
    const [small] = await listVariants(true);

    const { transaction } = await createTransaction({
      buyerType: "reseller",
      customerId: null,
      paymentMethod: "cash",
      items: [{ variantId: small.id, qty: 1 }],
    });

    assert.equal(transaction.subtotal, 4200);
    assert.equal(transaction.finalTotal, 4000);
    assert.equal(transaction.roundingAdjust, -200);
  });

  it("marks unpaid and partial payments", async () => {
    await ensureSeeded();
    const [small] = await listVariants(true);

    const { transaction: unpaid } = await createTransaction({
      buyerType: "reseller",
      customerId: null,
      paymentMethod: "transfer",
      paidAmount: 0,
      items: [{ variantId: small.id, qty: 1 }],
    });
    assert.equal(unpaid.paymentStatus, "unpaid");

    const { transaction: partial } = await createTransaction({
      buyerType: "reseller",
      customerId: null,
      paymentMethod: "transfer",
      paidAmount: 2000,
      items: [{ variantId: small.id, qty: 1 }],
    });
    assert.equal(partial.paymentStatus, "partial");
  });

  it("rejects an empty cart", async () => {
    await ensureSeeded();
    await assert.rejects(
      createTransaction({
        buyerType: "umum",
        customerId: null,
        paymentMethod: "cash",
        items: [],
      }),
    );
  });
});

describe("settings", () => {
  it("stores and loads values", async () => {
    await updateSettings({ roundingEnabled: false, roundingStep: 100 });
    const settings = await getSettings();
    assert.equal(settings.roundingEnabled, false);
    assert.equal(settings.roundingStep, 100);
  });
});
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import { resetData } from "./reset";
import { canDeleteHistory, DELETE_HISTORY } from "../permissions";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedHistory() {
  const db = getDb();
  const now = Date.now();
  await db.products.add({
    id: "p1",
    name: "Sari",
    emoji: "🥛",
    active: true,
    sortOrder: 1,
    createdAt: now,
  });
  await db.productVariants.add({
    id: "v1",
    productId: "p1",
    sizeName: "250ml",
    sellPrice: 5000,
    costPrice: 3000,
    netProfitPerUnit: 2000,
    stock: 10,
    active: true,
    sortOrder: 1,
    createdAt: now,
  });
  await db.transactions.add({
    id: "t1",
    occurredAt: now,
    buyerType: "umum",
    customerId: null,
    customerName: null,
    subtotal: 5000,
    finalTotal: 5000,
    paymentMethod: "cash",
    cancelled: false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: now,
  });
  await db.transactionItems.add({
    id: "i1",
    transactionId: "t1",
    variantId: "v1",
    productName: "Sari",
    sizeName: "250ml",
    qty: 1,
    unitPrice: 5000,
    unitCost: 3000,
    netProfitSnapshot: 2000,
  });
  await db.expenses.add({
    id: "e1",
    occurredAt: now,
    category: "Es Batu",
    amount: 1000,
    note: null,
  });
  await db.auditLog.add({
    id: "a1",
    at: now,
    action: "x",
    table: "app",
    recordId: null,
    oldData: null,
    newData: null,
  });
  await db.customers.add({
    id: "c1",
    name: "Budi",
    phoneNormal: "08123",
    nameNormal: "budi",
    active: true,
  });
  await db.settings.add({ key: "storeName", value: "Toko" });
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("resetData", () => {
  it("clears selected history but keeps config", async () => {
    await seedHistory();
    await resetData({ transactions: true, expenses: true, auditLog: true });

    const db = getDb();
    assert.equal(await db.transactions.count(), 0);
    assert.equal(await db.transactionItems.count(), 0);
    assert.equal(await db.expenses.count(), 0);
    assert.equal(await db.customers.count(), 1);
    assert.equal(await db.products.count(), 1);
    assert.equal(await db.settings.count(), 1);
    assert.equal((await db.productVariants.get("v1"))?.stock, 10);
  });

  it("can clear customers and zero stock independently", async () => {
    await seedHistory();
    await resetData({ customers: true, resetStock: true });

    const db = getDb();
    assert.equal(await db.customers.count(), 0);
    assert.equal((await db.productVariants.get("v1"))?.stock, 0);
    assert.equal(await db.transactions.count(), 1);
  });

  it("does nothing when no scope is selected", async () => {
    await seedHistory();
    await resetData({});
    const db = getDb();
    assert.equal(await db.transactions.count(), 1);
    assert.equal(await db.auditLog.count(), 1);
  });
});

describe("canDeleteHistory", () => {
  it("allows the owner always", () => {
    assert.equal(canDeleteHistory({ role: "owner", permissions: [] }), true);
  });

  it("allows an admin only with the capability", () => {
    assert.equal(
      canDeleteHistory({ role: "admin", permissions: [DELETE_HISTORY] }),
      true,
    );
    assert.equal(canDeleteHistory({ role: "admin", permissions: [] }), false);
    assert.equal(canDeleteHistory(null), false);
  });
});

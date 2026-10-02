import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import { deleteTransaction, deleteTransactions } from "./transactions";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seed() {
  const db = getDb();
  const now = Date.now();
  await db.productVariants.add({
    id: "v1",
    productId: "p1",
    sizeName: "250ml",
    sellPrice: 5000,
    costPrice: 3000,
    netProfitPerUnit: 2000,
    stock: 8,
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
    subtotal: 10000,
    finalTotal: 10000,
    paymentMethod: "cash",
    cancelled: false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: now,
  });
  await db.transactionItems.bulkAdd([
    {
      id: "i1",
      transactionId: "t1",
      variantId: "v1",
      productName: "Sari",
      sizeName: "250ml",
      qty: 2,
      unitPrice: 5000,
      unitCost: 3000,
      netProfitSnapshot: 2000,
    },
    {
      id: "i2",
      transactionId: "t1",
      variantId: "v1",
      productName: "Sari",
      sizeName: "250ml",
      qty: 1,
      unitPrice: 0,
      unitCost: 0,
      netProfitSnapshot: 0,
    },
  ]);
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("deleteTransaction", () => {
  it("hard-deletes the transaction and all its items", async () => {
    await seed();
    const db = getDb();
    await deleteTransaction("t1");
    assert.equal(await db.transactions.count(), 0);
    assert.equal(await db.transactionItems.count(), 0);
  });

  it("leaves stock unchanged", async () => {
    await seed();
    const db = getDb();
    await deleteTransaction("t1");
    assert.equal((await db.productVariants.get("v1"))?.stock, 8);
  });

  it("writes an audit entry", async () => {
    await seed();
    const db = getDb();
    await deleteTransaction("t1");
    const logs = await db.auditLog.toArray();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "delete_transactions");
  });

  it("is a no-op when the transaction does not exist", async () => {
    await seed();
    const db = getDb();
    await deleteTransaction("nope");
    assert.equal(await db.transactions.count(), 1);
    assert.equal(await db.transactionItems.count(), 2);
    assert.equal(await db.auditLog.count(), 0);
  });
});

describe("deleteTransactions (bulk)", () => {
  it("removes multiple transactions and their items with one audit entry", async () => {
    await seed();
    const db = getDb();
    await db.transactions.add({
      id: "t2",
      occurredAt: Date.now(),
      buyerType: "umum",
      customerId: null,
      customerName: null,
      subtotal: 5000,
      finalTotal: 5000,
      paymentMethod: "cash",
      cancelled: false,
      cancelReason: null,
      cancelledAt: null,
      createdAt: Date.now(),
    });
    await db.transactionItems.add({
      id: "i3",
      transactionId: "t2",
      variantId: "v1",
      productName: "Sari",
      sizeName: "250ml",
      qty: 1,
      unitPrice: 5000,
      unitCost: 3000,
      netProfitSnapshot: 2000,
    });

    await deleteTransactions(["t1", "t2"]);

    assert.equal(await db.transactions.count(), 0);
    assert.equal(await db.transactionItems.count(), 0);
    assert.equal((await db.productVariants.get("v1"))?.stock, 8);
    const logs = await db.auditLog.toArray();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "delete_transactions");
  });

  it("ignores ids that do not exist", async () => {
    await seed();
    const db = getDb();
    await deleteTransactions(["nope", "t1"]);
    assert.equal(await db.transactions.count(), 0);
    assert.equal(await db.auditLog.count(), 1);
  });

  it("does nothing for an empty list", async () => {
    await seed();
    const db = getDb();
    await deleteTransactions([]);
    assert.equal(await db.transactions.count(), 1);
    assert.equal(await db.auditLog.count(), 0);
  });
});

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import type {
  Customer,
  Product,
  ProductVariant,
  Transaction,
  TransactionItem,
} from "../types";
import { applyHistoryPayload, type HistoryPayload } from "./payload";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

const now = 1_700_000_000_000;

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Sari",
    emoji: "🥛",
    active: true,
    sortOrder: 1,
    createdAt: now,
    ...over,
  };
}

function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
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
    ...over,
  };
}

function tx(id: string, over: Partial<Transaction> = {}): Transaction {
  return {
    id,
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
    ...over,
  };
}

function item(
  id: string,
  transactionId: string,
  variantId: string,
  qty: number,
): TransactionItem {
  return {
    id,
    transactionId,
    variantId,
    productId: "p1",
    productName: "Sari",
    sizeName: "250ml",
    qty,
    unitPrice: 5000,
    unitCost: 3000,
    netProfitSnapshot: 2000,
  };
}

function payload(over: Partial<HistoryPayload> = {}): HistoryPayload {
  return {
    app: "dashboard-admin-sync",
    version: 1,
    sentAt: now,
    transactions: [],
    transactionItems: [],
    expenses: [],
    loyaltyClaims: [],
    customers: [],
    products: [],
    productVariants: [],
    tombstones: [],
    ...over,
  };
}

describe("applyHistoryPayload", () => {
  it("unions transactions by id and is idempotent", async () => {
    const db = getDb();
    const incoming = payload({
      transactions: [tx("t1")],
      transactionItems: [item("i1", "t1", "v1", 2)],
    });

    const first = await applyHistoryPayload(incoming);
    assert.equal(first.transactions, 1);

    const second = await applyHistoryPayload(incoming);
    assert.equal(second.transactions, 0);
    assert.equal(await db.transactions.count(), 1);
    assert.equal(await db.transactionItems.count(), 1);
  });

  it("applies tombstones: deletes existing rows and blocks re-add", async () => {
    const db = getDb();
    await db.transactions.add(tx("t1"));

    const result = await applyHistoryPayload(
      payload({
        transactions: [tx("t1")],
        tombstones: [
          {
            key: "transactions:t1",
            table: "transactions",
            recordId: "t1",
            deletedAt: now,
          },
        ],
      }),
    );

    assert.equal(result.deleted, 1);
    assert.equal(await db.transactions.count(), 0);
  });

  it("keeps existing customers (add-only)", async () => {
    const db = getDb();
    const existing: Customer = {
      id: "c1",
      name: "Budi",
      nameNormal: "budi",
      phoneNormal: "0812",
      active: true,
    };
    await db.customers.add(existing);

    await applyHistoryPayload(
      payload({ customers: [{ ...existing, name: "Budi Baru" }] }),
    );

    assert.equal((await db.customers.get("c1"))?.name, "Budi");
  });

  it("decrements stock for peer sales on existing variants, once", async () => {
    const db = getDb();
    await db.productVariants.add(variant());

    const incoming = payload({
      transactions: [tx("t1")],
      transactionItems: [item("i1", "t1", "v1", 3)],
    });

    await applyHistoryPayload(incoming);
    assert.equal((await db.productVariants.get("v1"))?.stock, 7);

    await applyHistoryPayload(incoming);
    assert.equal((await db.productVariants.get("v1"))?.stock, 7);
  });

  it("adopts a new variant with its stock and does not double-count its sales", async () => {
    const db = getDb();

    await applyHistoryPayload(
      payload({
        products: [product()],
        productVariants: [variant({ id: "v9", stock: 6 })],
        transactions: [tx("t1")],
        transactionItems: [item("i1", "t1", "v9", 2)],
      }),
    );

    assert.equal((await db.productVariants.get("v9"))?.stock, 6);
  });
});

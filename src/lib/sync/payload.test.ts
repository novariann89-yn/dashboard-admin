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
import {
  applyHistoryPayload,
  isHistoryPayload,
  SYNC_VERSION,
  type HistoryPayload,
} from "./payload";

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
    updatedAt: now,
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
    updatedAt: now,
    ...over,
  };
}

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "Budi",
    nameNormal: "budi",
    phoneNormal: "0812",
    active: true,
    updatedAt: now,
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
    version: SYNC_VERSION,
    sentAt: now,
    transactions: [],
    transactionItems: [],
    expenses: [],
    loyaltyClaims: [],
    customers: [],
    products: [],
    productVariants: [],
    tombstones: [],
    stockEvents: [],
    ...over,
  };
}

describe("applyHistoryPayload", () => {
  it("rejects payloads from a different sync version", () => {
    assert.equal(isHistoryPayload(payload()), true);
    assert.equal(isHistoryPayload({ ...payload(), version: SYNC_VERSION + 1 }), false);
    assert.equal(isHistoryPayload({ app: "other", version: SYNC_VERSION }), false);
  });

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

  it("customer merge is last-write-wins", async () => {
    const db = getDb();
    await db.customers.add(customer({ name: "Budi", updatedAt: 100 }));

    await applyHistoryPayload(
      payload({ customers: [customer({ name: "Budi Lama", updatedAt: 50 })] }),
    );
    assert.equal((await db.customers.get("c1"))?.name, "Budi");

    await applyHistoryPayload(
      payload({ customers: [customer({ name: "Budi Baru", updatedAt: 200 })] }),
    );
    assert.equal((await db.customers.get("c1"))?.name, "Budi Baru");
  });

  it("variant metadata is last-write-wins; peer stock cache is ignored", async () => {
    const db = getDb();
    await db.productVariants.add(variant({ stock: 10, sizeName: "Kecil", updatedAt: 100 }));

    await applyHistoryPayload(
      payload({ productVariants: [variant({ stock: 3, sizeName: "Kecil", updatedAt: 50 })] }),
    );
    assert.equal((await db.productVariants.get("v1"))?.stock, 10);

    await applyHistoryPayload(
      payload({ productVariants: [variant({ stock: 3, sizeName: "Besar", updatedAt: 200 })] }),
    );
    const merged = await db.productVariants.get("v1");
    assert.equal(merged?.sizeName, "Besar"); // newer metadata wins
    assert.equal(merged?.stock, 10); // ...but stock is never carried by metadata LWW
  });

  it("converges on equal timestamps (deterministic tie-break)", async () => {
    const a = variant({ id: "v1", stock: 5, sizeName: "A", updatedAt: 100 });
    const b = variant({ id: "v1", stock: 5, sizeName: "B", updatedAt: 100 });

    resetDbInstance();
    await clearAll();
    await getDb().productVariants.add(a);
    await applyHistoryPayload(payload({ productVariants: [b] }));
    const phone1 = await getDb().productVariants.get("v1");

    resetDbInstance();
    await clearAll();
    await getDb().productVariants.add(b);
    await applyHistoryPayload(payload({ productVariants: [a] }));
    const phone2 = await getDb().productVariants.get("v1");

    assert.deepEqual(phone1, phone2);
  });

  it("sums concurrent sales from two phones instead of losing one", async () => {
    const db = getDb();
    const base = { id: "base:v1", variantId: "v1", type: "count" as const, value: 10, refId: null, at: now };
    const saleA = { id: "eA", variantId: "v1", type: "sale" as const, value: -1, refId: "tA", at: now + 1 };
    const saleB = { id: "eB", variantId: "v1", type: "sale" as const, value: -2, refId: "tB", at: now + 2 };

    await db.productVariants.add(variant({ id: "v1", stock: 9 }));
    await applyHistoryPayload(payload({ stockEvents: [base, saleA] }));
    assert.equal((await db.productVariants.get("v1"))?.stock, 9);

    await applyHistoryPayload(payload({ stockEvents: [base, saleB] }));
    assert.equal((await db.productVariants.get("v1"))?.stock, 7);
  });

  it("a later physical count overrides prior history", async () => {
    const db = getDb();
    await db.productVariants.add(variant({ id: "v1", stock: 0 }));
    await applyHistoryPayload(
      payload({
        stockEvents: [
          { id: "base:v1", variantId: "v1", type: "count", value: 10, refId: null, at: now },
          { id: "s1", variantId: "v1", type: "sale", value: -3, refId: "t1", at: now + 1 },
          { id: "c1", variantId: "v1", type: "count", value: 20, refId: null, at: now + 2 },
          { id: "s2", variantId: "v1", type: "sale", value: -2, refId: "t2", at: now + 3 },
        ],
      }),
    );
    assert.equal((await db.productVariants.get("v1"))?.stock, 18);
  });

  it("divergent bases with the same id converge on both phones", async () => {
    const baseA = { id: "base:v1", variantId: "v1", type: "count" as const, value: 10, refId: null, at: 100 };
    const baseB = { id: "base:v1", variantId: "v1", type: "count" as const, value: 30, refId: null, at: 200 };

    resetDbInstance();
    await clearAll();
    await getDb().productVariants.add(variant({ id: "v1", stock: 10 }));
    await getDb().stockEvents.add(baseA);
    await applyHistoryPayload(payload({ stockEvents: [baseB] }));
    const phone1 = await getDb().productVariants.get("v1");

    resetDbInstance();
    await clearAll();
    await getDb().productVariants.add(variant({ id: "v1", stock: 30 }));
    await getDb().stockEvents.add(baseB);
    await applyHistoryPayload(payload({ stockEvents: [baseA] }));
    const phone2 = await getDb().productVariants.get("v1");

    assert.equal(phone1?.stock, 30);
    assert.equal(phone1?.stock, phone2?.stock);
  });

  it("adopts new products/variants from the peer", async () => {
    const db = getDb();
    await applyHistoryPayload(
      payload({
        products: [product()],
        productVariants: [variant({ id: "v9", stock: 6 })],
      }),
    );
    assert.equal((await db.products.get("p1"))?.name, "Sari");
    assert.equal((await db.productVariants.get("v9"))?.stock, 6);
  });
});

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import {
  claimReward,
  deleteClaims,
  getMemberLoyalty,
  listClaims,
  updateClaimNote,
} from "./loyalty";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedProduct(target = 10) {
  const db = getDb();
  const now = Date.now();
  await db.products.add({
    id: "p1",
    name: "Sari",
    emoji: "🥛",
    active: true,
    sortOrder: 1,
    createdAt: now,
    loyaltyTarget: target,
  });
  await db.productVariants.add({
    id: "v1",
    productId: "p1",
    sizeName: "250ml",
    sellPrice: 5000,
    costPrice: 3000,
    netProfitPerUnit: 2000,
    stock: 100,
    active: true,
    sortOrder: 1,
    createdAt: now,
  });
  await db.customers.add({
    id: "c1",
    name: "Budi",
    phoneNormal: "0811",
    nameNormal: "budi",
    active: true,
  });
}

async function addPurchase(
  key: string,
  qty: number,
  opts: { cancelled?: boolean; productId?: string } = {},
) {
  const db = getDb();
  const now = Date.now();
  await db.transactions.add({
    id: `t${key}`,
    occurredAt: now,
    buyerType: "member",
    customerId: "c1",
    customerName: "Budi",
    subtotal: qty * 5000,
    finalTotal: qty * 5000,
    paymentMethod: "cash",
    cancelled: opts.cancelled ?? false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: now,
  });
  await db.transactionItems.add({
    id: `i${key}`,
    transactionId: `t${key}`,
    variantId: "v1",
    productId: opts.productId ?? "p1",
    productName: "Sari",
    sizeName: "250ml",
    qty,
    unitPrice: 5000,
    unitCost: 3000,
    netProfitSnapshot: 2000,
  });
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("getMemberLoyalty", () => {
  it("derives remaining pcs and claimable count from purchases", async () => {
    await seedProduct(10);
    await addPurchase("a", 7);
    const rows = await getMemberLoyalty("c1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].remaining, 7);
    assert.equal(rows[0].claimable, 0);
  });

  it("excludes cancelled transactions", async () => {
    await seedProduct(10);
    await addPurchase("a", 10, { cancelled: true });
    assert.equal((await getMemberLoyalty("c1")).length, 0);
  });

  it("resolves product via variant when the item has no productId", async () => {
    await seedProduct(10);
    const db = getDb();
    const now = Date.now();
    await db.transactions.add({
      id: "tOld",
      occurredAt: now,
      buyerType: "member",
      customerId: "c1",
      customerName: "Budi",
      subtotal: 10000,
      finalTotal: 10000,
      paymentMethod: "cash",
      cancelled: false,
      cancelReason: null,
      cancelledAt: null,
      createdAt: now,
    });
    await db.transactionItems.add({
      id: "iOld",
      transactionId: "tOld",
      variantId: "v1",
      productName: "Sari",
      sizeName: "250ml",
      qty: 4,
      unitPrice: 5000,
      unitCost: 3000,
      netProfitSnapshot: 2000,
    });
    const rows = await getMemberLoyalty("c1");
    assert.equal(rows[0].remaining, 4);
  });

  it("ignores products without a target", async () => {
    await seedProduct(0);
    await addPurchase("a", 50);
    assert.equal((await getMemberLoyalty("c1")).length, 0);
  });
});

describe("claimReward", () => {
  it("resets to zero when exactly at target", async () => {
    await seedProduct(10);
    await addPurchase("a", 10);
    await claimReward("c1", "p1");
    const rows = await getMemberLoyalty("c1");
    assert.equal(rows[0].remaining, 0);
    assert.equal(rows[0].claimable, 0);
    assert.equal((await listClaims("c1")).length, 1);
  });

  it("stacks: 25 pcs with target 10 gives two claims", async () => {
    await seedProduct(10);
    await addPurchase("a", 25);
    assert.equal((await getMemberLoyalty("c1"))[0].claimable, 2);

    await claimReward("c1", "p1");
    assert.equal((await getMemberLoyalty("c1"))[0].remaining, 15);

    await claimReward("c1", "p1");
    assert.equal((await getMemberLoyalty("c1"))[0].remaining, 5);
    assert.equal((await getMemberLoyalty("c1"))[0].claimable, 0);
  });

  it("rejects claiming before the target is reached", async () => {
    await seedProduct(10);
    await addPurchase("a", 9);
    await assert.rejects(() => claimReward("c1", "p1"));
  });
});

describe("claims history", () => {
  it("updates a note and deletes claims", async () => {
    await seedProduct(10);
    await addPurchase("a", 10);
    await claimReward("c1", "p1");
    const [claim] = await listClaims("c1");

    await updateClaimNote(claim.id, " 1 botol gratis ");
    assert.equal((await listClaims("c1"))[0].note, "1 botol gratis");

    await deleteClaims([claim.id]);
    assert.equal((await listClaims("c1")).length, 0);
    assert.equal(await getDb().auditLog.count(), 2);
  });
});

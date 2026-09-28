import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { buildBackup, importBackup } from "./backup";
import { createProduct, createVariant } from "./repos/products";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("backup round-trip", () => {
  it("restores every table including users and expense presets", async () => {
    const db = getDb();
    const product = await createProduct({ name: "Sari Kedelai", emoji: "🥛" });
    const variant = await createVariant({
      productId: product.id,
      sizeName: "250ml",
      sellPrice: 5000,
      costPrice: 3000,
      netProfitPerUnit: 2000,
    });
    await db.users.add({
      id: "u1",
      username: "owner",
      passwordHash: "hash",
      passwordSalt: "salt",
      role: "owner",
      permissions: ["*"],
      active: true,
      createdAt: Date.now(),
    });
    await db.expensePresets.add({
      id: "p1",
      name: "Kedelai",
      sortOrder: 1,
      active: true,
      createdAt: Date.now(),
    });
    await db.productVariants.update(variant.id, { stock: 7 });

    const backup = await buildBackup();
    assert.equal(backup.data.users.length, 1);
    assert.equal(backup.data.expensePresets.length, 1);

    await clearAll();
    await importBackup(JSON.stringify(backup));

    assert.equal(await db.products.count(), 1);
    assert.equal(await db.users.count(), 1);
    assert.equal(await db.expensePresets.count(), 1);
    const restored = await db.productVariants.get(variant.id);
    assert.equal(restored?.stock, 7);
  });

  it("rejects files that are not app backups", async () => {
    await assert.rejects(() => importBackup(JSON.stringify({ app: "other" })));
  });
});

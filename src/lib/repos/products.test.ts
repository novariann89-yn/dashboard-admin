import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  profitPerUnit,
} from "./products";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("profitPerUnit", () => {
  it("uses the owner-set snapshot when positive", () => {
    assert.equal(
      profitPerUnit({ netProfitSnapshot: 2500, unitPrice: 10000, unitCost: 6000 }),
      2500,
    );
  });

  it("falls back to price minus cost when snapshot is missing or zero", () => {
    assert.equal(
      profitPerUnit({ netProfitSnapshot: undefined, unitPrice: 10000, unitCost: 6000 }),
      4000,
    );
    assert.equal(
      profitPerUnit({ netProfitSnapshot: 0, unitPrice: 5000, unitCost: 3000 }),
      2000,
    );
  });
});

describe("deleteVariant / deleteProduct", () => {
  it("deletes only the given variant", async () => {
    const db = getDb();
    const product = await createProduct({ name: "Sari" });
    const kecil = await createVariant({
      productId: product.id,
      sizeName: "Kecil",
      sellPrice: 5000,
      costPrice: 3000,
    });
    await createVariant({
      productId: product.id,
      sizeName: "Besar",
      sellPrice: 8000,
      costPrice: 5000,
    });

    await deleteVariant(kecil.id);

    const variants = await db.productVariants
      .where("productId")
      .equals(product.id)
      .toArray();
    assert.equal(variants.length, 1);
    assert.equal(variants[0].sizeName, "Besar");
  });

  it("deleting a product cascades its variants only", async () => {
    const db = getDb();
    const product = await createProduct({ name: "Sari" });
    await createVariant({
      productId: product.id,
      sizeName: "Kecil",
      sellPrice: 5000,
      costPrice: 3000,
    });
    await createVariant({
      productId: product.id,
      sizeName: "Besar",
      sellPrice: 8000,
      costPrice: 5000,
    });
    const other = await createProduct({ name: "Lain" });
    await createVariant({
      productId: other.id,
      sizeName: "250ml",
      sellPrice: 4000,
      costPrice: 2000,
    });

    await deleteProduct(product.id);

    assert.equal(await db.products.count(), 1);
    assert.equal(
      await db.productVariants.where("productId").equals(product.id).count(),
      0,
    );
    assert.equal(
      await db.productVariants.where("productId").equals(other.id).count(),
      1,
    );
  });

  it("is a no-op for unknown ids", async () => {
    const db = getDb();
    await deleteProduct("nope");
    await deleteVariant("nope");
    assert.equal(await db.products.count(), 0);
    assert.equal(await db.auditLog.count(), 0);
  });
});

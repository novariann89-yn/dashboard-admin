import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import type { ProductVariant, StockEvent, StockEventType } from "../types";
import { addStock, replayStockEvents, setStock } from "./stock";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

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
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

function evt(id: string, type: StockEventType, value: number, at: number): StockEvent {
  return { id, variantId: "v1", type, value, refId: null, at };
}

describe("replayStockEvents", () => {
  it("sums deltas after the base", () => {
    assert.equal(
      replayStockEvents([
        evt("base:v1", "count", 10, 1),
        evt("s1", "sale", -3, 2),
        evt("r1", "restock", 5, 3),
      ]),
      12,
    );
  });

  it("a later count overrides prior history", () => {
    assert.equal(
      replayStockEvents([
        evt("base:v1", "count", 10, 1),
        evt("s1", "sale", -4, 2),
        evt("c2", "count", 20, 3),
      ]),
      20,
    );
  });

  it("never goes negative", () => {
    assert.equal(replayStockEvents([evt("b", "count", 1, 1), evt("s", "sale", -5, 2)]), 0);
  });

  it("is order-independent (deterministic)", () => {
    const events = [evt("base:v1", "count", 7, 5), evt("y", "restock", 1, 3), evt("x", "sale", -2, 9)];
    assert.equal(replayStockEvents(events), replayStockEvents([...events].reverse()));
  });
});

describe("stock events on the DB", () => {
  it("seeds a base from existing stock, then applies the delta", async () => {
    const db = getDb();
    await db.productVariants.add(variant({ id: "v1", stock: 30 }));

    assert.equal(await addStock("v1", 5), 35);

    const events = await db.stockEvents.where("variantId").equals("v1").toArray();
    assert.ok(events.some((e) => e.id === "base:v1" && e.value === 30));
    assert.equal((await db.productVariants.get("v1"))?.stock, 35);
  });

  it("does not bump updatedAt on stock changes", async () => {
    const db = getDb();
    await db.productVariants.add(variant({ id: "v1", stock: 10, updatedAt: 123 }));

    await setStock("v1", 4);

    const row = await db.productVariants.get("v1");
    assert.equal(row?.stock, 4);
    assert.equal(row?.updatedAt, 123);
  });
});
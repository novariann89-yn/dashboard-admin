import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import { createExpense } from "./expenses";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("createExpense", () => {
  it("defaults occurredAt to now", async () => {
    const before = Date.now();
    const expense = await createExpense({ category: "Es Batu", amount: 5000 });
    assert.ok(expense.occurredAt >= before && expense.occurredAt <= Date.now());
  });

  it("stores an explicit occurredAt", async () => {
    const at = Date.UTC(2026, 0, 15, 5, 0);
    const expense = await createExpense({
      category: "Transport",
      amount: 10000,
      occurredAt: at,
    });
    assert.equal(expense.occurredAt, at);
  });

  it("falls back to Lain-lain when category is empty", async () => {
    const expense = await createExpense({ category: "  ", amount: 1000 });
    assert.equal(expense.category, "Lain-lain");
  });

  it("rejects non-positive amounts", async () => {
    await assert.rejects(() => createExpense({ category: "Gaji", amount: 0 }));
  });
});

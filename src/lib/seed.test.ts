import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { ensureSeeded } from "./seed";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("ensureSeeded", () => {
  it("seeds once even when called concurrently", async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()]);
    const db = getDb();
    assert.equal(await db.products.count(), 1);
    assert.equal(await db.productVariants.count(), 2);
    assert.equal(await db.users.count(), 1);
  });
});
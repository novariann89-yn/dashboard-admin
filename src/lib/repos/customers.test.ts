import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import { deleteCustomers } from "./customers";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seed() {
  const db = getDb();
  await db.customers.bulkAdd([
    { id: "c1", name: "Budi", phoneNormal: "0811", nameNormal: "budi", active: true },
    { id: "c2", name: "Sari", phoneNormal: "0822", nameNormal: "sari", active: true },
  ]);
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("deleteCustomers", () => {
  it("removes the given customers and writes one audit entry", async () => {
    await seed();
    const db = getDb();
    await deleteCustomers(["c1", "c2"]);
    assert.equal(await db.customers.count(), 0);
    const logs = await db.auditLog.toArray();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "delete_customers");
  });

  it("ignores ids that do not exist", async () => {
    await seed();
    const db = getDb();
    await deleteCustomers(["nope", "c1"]);
    assert.equal(await db.customers.count(), 1);
    assert.equal(await db.auditLog.count(), 1);
  });

  it("does nothing for an empty list", async () => {
    await seed();
    const db = getDb();
    await deleteCustomers([]);
    assert.equal(await db.customers.count(), 2);
    assert.equal(await db.auditLog.count(), 0);
  });
});

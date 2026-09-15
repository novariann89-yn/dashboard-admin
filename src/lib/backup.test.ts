import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { buildBackup, importBackup } from "./backup";
import { getDb, resetDbInstance } from "./db";
import { createCustomer } from "./repos/customers";
import { createTransaction } from "./repos/transactions";
import { ensureSeeded } from "./seed";
import { getSettings } from "./settings";

async function freshDb() {
  try {
    await getDb().delete();
  } catch {
    // ignore
  }
  resetDbInstance();
}

beforeEach(freshDb);

describe("backup", () => {
  it("round-trips all data and resets the PIN", async () => {
    await ensureSeeded();
    const customer = await createCustomer({
      type: "member",
      name: "Budi",
      phone: "081234567890",
    });
    const [variant] = await getDb().productVariants.toArray();
    await createTransaction({
      buyerType: "member",
      customerId: customer.id,
      paymentMethod: "cash",
      items: [{ variantId: variant.id, qty: 2 }],
    });

    const serialized = JSON.stringify(await buildBackup());
    const parsed = JSON.parse(serialized) as { app: string };
    assert.equal(parsed.app, "dashboard-admin");

    await getDb().customers.clear();
    await getDb().transactions.clear();
    assert.equal(await getDb().customers.count(), 0);

    await importBackup(serialized);

    assert.equal(await getDb().customers.count(), 1);
    assert.equal(await getDb().transactions.count(), 1);
    assert.equal(await getDb().transactionItems.count(), 1);

    const settings = await getSettings();
    assert.equal(settings.pinHash, null);
    assert.equal(settings.pinSalt, null);
  });

  it("rejects files that are not backups", async () => {
    await assert.rejects(importBackup("not json"));
    await assert.rejects(importBackup(JSON.stringify({ app: "lain" })));
  });
});
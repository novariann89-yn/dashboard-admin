import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "../db";
import { EXPENSE_CATEGORIES } from "./expenses";
import {
  createExpensePreset,
  deleteExpensePreset,
  ensureExpensePresetsSeeded,
  listExpensePresets,
  updateExpensePreset,
} from "./expense-presets";

async function freshDb() {
  await getDb().delete();
  resetDbInstance();
}

describe("expense presets", () => {
  beforeEach(freshDb);

  it("seeds defaults once", async () => {
    await ensureExpensePresetsSeeded();
    await ensureExpensePresetsSeeded();

    const presets = await listExpensePresets(false);
    assert.equal(presets.length, EXPENSE_CATEGORIES.length);
    assert.equal(presets[0]?.name, EXPENSE_CATEGORIES[0]);
  });

  it("creates, updates and deletes presets", async () => {
    const created = await createExpensePreset("Kemasan");
    assert.equal(created.active, true);

    await updateExpensePreset(created.id, { name: "Kemasan & Plastik" });
    await updateExpensePreset(created.id, { active: false });

    const all = await listExpensePresets(false);
    assert.equal(all.length, 1);
    assert.equal(all[0]?.name, "Kemasan & Plastik");
    assert.equal(all[0]?.active, false);

    const active = await listExpensePresets(true);
    assert.equal(active.length, 0);

    await deleteExpensePreset(created.id);
    assert.equal((await listExpensePresets(false)).length, 0);
  });

  it("rejects empty names", async () => {
    await assert.rejects(() => createExpensePreset("   "));
  });

  it("rejects duplicate names on create and rename", async () => {
    await createExpensePreset("Kemasan");
    await assert.rejects(() => createExpensePreset("kemasan"));

    const transport = await createExpensePreset("Transport");
    await assert.rejects(() =>
      updateExpensePreset(transport.id, { name: "Kemasan" }),
    );

    const all = await listExpensePresets(false);
    assert.equal(all.length, 2);
  });
});

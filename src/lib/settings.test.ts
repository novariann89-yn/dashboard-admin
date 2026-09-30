import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "./settings";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("app name setting", () => {
  it("defaults to SuperSoy", async () => {
    const settings = await getSettings();
    assert.equal(settings.appName, DEFAULT_SETTINGS.appName);
    assert.equal(settings.appName, "SuperSoy");
  });

  it("persists a custom app name", async () => {
    await updateSettings({ appName: "Warung Sari" });
    const settings = await getSettings();
    assert.equal(settings.appName, "Warung Sari");
  });
});

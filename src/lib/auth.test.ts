import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import { createUser, login } from "./auth";

const sessionStore = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
  clear: () => sessionStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

async function freshDb() {
  await getDb().delete();
  resetDbInstance();
}

describe("createUser", () => {
  beforeEach(freshDb);

  it("rejects empty id", async () => {
    await assert.rejects(() =>
      createUser({ username: "   ", password: "1234", role: "admin" }),
    );
  });

  it("rejects empty password", async () => {
    await assert.rejects(() =>
      createUser({ username: "kasir", password: "", role: "admin" }),
    );
  });

  it("rejects duplicate ids case-insensitively", async () => {
    await createUser({ username: "Budi", password: "1234", role: "admin" });
    await assert.rejects(() =>
      createUser({ username: "  budi ", password: "1234", role: "admin" }),
    );
  });

  it("creates a user with a generated id and allows login", async () => {
    const user = await createUser({
      username: "kasir",
      password: "rahasia",
      role: "admin",
    });
    assert.ok(user.id.length > 0);

    const session = await login("  kasir ", "rahasia");
    assert.equal(session?.username, "kasir");
    assert.equal(session?.role, "admin");
  });
});
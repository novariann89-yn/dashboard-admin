import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

let service: typeof import("./purchase-service");
let database: (typeof import("@/db"))["db"];
let client: (typeof import("@/db"))["client"];
let schema: typeof import("@/db/schema");

let smallId = 0;
let bigId = 0;

const dbFile = join(tmpdir(), `tokomas-test-${process.pid}-${Date.now()}.db`);

before(async () => {
  process.env.DATABASE_URL = `file:${dbFile}`;

  const dbModule = await import("@/db");
  database = dbModule.db;
  client = dbModule.client;
  schema = await import("@/db/schema");
  service = await import("./purchase-service");

  const drizzleDir = join(process.cwd(), "drizzle");
  const files = readdirSync(drizzleDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = readFileSync(join(drizzleDir, file), "utf8");
    for (const raw of content.split("--> statement-breakpoint")) {
      const statement = raw.trim();
      if (statement) await client.execute(statement);
    }
  }

  const [small, big] = await database
    .insert(schema.products)
    .values([
      { name: "Botol Kecil", price: 5000, sortOrder: 1 },
      { name: "Botol Besar", price: 10000, sortOrder: 2 },
    ])
    .returning();

  smallId = small.id;
  bigId = big.id;

  await database.insert(schema.bonusRules).values({
    threshold: 10,
    rewardProductId: smallId,
    rewardQty: 1,
  });
});

after(async () => {
  client.close();
  if (existsSync(dbFile)) rmSync(dbFile, { force: true });
});

describe("recordPurchase", () => {
  it("rejects invalid phone numbers", async () => {
    const result = await service.recordPurchase({
      phone: "abc",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(result.ok, false);
  });

  it("requires a name for a new member", async () => {
    const result = await service.recordPurchase({
      phone: "081200000001",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(result.ok, false);
  });

  it("rejects an empty cart", async () => {
    const result = await service.recordPurchase({
      phone: "081200000002",
      name: "Ani",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 0 }],
    });
    assert.equal(result.ok, false);
  });

  it("creates the member and records the first purchase", async () => {
    const result = await service.recordPurchase({
      phone: "081200000003",
      name: "Budi",
      countsTowardBonus: true,
      items: [{ productId: bigId, quantity: 2 }],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.progress, 1);
    assert.equal(result.threshold, 10);
    assert.equal(result.totalAmount, 20000);
    assert.equal(result.bonus, null);

    const [member] = await database
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, result.memberId));
    assert.equal(member.totalPurchases, 1);
    assert.equal(member.bonusProgress, 1);
  });

  it("awards the bonus at the threshold and resets progress", async () => {
    const phone = "081200000004";

    for (let i = 1; i <= 9; i += 1) {
      const result = await service.recordPurchase({
        phone,
        name: i === 1 ? "Citra" : undefined,
        countsTowardBonus: true,
        items: [{ productId: smallId, quantity: 1 }],
      });
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.bonus, null);
    }

    const tenth = await service.recordPurchase({
      phone,
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });

    assert.equal(tenth.ok, true);
    if (!tenth.ok) return;
    assert.equal(tenth.progress, 0);
    assert.deepEqual(tenth.bonus, { name: "Botol Kecil", qty: 1 });

    const [member] = await database
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, tenth.memberId));
    assert.equal(member.totalPurchases, 10);
    assert.equal(member.totalBonuses, 1);
    assert.equal(member.bonusProgress, 0);

    const events = await database.select().from(schema.bonusEvents);
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "earned");
    assert.equal(events[0].rewardProductName, "Botol Kecil");
  });

  it("does not advance progress when the purchase is excluded from bonus", async () => {
    const first = await service.recordPurchase({
      phone: "081200000005",
      name: "Dedi",
      countsTowardBonus: false,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(first.ok, true);

    const second = await service.recordPurchase({
      phone: "081200000005",
      countsTowardBonus: false,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;

    assert.equal(second.progress, 0);
    const [member] = await database
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, second.memberId));
    assert.equal(member.totalPurchases, 0);
    assert.equal(member.bonusProgress, 0);
  });

  it("stores a price snapshot on purchase items", async () => {
    const result = await service.recordPurchase({
      phone: "081200000006",
      name: "Eka",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    await database
      .update(schema.products)
      .set({ price: 6000 })
      .where(eq(schema.products.id, smallId));

    const [item] = await database
      .select()
      .from(schema.purchaseItems)
      .where(eq(schema.purchaseItems.purchaseId, result.purchaseId));

    assert.equal(item.unitPrice, 5000);
    assert.equal(item.subtotal, 5000);

    await database
      .update(schema.products)
      .set({ price: 5000 })
      .where(eq(schema.products.id, smallId));
  });
});

describe("voidPurchase", () => {
  it("marks the purchase as void and rolls back member counters", async () => {
    const created = await service.recordPurchase({
      phone: "081200000007",
      name: "Fajar",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = await service.voidPurchase(created.purchaseId);
    assert.equal(result.ok, true);

    const [purchase] = await database
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, created.purchaseId));
    assert.equal(purchase.status, "void");

    const [member] = await database
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, created.memberId));
    assert.equal(member.totalPurchases, 0);
    assert.equal(member.bonusProgress, 0);
  });

  it("rejects voiding the same purchase twice", async () => {
    const created = await service.recordPurchase({
      phone: "081200000008",
      name: "Hana",
      countsTowardBonus: true,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const first = await service.voidPurchase(created.purchaseId);
    assert.equal(first.ok, true);

    const second = await service.voidPurchase(created.purchaseId);
    assert.equal(second.ok, false);
  });

  it("blocks voiding a purchase that triggered a bonus", async () => {
    const phone = "081200000009";
    let tenthPurchaseId = 0;

    for (let i = 1; i <= 10; i += 1) {
      const result = await service.recordPurchase({
        phone,
        name: i === 1 ? "Gita" : undefined,
        countsTowardBonus: true,
        items: [{ productId: smallId, quantity: 1 }],
      });
      assert.equal(result.ok, true);
      if (result.ok && i === 10) tenthPurchaseId = result.purchaseId;
    }

    assert.ok(tenthPurchaseId > 0);

    const result = await service.voidPurchase(tenthPurchaseId);
    assert.equal(result.ok, false);

    const events = await database
      .select()
      .from(schema.bonusEvents)
      .where(eq(schema.bonusEvents.purchaseId, tenthPurchaseId));
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "earned");
  });
});

describe("backdated purchases", () => {
  it("stores the provided occurredAt date", async () => {
    const occurredAt = new Date("2026-01-02T03:00:00.000Z");
    const result = await service.recordPurchase({
      phone: "081200000010",
      name: "Indra",
      countsTowardBonus: true,
      occurredAt,
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const [purchase] = await database
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, result.purchaseId));
    assert.equal(purchase.occurredAt.getTime(), occurredAt.getTime());
  });

  it("rejects a future occurredAt", async () => {
    const result = await service.recordPurchase({
      phone: "081200000011",
      name: "Joko",
      countsTowardBonus: true,
      occurredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      items: [{ productId: smallId, quantity: 1 }],
    });
    assert.equal(result.ok, false);
  });
});

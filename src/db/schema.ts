import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    bonusProgress: integer("bonus_progress").notNull().default(0),
    totalPurchases: integer("total_purchases").notNull().default(0),
    totalBonuses: integer("total_bonuses").notNull().default(0),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("members_phone_idx").on(t.phone)],
);

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    totalAmount: integer("total_amount").notNull().default(0),
    note: text("note"),
    countsTowardBonus: integer("counts_toward_bonus", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status", { enum: ["active", "void"] })
      .notNull()
      .default("active"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(now),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [
    index("purchases_member_idx").on(t.memberId),
    index("purchases_occurred_idx").on(t.occurredAt),
  ],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id),
    productName: text("product_name").notNull(),
    unitPrice: integer("unit_price").notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
    subtotal: integer("subtotal").notNull().default(0),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)],
);

export const bonusRules = sqliteTable("bonus_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threshold: integer("threshold").notNull(),
  rewardProductId: integer("reward_product_id")
    .notNull()
    .references(() => products.id),
  rewardQty: integer("reward_qty").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const bonusEvents = sqliteTable(
  "bonus_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    ruleId: integer("rule_id").references(() => bonusRules.id),
    purchaseId: integer("purchase_id").references(() => purchases.id),
    rewardProductId: integer("reward_product_id").references(() => products.id),
    rewardProductName: text("reward_product_name").notNull(),
    rewardQty: integer("reward_qty").notNull().default(1),
    status: text("status", { enum: ["earned", "redeemed"] })
      .notNull()
      .default("earned"),
    earnedAt: integer("earned_at", { mode: "timestamp_ms" }).notNull().default(now),
    redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("bonus_events_member_idx").on(t.memberId),
    index("bonus_events_status_idx").on(t.status),
  ],
);

export type Product = typeof products.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type BonusRule = typeof bonusRules.$inferSelect;
export type BonusEvent = typeof bonusEvents.$inferSelect;
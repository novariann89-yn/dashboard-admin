import { getDb } from "../db";
import { newId } from "../id";
import type { DiscountRule, ResellerLevel } from "../types";

export async function listDiscountRules(): Promise<DiscountRule[]> {
  const rows = await getDb().discountRules.toArray();
  return rows.sort(
    (a, b) => b.priority - a.priority || a.name.localeCompare(b.name),
  );
}

export async function createDiscountRule(
  input: Omit<DiscountRule, "id" | "createdAt">,
): Promise<DiscountRule> {
  const rule: DiscountRule = { ...input, id: newId(), createdAt: Date.now() };
  await getDb().discountRules.add(rule);
  return rule;
}

export async function updateDiscountRule(
  id: string,
  patch: Partial<Omit<DiscountRule, "id" | "createdAt">>,
): Promise<void> {
  await getDb().discountRules.update(id, patch);
}

export interface ResellerLevelWithPrices extends ResellerLevel {
  prices: Record<string, number>;
}

export async function listResellerLevels(): Promise<ResellerLevelWithPrices[]> {
  const db = getDb();
  const [levels, prices] = await Promise.all([
    db.resellerLevels.toArray(),
    db.resellerLevelPrices.toArray(),
  ]);

  return levels
    .sort((a, b) => a.minBottles - b.minBottles)
    .map((level) => ({
      ...level,
      prices: Object.fromEntries(
        prices
          .filter((price) => price.levelId === level.id)
          .map((price) => [price.variantId, price.price]),
      ),
    }));
}

export async function createResellerLevel(input: {
  name: string;
  minBottles: number;
}): Promise<ResellerLevel> {
  const level: ResellerLevel = {
    id: newId(),
    name: input.name.trim(),
    minBottles: Math.max(1, Math.round(input.minBottles)),
    sortOrder: 0,
    active: true,
  };
  await getDb().resellerLevels.add(level);
  return level;
}

export async function updateResellerLevel(
  id: string,
  patch: Partial<Pick<ResellerLevel, "name" | "minBottles" | "active">>,
): Promise<void> {
  await getDb().resellerLevels.update(id, patch);
}

export async function setLevelPrice(
  levelId: string,
  variantId: string,
  price: number,
): Promise<void> {
  const db = getDb();
  const value = Math.max(0, Math.round(price));
  const existing = await db.resellerLevelPrices
    .where("[levelId+variantId]")
    .equals([levelId, variantId])
    .first();

  if (existing) {
    await db.resellerLevelPrices.update(existing.id, { price: value });
  } else {
    await db.resellerLevelPrices.add({
      id: newId(),
      levelId,
      variantId,
      price: value,
    });
  }
}

export async function removeLevelPrice(
  levelId: string,
  variantId: string,
): Promise<void> {
  const db = getDb();
  const existing = await db.resellerLevelPrices
    .where("[levelId+variantId]")
    .equals([levelId, variantId])
    .first();
  if (existing) await db.resellerLevelPrices.delete(existing.id);
}
import { getDb } from "../db";
import { newId } from "../id";
import { logAudit } from "./audit";
import type { LoyaltyClaim } from "../types";

export interface LoyaltyRow {
  productId: string;
  productName: string;
  remaining: number;
}

export async function getMemberLoyalty(
  customerId: string,
): Promise<LoyaltyRow[]> {
  const db = getDb();
  const transactions = (
    await db.transactions.where("customerId").equals(customerId).toArray()
  ).filter((transaction) => !transaction.cancelled);
  const transactionIds = new Set(transactions.map((transaction) => transaction.id));

  const [allItems, variants, products, claims] = await Promise.all([
    db.transactionItems.toArray(),
    db.productVariants.toArray(),
    db.products.toArray(),
    db.loyaltyClaims.where("customerId").equals(customerId).toArray(),
  ]);

  const variantProduct = new Map(variants.map((variant) => [variant.id, variant.productId]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const productByName = new Map(products.map((product) => [product.name, product.id]));

  const purchased = new Map<string, number>();
  const names = new Map<string, string>();
  for (const item of allItems) {
    if (!transactionIds.has(item.transactionId)) continue;
    const productId =
      item.productId ||
      variantProduct.get(item.variantId) ||
      productByName.get(item.productName);
    if (!productId) continue;
    purchased.set(productId, (purchased.get(productId) ?? 0) + item.qty);
    names.set(productId, productById.get(productId)?.name ?? item.productName);
  }

  const claimed = new Map<string, number>();
  for (const claim of claims) {
    claimed.set(
      claim.productId,
      (claimed.get(claim.productId) ?? 0) + claim.claimedQty,
    );
    if (!names.has(claim.productId)) names.set(claim.productId, claim.productName);
  }

  const rows: LoyaltyRow[] = [];
  for (const productId of new Set([...purchased.keys(), ...claimed.keys()])) {
    const remaining = Math.max(
      0,
      (purchased.get(productId) ?? 0) - (claimed.get(productId) ?? 0),
    );
    if (remaining < 1) continue;
    rows.push({
      productId,
      productName: names.get(productId) ?? "?",
      remaining,
    });
  }

  return rows.sort(
    (a, b) =>
      b.remaining - a.remaining || a.productName.localeCompare(b.productName),
  );
}

export async function claimReward(
  customerId: string,
  productId: string,
  note?: string | null,
): Promise<void> {
  const row = (await getMemberLoyalty(customerId)).find(
    (entry) => entry.productId === productId,
  );
  if (!row || row.remaining < 1) throw new Error("Tidak ada yang bisa diklaim");

  const claim: LoyaltyClaim = {
    id: newId(),
    customerId,
    productId,
    productName: row.productName,
    claimedAt: Date.now(),
    claimedQty: row.remaining,
    note: note?.trim() || null,
  };
  await getDb().loyaltyClaims.add(claim);
  await logAudit({
    action: "claim_reward",
    table: "loyaltyClaims",
    recordId: claim.id,
    newData: { customerId, productId, qty: row.remaining },
  });
}

export async function listClaims(customerId: string): Promise<LoyaltyClaim[]> {
  const rows = await getDb()
    .loyaltyClaims.where("customerId")
    .equals(customerId)
    .toArray();
  return rows.sort((a, b) => b.claimedAt - a.claimedAt);
}

export async function updateClaimNote(id: string, note: string): Promise<void> {
  await getDb().loyaltyClaims.update(id, { note: note.trim() || null });
}

export async function deleteClaims(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return;

  const db = getDb();
  const rows = await db.loyaltyClaims.bulkGet(unique);
  const found = unique.filter((id, index) => rows[index]);
  if (found.length === 0) return;

  await db.loyaltyClaims.bulkDelete(found);
  await logAudit({
    action: "delete_claims",
    table: "loyaltyClaims",
    newData: { count: found.length },
  });
}

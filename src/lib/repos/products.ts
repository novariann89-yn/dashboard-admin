import { getDb } from "../db";
import { newId } from "../id";
import type { Product, ProductVariant } from "../types";
import { logAudit } from "./audit";

export async function listProducts(): Promise<Product[]> {
  const products = await getDb().products.toArray();
  return products.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function listVariants(activeOnly = false): Promise<ProductVariant[]> {
  const variants = await getDb().productVariants.toArray();
  return variants
    .filter((variant) => !activeOnly || variant.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.sizeName.localeCompare(b.sizeName));
}

export interface VariantWithProduct extends ProductVariant {
  productName: string;
  productEmoji: string;
}

export async function listVariantsWithProduct(
  activeOnly = true,
): Promise<VariantWithProduct[]> {
  const db = getDb();
  const [variants, products] = await Promise.all([
    listVariants(activeOnly),
    db.products.toArray(),
  ]);
  const byId = new Map(products.map((product) => [product.id, product]));

  return variants.flatMap((variant) => {
    const product = byId.get(variant.productId);
    if (!product) return [];
    return [{ ...variant, productName: product.name, productEmoji: product.emoji }];
  });
}

export async function createProduct(input: {
  name: string;
  emoji?: string;
  sortOrder?: number;
}): Promise<Product> {
  const db = getDb();
  const existing = await db.products.count();
  const product: Product = {
    id: newId(),
    name: input.name.trim(),
    emoji: (input.emoji ?? "🥛").trim() || "🥛",
    active: true,
    sortOrder: input.sortOrder ?? existing + 1,
    createdAt: Date.now(),
  };
  await db.products.add(product);
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, "name" | "emoji" | "active" | "sortOrder">>,
): Promise<void> {
  await getDb().products.update(id, patch);
}

export async function createVariant(input: {
  productId: string;
  sizeName: string;
  sellPrice: number;
  costPrice: number;
  netProfitPerUnit?: number;
  sortOrder?: number;
}): Promise<ProductVariant> {
  const db = getDb();
  const existing = await db.productVariants.where("productId").equals(input.productId).count();
  const variant: ProductVariant = {
    id: newId(),
    productId: input.productId,
    sizeName: input.sizeName.trim(),
    sellPrice: Math.max(0, Math.round(input.sellPrice)),
    costPrice: Math.max(0, Math.round(input.costPrice)),
    netProfitPerUnit: Math.max(0, Math.round(input.netProfitPerUnit ?? 0)),
    stock: 0,
    active: true,
    sortOrder: input.sortOrder ?? existing + 1,
    createdAt: Date.now(),
  };
  await db.productVariants.add(variant);
  return variant;
}

export async function updateVariant(
  id: string,
  patch: Partial<
    Pick<
      ProductVariant,
      "sizeName" | "sellPrice" | "costPrice" | "netProfitPerUnit" | "active" | "sortOrder"
    >
  >,
): Promise<void> {
  const db = getDb();
  const current = await db.productVariants.get(id);
  if (!current) return;

  const next = {
    ...patch,
    sellPrice: patch.sellPrice !== undefined ? Math.max(0, Math.round(patch.sellPrice)) : undefined,
    costPrice: patch.costPrice !== undefined ? Math.max(0, Math.round(patch.costPrice)) : undefined,
    netProfitPerUnit: patch.netProfitPerUnit !== undefined ? Math.max(0, Math.round(patch.netProfitPerUnit)) : undefined,
  };

  const priceChanged =
    (next.sellPrice !== undefined && next.sellPrice !== current.sellPrice) ||
    (next.costPrice !== undefined && next.costPrice !== current.costPrice);

  if (priceChanged) {
    await logAudit({
      action: "price_change",
      table: "productVariants",
      recordId: id,
      oldData: {
        sellPrice: current.sellPrice,
        costPrice: current.costPrice,
      },
      newData: {
        sellPrice: next.sellPrice ?? current.sellPrice,
        costPrice: next.costPrice ?? current.costPrice,
      },
    });
  }

  await db.productVariants.update(id, next);
}

export async function deleteVariant(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.productVariants.get(id);
  if (!existing) return;

  await db.productVariants.delete(id);
  await logAudit({
    action: "delete_variant",
    table: "productVariants",
    recordId: id,
    oldData: { sizeName: existing.sizeName, sellPrice: existing.sellPrice },
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.products.get(id);
  if (!existing) return;

  const variantIds = await db.productVariants
    .where("productId")
    .equals(id)
    .primaryKeys();

  await db.transaction("rw", [db.products, db.productVariants], async () => {
    await db.productVariants.where("productId").equals(id).delete();
    await db.products.delete(id);
  });

  await logAudit({
    action: "delete_product",
    table: "products",
    recordId: id,
    oldData: { name: existing.name, variantCount: variantIds.length },
  });
}

export async function variantsWithMissingCost(): Promise<ProductVariant[]> {
  const variants = await listVariants(true);
  return variants.filter((variant) => variant.costPrice <= 0);
}

export function profitPerUnit(input: {
  netProfitSnapshot?: number | null;
  unitPrice: number;
  unitCost: number;
}): number {
  if (typeof input.netProfitSnapshot === "number" && input.netProfitSnapshot > 0) {
    return input.netProfitSnapshot;
  }
  return input.unitPrice - input.unitCost;
}

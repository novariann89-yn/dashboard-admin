import { getDb } from "../db";
import { newId } from "../id";
import type { PriceHistory, Product, ProductVariant } from "../types";

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
  category: string;
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
    return [{ ...variant, productName: product.name, category: product.category }];
  });
}

export async function createProduct(input: {
  name: string;
  category?: string;
  sortOrder?: number;
}): Promise<Product> {
  const db = getDb();
  const existing = await db.products.count();
  const product: Product = {
    id: newId(),
    name: input.name.trim(),
    category: (input.category ?? "Umum").trim() || "Umum",
    active: true,
    sortOrder: input.sortOrder ?? existing + 1,
    createdAt: Date.now(),
  };
  await db.products.add(product);
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, "name" | "category" | "active" | "sortOrder">>,
): Promise<void> {
  await getDb().products.update(id, patch);
}

export async function createVariant(input: {
  productId: string;
  sizeName: string;
  sellPrice: number;
  resellerPrice: number;
  costPrice: number;
  sortOrder?: number;
}): Promise<ProductVariant> {
  const db = getDb();
  const existing = await db.productVariants.where("productId").equals(input.productId).count();
  const variant: ProductVariant = {
    id: newId(),
    productId: input.productId,
    sizeName: input.sizeName.trim(),
    sellPrice: Math.max(0, Math.round(input.sellPrice)),
    resellerPrice: Math.max(0, Math.round(input.resellerPrice)),
    costPrice: Math.max(0, Math.round(input.costPrice)),
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
      "sizeName" | "sellPrice" | "resellerPrice" | "costPrice" | "active" | "sortOrder"
    >
  >,
): Promise<void> {
  const db = getDb();
  const current = await db.productVariants.get(id);
  if (!current) return;

  const next = {
    ...patch,
    sellPrice: patch.sellPrice !== undefined ? Math.max(0, Math.round(patch.sellPrice)) : undefined,
    resellerPrice:
      patch.resellerPrice !== undefined ? Math.max(0, Math.round(patch.resellerPrice)) : undefined,
    costPrice: patch.costPrice !== undefined ? Math.max(0, Math.round(patch.costPrice)) : undefined,
  };

  const priceChanged =
    (next.sellPrice !== undefined && next.sellPrice !== current.sellPrice) ||
    (next.resellerPrice !== undefined && next.resellerPrice !== current.resellerPrice) ||
    (next.costPrice !== undefined && next.costPrice !== current.costPrice);

  await db.transaction("rw", [db.productVariants, db.priceHistory], async () => {
    await db.productVariants.update(id, next);
    if (priceChanged) {
      const history: PriceHistory = {
        id: newId(),
        variantId: id,
        sellPrice: next.sellPrice ?? current.sellPrice,
        resellerPrice: next.resellerPrice ?? current.resellerPrice,
        costPrice: next.costPrice ?? current.costPrice,
        createdAt: Date.now(),
      };
      await db.priceHistory.add(history);
    }
  });
}

export async function listPriceHistory(variantId: string): Promise<PriceHistory[]> {
  const rows = await getDb().priceHistory.where("variantId").equals(variantId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function variantsWithMissingCost(): Promise<ProductVariant[]> {
  const variants = await listVariants(true);
  return variants.filter((variant) => variant.costPrice <= 0);
}
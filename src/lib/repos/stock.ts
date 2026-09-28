import { getDb } from "../db";
import { listVariantsWithProduct } from "./products";
import type { ProductVariant } from "../types";
import { logAudit } from "./audit";

export interface VariantWithProduct extends ProductVariant {
  productName: string;
  productEmoji: string;
}

export async function listStock(): Promise<VariantWithProduct[]> {
  return listVariantsWithProduct(true);
}

export function stockLevel(stock: number): "high" | "low" | "empty" {
  if (stock <= 0) return "empty";
  if (stock <= 20) return "low";
  return "high";
}

export async function addStock(variantId: string, qty: number): Promise<number> {
  const delta = Math.floor(qty);
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error("Jumlah harus lebih dari 0");
  }
  const db = getDb();
  const variant = await db.productVariants.get(variantId);
  if (!variant) throw new Error("Produk tidak ditemukan");

  const next = Math.max(0, variant.stock + delta);
  await db.productVariants.update(variantId, { stock: next });
  await logAudit({
    action: "stock_addition",
    table: "productVariants",
    recordId: variantId,
    oldData: { stock: variant.stock },
    newData: { stock: next, added: delta },
  });
  return next;
}

export async function setStock(variantId: string, qty: number): Promise<number> {
  const next = Math.max(0, Math.floor(qty));
  if (!Number.isFinite(next)) throw new Error("Jumlah tidak valid");
  const db = getDb();
  const variant = await db.productVariants.get(variantId);
  if (!variant) throw new Error("Produk tidak ditemukan");

  await db.productVariants.update(variantId, { stock: next });
  await logAudit({
    action: "stock_adjust",
    table: "productVariants",
    recordId: variantId,
    oldData: { stock: variant.stock },
    newData: { stock: next },
  });
  return next;
}

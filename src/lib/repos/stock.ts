import { getDb } from "../db";
import { listVariantsWithProduct } from "./products";
import type { ProductVariant } from "../types";
import { newId } from "../id";

export interface VariantWithProduct extends ProductVariant {
  productName: string;
  category: string;
}

export async function listStock(): Promise<VariantWithProduct[]> {
  return listVariantsWithProduct(true);
}

export function stockLevel(stock: number): "high" | "low" | "empty" {
  if (stock <= 0) return "empty";
  if (stock <= 20) return "low";
  return "high";
}
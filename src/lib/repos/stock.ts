import { getDb } from "../db";
import { newId } from "../id";
import type { StockMovement, StockMovementType } from "../types";
import { listVariantsWithProduct, type VariantWithProduct } from "./products";

export async function recordStockMovement(input: {
  variantId: string;
  type: StockMovementType;
  qty: number;
  unitCost?: number;
  note?: string | null;
}): Promise<void> {
  const db = getDb();
  const movement: StockMovement = {
    id: newId(),
    variantId: input.variantId,
    occurredAt: Date.now(),
    type: input.type,
    qty: Math.round(input.qty),
    ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
    refTransactionId: null,
    note: input.note ?? null,
  };

  await db.transaction("rw", [db.stockMovements, db.productVariants], async () => {
    await db.stockMovements.add(movement);
    const variant = await db.productVariants.get(input.variantId);
    if (variant) {
      await db.productVariants.update(input.variantId, {
        stock: variant.stock + Math.round(input.qty),
      });
    }
  });
}

export async function listStock(): Promise<VariantWithProduct[]> {
  return listVariantsWithProduct(true);
}

export function stockLevel(stock: number): "high" | "low" | "empty" {
  if (stock <= 0) return "empty";
  if (stock <= 20) return "low";
  return "high";
}
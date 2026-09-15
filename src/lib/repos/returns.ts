import { getDb } from "../db";
import { newId } from "../id";
import type { ProductReturn } from "../types";
import { recordStockMovement } from "./stock";

export async function recordReturn(input: {
  customerId: string | null;
  variantId: string;
  qty: number;
  sellable: boolean;
  refundValue: number;
  note?: string | null;
}): Promise<void> {
  const db = getDb();
  const qty = Math.max(1, Math.round(input.qty));

  const productReturn: ProductReturn = {
    id: newId(),
    occurredAt: Date.now(),
    customerId: input.customerId,
    variantId: input.variantId,
    qty,
    sellable: input.sellable,
    refundValue: Math.max(0, Math.round(input.refundValue)),
    note: input.note ?? null,
  };

  await db.returns.add(productReturn);

  if (input.sellable) {
    await recordStockMovement({
      variantId: input.variantId,
      type: "return",
      qty,
      note: "Retur layak jual",
    });
  }
}

export async function listReturns(limit = 50): Promise<ProductReturn[]> {
  const rows = await getDb().returns.toArray();
  return rows.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limit);
}

export async function listReturnsByCustomer(
  customerId: string,
): Promise<ProductReturn[]> {
  const rows = await getDb()
    .returns.where("customerId")
    .equals(customerId)
    .toArray();
  return rows.sort((a, b) => b.occurredAt - a.occurredAt);
}

export function lastPaidPriceFor(
  variantId: string,
  transactions: { id: string; customerId: string | null; cancelled: boolean }[],
  items: { transactionId: string; variantId: string; unitPrice: number }[],
): number | null {
  const transactionIds = transactions
    .filter((transaction) => !transaction.cancelled)
    .map((transaction) => transaction.id);
  const matching = items.filter(
    (item) =>
      item.variantId === variantId && transactionIds.includes(item.transactionId),
  );
  if (matching.length === 0) return null;
  return matching[matching.length - 1].unitPrice;
}
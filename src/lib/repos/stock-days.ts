import { getDb } from "../db";
import { wibDateString } from "../format";
import { newId } from "../id";
import type { StockClosing, StockClosingItem, StockMovementType } from "../types";
import { listVariantsWithProduct } from "./products";
import { recordStockMovement } from "./stock";

export interface DayRow {
  variantId: string;
  productName: string;
  sizeName: string;
  openingQty: number | null;
  addedQty: number;
  soldQty: number;
  damagedQty: number;
  expectedQty: number | null;
  currentStock: number;
  closedActual: number | null;
  closedDifference: number | null;
}

export interface DaySummary {
  date: string;
  closing: StockClosing | null;
  rows: DayRow[];
}

export async function getDaySummary(
  date = wibDateString(),
): Promise<DaySummary> {
  const db = getDb();
  const variants = await listVariantsWithProduct(true);
  const [openings, closing, movements] = await Promise.all([
    db.stockOpenings.where("date").equals(date).toArray(),
    db.stockClosings.where("date").equals(date).first(),
    db.stockMovements.toArray(),
  ]);

  const closingItems = closing
    ? await db.stockClosingItems.where("closingId").equals(closing.id).toArray()
    : [];

  const todayMovements = movements.filter(
    (movement) => wibDateString(movement.occurredAt) === date,
  );

  const rows: DayRow[] = variants.map((variant) => {
    const opening = openings.find((item) => item.variantId === variant.id);
    const variantMovements = todayMovements.filter(
      (movement) => movement.variantId === variant.id,
    );

    const sum = (types: StockMovementType[]) =>
      variantMovements
        .filter((movement) => types.includes(movement.type))
        .reduce((total, movement) => total + Math.abs(movement.qty), 0);

    const addedQty = sum(["addition"]);
    const soldQty = sum(["sale", "bonus"]);
    const damagedQty = sum(["damage"]);
    const expectedQty = opening
      ? opening.qty + addedQty - soldQty - damagedQty
      : null;

    const closed = closingItems.find((item) => item.variantId === variant.id);

    return {
      variantId: variant.id,
      productName: variant.productName,
      sizeName: variant.sizeName,
      openingQty: opening?.qty ?? null,
      addedQty,
      soldQty,
      damagedQty,
      expectedQty,
      currentStock: variant.stock,
      closedActual: closed?.actualQty ?? null,
      closedDifference: closed?.difference ?? null,
    };
  });

  return { date, closing: closing ?? null, rows };
}

export async function saveOpening(
  variantId: string,
  countedQty: number,
  date = wibDateString(),
): Promise<void> {
  const db = getDb();
  const counted = Math.max(0, Math.round(countedQty));

  await db.transaction(
    "rw",
    [db.stockOpenings, db.stockMovements, db.productVariants],
    async () => {
      const variant = await db.productVariants.get(variantId);
      if (!variant) throw new Error("Produk tidak ditemukan");

      const existing = await db.stockOpenings
        .where("[date+variantId]")
        .equals([date, variantId])
        .first();

      const base = existing ? existing.qty : variant.stock;
      const adjustment = counted - base;

      if (existing) {
        await db.stockOpenings.update(existing.id, { qty: counted });
      } else {
        await db.stockOpenings.add({
          id: newId(),
          date,
          variantId,
          qty: counted,
          createdAt: Date.now(),
        });
      }

      if (adjustment !== 0) {
        await db.stockMovements.add({
          id: newId(),
          variantId,
          occurredAt: Date.now(),
          type: "opening",
          qty: adjustment,
          refTransactionId: null,
          note: "Penyesuaian stok awal",
        });
        await db.productVariants.update(variantId, {
          stock: variant.stock + adjustment,
        });
      }
    },
  );
}

export async function recordAddition(
  variantId: string,
  qty: number,
  note?: string | null,
): Promise<void> {
  const amount = Math.max(1, Math.round(qty));
  await recordStockMovement({
    variantId,
    type: "addition",
    qty: amount,
    note: note ?? "Tambahan stok",
  });
}

export async function recordDamage(
  variantId: string,
  qty: number,
  note?: string | null,
): Promise<void> {
  const amount = Math.max(1, Math.round(qty));
  await recordStockMovement({
    variantId,
    type: "damage",
    qty: -amount,
    note: note ?? "Produk rusak / tidak laku",
  });
}

export async function closeDay(
  actuals: Record<string, number>,
  note?: string | null,
  date = wibDateString(),
): Promise<StockClosing> {
  const db = getDb();
  const summary = await getDaySummary(date);

  if (summary.closing) throw new Error("Tutup buku hari ini sudah dilakukan");

  const closing: StockClosing = {
    id: newId(),
    date,
    closedAt: Date.now(),
    note: note ?? null,
  };

  const items: StockClosingItem[] = [];

  await db.transaction(
    "rw",
    [
      db.stockClosings,
      db.stockClosingItems,
      db.stockMovements,
      db.productVariants,
    ],
    async () => {
      await db.stockClosings.add(closing);

      for (const row of summary.rows) {
        const actual = actuals[row.variantId];
        if (actual === undefined || !Number.isFinite(actual)) continue;

        const actualQty = Math.max(0, Math.round(actual));
        const difference =
          row.expectedQty !== null ? actualQty - row.expectedQty : null;

        items.push({
          id: newId(),
          closingId: closing.id,
          variantId: row.variantId,
          openingQty: row.openingQty,
          addedQty: row.addedQty,
          soldQty: row.soldQty,
          damagedQty: row.damagedQty,
          expectedQty: row.expectedQty,
          actualQty,
          difference,
        });

        const correction = actualQty - row.currentStock;
        if (correction !== 0) {
          await db.stockMovements.add({
            id: newId(),
            variantId: row.variantId,
            occurredAt: Date.now(),
            type: "correction",
            qty: correction,
            refTransactionId: null,
            note: "Koreksi tutup buku",
          });
          await db.productVariants.update(row.variantId, {
            stock: actualQty,
          });
        }
      }

      if (items.length > 0) {
        await db.stockClosingItems.bulkAdd(items);
      }
    },
  );

  return closing;
}

export async function getOpeningSuggestions(
  date = wibDateString(),
): Promise<Record<string, number>> {
  const db = getDb();
  const [variants, openings, closings] = await Promise.all([
    db.productVariants.toArray(),
    db.stockOpenings.where("date").equals(date).toArray(),
    db.stockClosings.orderBy("date").reverse().limit(1).toArray(),
  ]);

  const suggestions: Record<string, number> = {};

  const lastClosing = closings.find((closing) => closing.date < date);
  const lastItems = lastClosing
    ? await db.stockClosingItems
        .where("closingId")
        .equals(lastClosing.id)
        .toArray()
    : [];

  for (const variant of variants) {
    const opening = openings.find((item) => item.variantId === variant.id);
    const previous = lastItems.find((item) => item.variantId === variant.id);
    suggestions[variant.id] = opening
      ? opening.qty
      : (previous?.actualQty ?? variant.stock);
  }

  return suggestions;
}

export async function listRecentClosings(limit = 5): Promise<StockClosing[]> {
  return getDb()
    .stockClosings.orderBy("closedAt")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getClosingItems(
  closingId: string,
): Promise<StockClosingItem[]> {
  return getDb()
    .stockClosingItems.where("closingId")
    .equals(closingId)
    .toArray();
}
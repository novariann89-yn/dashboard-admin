import { getDb } from "../db";
import { newId } from "../id";
import type { ProductVariant, StockEvent, StockEventType } from "../types";
import { listVariantsWithProduct } from "./products";
import { logAudit } from "./audit";

export interface VariantWithProduct extends ProductVariant {
  productName: string;
  productEmoji: string;
}

const ABSOLUTE: ReadonlySet<StockEventType> = new Set(["count", "reset"]);

export async function listStock(): Promise<VariantWithProduct[]> {
  return listVariantsWithProduct(true);
}

export function stockLevel(stock: number): "high" | "low" | "empty" {
  if (stock <= 0) return "empty";
  if (stock <= 20) return "low";
  return "high";
}

// Stock is derived from an append-only event log so two phones can sell at the
// same time and still converge (a plain "current stock" field would lose one of
// the concurrent decrements under last-write-wins). Absolute events (count/reset)
// reset the running value; delta events (sale/restock/refund) add to it.
export function replayStockEvents(events: StockEvent[]): number {
  const sorted = [...events].sort(
    (a, b) =>
      a.at - b.at ||
      (ABSOLUTE.has(a.type) ? 0 : 1) - (ABSOLUTE.has(b.type) ? 0 : 1) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let running = 0;
  for (const event of sorted) {
    running = ABSOLUTE.has(event.type) ? event.value : running + event.value;
  }
  return Math.max(0, running);
}

export async function recomputeStock(variantId: string): Promise<number> {
  const db = getDb();
  const variant = await db.productVariants.get(variantId);
  if (!variant) return 0;
  const events = await db.stockEvents
    .where("variantId")
    .equals(variantId)
    .toArray();
  if (events.length === 0) return variant.stock;
  const next = replayStockEvents(events);
  if (next !== variant.stock) {
    // cache only — never touch updatedAt (that would win metadata LWW with stale data)
    await db.productVariants.update(variantId, { stock: next });
  }
  return next;
}

export async function appendStockEvent(
  variantId: string,
  type: StockEventType,
  value: number,
  refId: string | null = null,
): Promise<number> {
  const db = getDb();
  const variant = await db.productVariants.get(variantId);
  if (!variant) throw new Error("Produk tidak ditemukan");

  const at = Date.now();
  const rows: StockEvent[] = [];

  if (!ABSOLUTE.has(type)) {
    // Seed a base from the pre-event stock so deltas land on the right number.
    // ponytail: base id is deterministic, so the two phones' bases dedupe by id
    // instead of summing; residual divergence resolves deterministically on merge.
    const events = await db.stockEvents
      .where("variantId")
      .equals(variantId)
      .toArray();
    if (!events.some((event) => ABSOLUTE.has(event.type))) {
      rows.push({
        id: `base:${variantId}`,
        variantId,
        type: "count",
        value: variant.stock,
        refId: null,
        at,
      });
    }
  }

  rows.push({ id: newId(), variantId, type, value, refId, at });
  await db.stockEvents.bulkPut(rows);
  return recomputeStock(variantId);
}

export async function addStock(variantId: string, qty: number): Promise<number> {
  const value = Math.floor(qty);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Jumlah harus lebih dari 0");
  }
  const variant = await getDb().productVariants.get(variantId);
  if (!variant) throw new Error("Produk tidak ditemukan");

  const next = await appendStockEvent(variantId, "restock", value);
  await logAudit({
    action: "stock_addition",
    table: "productVariants",
    recordId: variantId,
    oldData: { stock: variant.stock },
    newData: { stock: next, added: value },
  });
  return next;
}

// Collapses each variant's log into one absolute count event (the current
// stock). Replay already ignores deltas that precede the latest count, so this
// is sync-safe: a peer that still holds the old events just re-sends them and
// they stay ignored. ponytail: they can be resurrected once per peer until both
// sides compact, so the log shrinks only after both phones have compacted.
export async function compactStockEvents(): Promise<number> {
  const db = getDb();
  return db.transaction(
    "rw",
    [db.stockEvents, db.productVariants],
    async () => {
      const events = await db.stockEvents.toArray();
      if (events.length === 0) return 0;

      const byVariant = new Map<string, StockEvent[]>();
      for (const event of events) {
        const list = byVariant.get(event.variantId) ?? [];
        list.push(event);
        byVariant.set(event.variantId, list);
      }

      const at = Date.now();
      const snapshots: StockEvent[] = [];
      for (const [variantId, list] of byVariant) {
        const value = replayStockEvents(list);
        snapshots.push({
          id: `snapshot:${variantId}:${at}`,
          variantId,
          type: "count",
          value,
          refId: null,
          at,
        });
        await db.productVariants.update(variantId, { stock: value });
      }

      await db.stockEvents.clear();
      await db.stockEvents.bulkPut(snapshots);
      return events.length;
    },
  );
}

// Called on app load; collapses the log only once it has grown enough to matter.
export async function compactStockEventsIfNeeded(threshold = 500): Promise<void> {
  if ((await getDb().stockEvents.count()) < threshold) return;
  await compactStockEvents();
}

export async function setStock(variantId: string, qty: number): Promise<number> {
  const value = Math.max(0, Math.floor(qty));
  if (!Number.isFinite(value)) throw new Error("Jumlah tidak valid");
  const variant = await getDb().productVariants.get(variantId);
  if (!variant) throw new Error("Produk tidak ditemukan");

  const next = await appendStockEvent(variantId, "count", value);
  await logAudit({
    action: "stock_adjust",
    table: "productVariants",
    recordId: variantId,
    oldData: { stock: variant.stock },
    newData: { stock: next },
  });
  return next;
}
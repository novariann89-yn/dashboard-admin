import { getDb } from "../db";
import type {
  Customer,
  Expense,
  LoyaltyClaim,
  Product,
  ProductVariant,
  StockEvent,
  Tombstone,
  Transaction,
  TransactionItem,
} from "../types";
import { addTombstones, listTombstones } from "../repos/tombstones";
import { recomputeStock } from "../repos/stock";

export const SYNC_APP = "dashboard-admin-sync";
export const SYNC_VERSION = 3;

export interface HistoryPayload {
  app: string;
  version: number;
  sentAt: number;
  transactions: Transaction[];
  transactionItems: TransactionItem[];
  expenses: Expense[];
  loyaltyClaims: LoyaltyClaim[];
  customers: Customer[];
  products: Product[];
  productVariants: ProductVariant[];
  tombstones: Tombstone[];
  stockEvents: StockEvent[];
}

export async function buildHistoryPayload(): Promise<HistoryPayload> {
  const db = getDb();
  const [
    transactions,
    transactionItems,
    expenses,
    loyaltyClaims,
    customers,
    products,
    productVariants,
    tombstones,
    stockEvents,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.transactionItems.toArray(),
    db.expenses.toArray(),
    db.loyaltyClaims.toArray(),
    db.customers.toArray(),
    db.products.toArray(),
    db.productVariants.toArray(),
    listTombstones(),
    db.stockEvents.toArray(),
  ]);

  return {
    app: SYNC_APP,
    version: SYNC_VERSION,
    sentAt: Date.now(),
    transactions,
    transactionItems,
    expenses,
    loyaltyClaims,
    customers,
    products,
    productVariants,
    tombstones,
    stockEvents,
  };
}

export function isHistoryPayload(value: unknown): value is HistoryPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<HistoryPayload>;
  return payload.app === SYNC_APP && payload.version === SYNC_VERSION;
}

// Last-write-wins for mutable rows. ponytail: relies on device clocks (accepted);
// if timestamps tie, both phones compare the same two serialized rows, so the
// lexicographically greater one wins on BOTH sides -> they converge.
export function isNewer(incoming: { updatedAt?: number }, local: { updatedAt?: number }): boolean {
  const a = incoming.updatedAt ?? 0;
  const b = local.updatedAt ?? 0;
  if (a !== b) return a > b;
  return JSON.stringify(incoming) > JSON.stringify(local);
}

// Same-id stock events only collide on the deterministic base event; resolve by
// timestamp + content so both phones keep the same one.
function isNewerEvent(incoming: StockEvent, local: StockEvent): boolean {
  if (incoming.at !== local.at) return incoming.at > local.at;
  return JSON.stringify(incoming) > JSON.stringify(local);
}

export interface MergeSummary {
  transactions: number;
  expenses: number;
  customers: number;
  loyaltyClaims: number;
  products: number;
  variants: number;
  stockEvents: number;
  deleted: number;
  skipped: number;
}

export async function applyHistoryPayload(
  payload: HistoryPayload,
): Promise<MergeSummary> {
  const db = getDb();
  const summary: MergeSummary = {
    transactions: 0,
    expenses: 0,
    customers: 0,
    loyaltyClaims: 0,
    products: 0,
    variants: 0,
    stockEvents: 0,
    deleted: 0,
    skipped: 0,
  };

  await db.transaction("rw", db.tables, async () => {
    // 1. Deletes win: apply the peer's tombstones, then remember them locally.
    for (const tomb of payload.tombstones ?? []) {
      summary.deleted += await applyTombstone(tomb);
    }
    await addTombstones(
      (payload.tombstones ?? []).map((tomb) => ({
        table: tomb.table,
        recordId: tomb.recordId,
      })),
    );

    const allTombs = await listTombstones();
    const tombKeys = new Set(allTombs.map((tomb) => tomb.key));
    const tombTransactions = new Set(
      allTombs.filter((t) => t.table === "transactions").map((t) => t.recordId),
    );
    const tombCustomers = new Set(
      allTombs.filter((t) => t.table === "customers").map((t) => t.recordId),
    );

    // 2. Products: last-write-wins.
    for (const product of payload.products ?? []) {
      if (tombKeys.has(`products:${product.id}`)) {
        summary.skipped += 1;
        continue;
      }
      const existing = await db.products.get(product.id);
      if (!existing) {
        await db.products.add(product);
        summary.products += 1;
      } else if (isNewer(product, existing)) {
        await db.products.put(product);
      } else {
        summary.skipped += 1;
      }
    }

    // 3. Variants (incl. stock): last-write-wins.
    for (const variant of payload.productVariants ?? []) {
      if (tombKeys.has(`productVariants:${variant.id}`)) {
        summary.skipped += 1;
        continue;
      }
      const existing = await db.productVariants.get(variant.id);
      if (!existing) {
        await db.productVariants.add(variant);
        summary.variants += 1;
      } else if (isNewer(variant, existing)) {
        // stock is derived from stockEvents, never carried by metadata LWW
        await db.productVariants.put({ ...variant, stock: existing.stock });
      } else {
        summary.skipped += 1;
      }
    }

    // 4. Customers: last-write-wins.
    for (const customer of payload.customers ?? []) {
      if (tombKeys.has(`customers:${customer.id}`)) {
        summary.skipped += 1;
        continue;
      }
      const existing = await db.customers.get(customer.id);
      if (!existing) {
        await db.customers.add(customer);
        summary.customers += 1;
      } else if (isNewer(customer, existing)) {
        await db.customers.put(customer);
      } else {
        summary.skipped += 1;
      }
    }

    // 5. Transactions + items: union by id.
    const existingTransactionIds = new Set(
      (await db.transactions.toArray()).map((transaction) => transaction.id),
    );
    const existingItemIds = new Set(
      (await db.transactionItems.toArray()).map((item) => item.id),
    );

    for (const transaction of payload.transactions ?? []) {
      if (
        existingTransactionIds.has(transaction.id) ||
        tombTransactions.has(transaction.id)
      ) {
        summary.skipped += 1;
        continue;
      }
      await db.transactions.add(transaction);
      existingTransactionIds.add(transaction.id);
      summary.transactions += 1;
    }

    for (const item of payload.transactionItems ?? []) {
      if (
        existingItemIds.has(item.id) ||
        tombTransactions.has(item.transactionId) ||
        !existingTransactionIds.has(item.transactionId)
      ) {
        continue;
      }
      await db.transactionItems.add(item);
      existingItemIds.add(item.id);
    }

    // 6. Expenses: union by id.
    const existingExpenseIds = new Set(
      (await db.expenses.toArray()).map((expense) => expense.id),
    );
    for (const expense of payload.expenses ?? []) {
      if (
        existingExpenseIds.has(expense.id) ||
        tombKeys.has(`expenses:${expense.id}`)
      ) {
        summary.skipped += 1;
        continue;
      }
      await db.expenses.add(expense);
      existingExpenseIds.add(expense.id);
      summary.expenses += 1;
    }

    // 7. Loyalty claims: union by id (skip claims of tombstoned customers).
    const existingClaimIds = new Set(
      (await db.loyaltyClaims.toArray()).map((claim) => claim.id),
    );
    for (const claim of payload.loyaltyClaims ?? []) {
      if (existingClaimIds.has(claim.id) || tombCustomers.has(claim.customerId)) {
        continue;
      }
      await db.loyaltyClaims.add(claim);
      existingClaimIds.add(claim.id);
      summary.loyaltyClaims += 1;
    }

    // 8. Stock events: union by id (append-only). Every touched variant's stock
    // cache is then recomputed from the merged log, so concurrent sales sum up.
    const touchedVariants = new Set<string>();
    for (const event of payload.stockEvents ?? []) {
      touchedVariants.add(event.variantId);
      const existing = await db.stockEvents.get(event.id);
      if (!existing) {
        await db.stockEvents.add(event);
        summary.stockEvents += 1;
      } else if (isNewerEvent(event, existing)) {
        await db.stockEvents.put(event);
      }
    }
    for (const variantId of touchedVariants) {
      await recomputeStock(variantId);
    }
  });

  return summary;
}

async function applyTombstone(tomb: Tombstone): Promise<number> {
  const db = getDb();
  switch (tomb.table) {
    case "transactions": {
      const existed = await db.transactions.get(tomb.recordId);
      await db.transactionItems
        .where("transactionId")
        .equals(tomb.recordId)
        .delete();
      await db.transactions.delete(tomb.recordId);
      return existed ? 1 : 0;
    }
    case "expenses": {
      const existed = await db.expenses.get(tomb.recordId);
      await db.expenses.delete(tomb.recordId);
      return existed ? 1 : 0;
    }
    case "customers": {
      const existed = await db.customers.get(tomb.recordId);
      await db.loyaltyClaims
        .where("customerId")
        .equals(tomb.recordId)
        .delete();
      await db.customers.delete(tomb.recordId);
      return existed ? 1 : 0;
    }
    case "products": {
      const existed = await db.products.get(tomb.recordId);
      await db.products.delete(tomb.recordId);
      return existed ? 1 : 0;
    }
    case "productVariants": {
      const existed = await db.productVariants.get(tomb.recordId);
      await db.productVariants.delete(tomb.recordId);
      return existed ? 1 : 0;
    }
    default:
      return 0;
  }
}

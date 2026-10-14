import { getDb } from "../db";
import type {
  Customer,
  Expense,
  LoyaltyClaim,
  Product,
  ProductVariant,
  Tombstone,
  Transaction,
  TransactionItem,
} from "../types";
import { addTombstones, listTombstones } from "../repos/tombstones";

export const SYNC_APP = "dashboard-admin-sync";
export const SYNC_VERSION = 1;

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
  ] = await Promise.all([
    db.transactions.toArray(),
    db.transactionItems.toArray(),
    db.expenses.toArray(),
    db.loyaltyClaims.toArray(),
    db.customers.toArray(),
    db.products.toArray(),
    db.productVariants.toArray(),
    listTombstones(),
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
  };
}

export function isHistoryPayload(value: unknown): value is HistoryPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<HistoryPayload>;
  return payload.app === SYNC_APP && typeof payload.version === "number";
}

export interface MergeSummary {
  transactions: number;
  expenses: number;
  customers: number;
  loyaltyClaims: number;
  products: number;
  variants: number;
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
    deleted: 0,
    skipped: 0,
  };

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

  // 2. Catalog: adopt identity + pricing. Keep local stock on existing variants.
  const existingProductIds = new Set(
    (await db.products.toArray()).map((product) => product.id),
  );
  for (const product of payload.products ?? []) {
    if (existingProductIds.has(product.id)) {
      await db.products.update(product.id, {
        name: product.name,
        emoji: product.emoji,
        active: product.active,
        sortOrder: product.sortOrder,
      });
    } else {
      await db.products.add(product);
      summary.products += 1;
    }
  }

  const existingVariantIds = new Set(
    (await db.productVariants.toArray()).map((variant) => variant.id),
  );
  for (const variant of payload.productVariants ?? []) {
    if (existingVariantIds.has(variant.id)) {
      await db.productVariants.update(variant.id, {
        sizeName: variant.sizeName,
        sellPrice: variant.sellPrice,
        costPrice: variant.costPrice,
        netProfitPerUnit: variant.netProfitPerUnit,
        active: variant.active,
        sortOrder: variant.sortOrder,
      });
    } else {
      await db.productVariants.add(variant);
      summary.variants += 1;
    }
  }

  // 3. Customers: add-only.
  const existingCustomerIds = new Set(
    (await db.customers.toArray()).map((customer) => customer.id),
  );
  for (const customer of payload.customers ?? []) {
    if (
      existingCustomerIds.has(customer.id) ||
      tombKeys.has(`customers:${customer.id}`)
    ) {
      summary.skipped += 1;
      continue;
    }
    await db.customers.add(customer);
    existingCustomerIds.add(customer.id);
    summary.customers += 1;
  }

  // 4. Transactions + items: union by id.
  const existingTransactionIds = new Set(
    (await db.transactions.toArray()).map((transaction) => transaction.id),
  );
  const existingItemIds = new Set(
    (await db.transactionItems.toArray()).map((item) => item.id),
  );
  const addedTransactions: Transaction[] = [];

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
    addedTransactions.push(transaction);
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

  // 5. Expenses: union by id.
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

  // 6. Loyalty claims: union by id (skip claims of tombstoned customers).
  const existingClaimIds = new Set(
    (await db.loyaltyClaims.toArray()).map((claim) => claim.id),
  );
  for (const claim of payload.loyaltyClaims ?? []) {
    if (
      existingClaimIds.has(claim.id) ||
      tombCustomers.has(claim.customerId)
    ) {
      continue;
    }
    await db.loyaltyClaims.add(claim);
    existingClaimIds.add(claim.id);
    summary.loyaltyClaims += 1;
  }

  // 7. Stock: subtract the peer's sales, but only for variants we already had.
  //    Brand-new variants already adopted the sender's current stock.
  //    ponytail: restocks/adjustments/cancellations don't sync yet -> stock can
  //    drift; event-sourced stock is the Phase 2 fix.
  for (const transaction of addedTransactions) {
    if (transaction.cancelled) continue;
    for (const item of payload.transactionItems ?? []) {
      if (item.transactionId !== transaction.id) continue;
      if (!existingVariantIds.has(item.variantId)) continue;
      const variant = await db.productVariants.get(item.variantId);
      if (!variant) continue;
      await db.productVariants.update(item.variantId, {
        stock: Math.max(0, variant.stock - item.qty),
      });
    }
  }

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

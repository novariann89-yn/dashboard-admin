import { getDb } from "../db";
import { formatDateTime } from "../format";
import { newId } from "../id";
import { computeTotals } from "../pricing";
import { getSettings } from "../settings";
import { logAudit } from "./audit";
import type { BuyerType, Transaction, TransactionItem, StockMovement } from "../types";

const CANCEL_WINDOW_MS = 15 * 60 * 1000;
const ATTACH_WINDOW_MS = 3 * 60 * 1000;

export interface CreateTransactionInput {
  buyerType: BuyerType;
  customerId: string | null;
  items: { variantId: string; qty: number }[];
  paymentMethod: "cash";
  note?: string | null;
  occurredAt?: number;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  totalCost: number;
  marginWarning: boolean;
}

async function createTransaction(
  input: CreateTransactionInput,
): Promise<CreateTransactionResult> {
  const db = getDb();

  const requested = input.items.filter((item) => item.qty > 0);
  if (requested.length === 0) throw new Error("Keranjang masih kosong");

  const variants = await db.productVariants.bulkGet(
    requested.map((item) => item.variantId),
  );
  const products = await db.products.toArray();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const settings = await getSettings();
  const now = input.occurredAt ?? Date.now();

  let customerName: string | null = null;
  if (input.customerId) {
    const customer = await db.customers.get(input.customerId);
    customerName = customer?.name ?? null;
  }

  const totalBottles = requested.reduce((sum, item) => sum + item.qty, 0);

  const prepared = requested.map((item, index) => {
    const variant = variants[index];
    if (!variant) throw new Error("Produk tidak ditemukan");
    const product = productsById.get(variant.productId);

    return {
      variant,
      productName: product?.name ?? "?",
      qty: Math.floor(item.qty),
      unitPrice: variant.sellPrice,
      unitCost: variant.costPrice,
    };
  });

  const subtotal = prepared.reduce(
    (sum, line) => sum + line.unitPrice * line.qty,
    0,
  );
  const totalCost =
    prepared.reduce((sum, line) => sum + line.unitCost * line.qty, 0);
  const { finalTotal, roundingAdjust } = computeTotals({
    subtotal,
    roundingEnabled: settings.roundingEnabled,
    roundingStep: settings.roundingStep,
  });
  const marginWarning = finalTotal < Math.round(totalCost * 1.1);

  const transaction: Transaction = {
    id: newId(),
    occurredAt: now,
    buyerType: input.buyerType,
    customerId: input.customerId,
    customerName,
    subtotal,
    finalTotal,
    paymentMethod: "cash",
    cancelled: false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: Date.now(),
  };

  const items: TransactionItem[] = prepared.map((line) => ({
    id: newId(),
    transactionId: transaction.id,
    variantId: line.variant.id,
    productName: line.productName,
    sizeName: line.variant.sizeName,
    qty: line.qty,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
  }));

  const movements: StockMovement[] = prepared.map((line) => ({
    id: newId(),
    variantId: line.variant.id,
    occurredAt: now,
    type: "sale" as const,
    qty: -line.qty,
    refTransactionId: transaction.id,
    note: null,
  }));

  await db.transaction(
    "rw",
    [db.transactions, db.transactionItems, db.productVariants],
    async () => {
      await db.transactions.add(transaction);
      await db.transactionItems.bulkAdd(items);

      for (const line of prepared) {
        const current = await db.productVariants.get(line.variant.id);
        if (current) {
          await db.productVariants.update(line.variant.id, {
            stock: Math.max(0, current.stock - line.qty),
          });
        }
      }
    },
  );

  return {
    transaction,
    totalCost,
    marginWarning,
  };
}

export async function listRecentTransactions(limit = 20): Promise<Transaction[]> {
  return getDb()
    .transactions.orderBy("occurredAt")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function listTransactionsByCustomer(
  customerId: string,
): Promise<Transaction[]> {
  const rows = await getDb()
    .transactions.where("customerId")
    .equals(customerId)
    .toArray();
  return rows.sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  return getDb().transactions.get(id);
}

export async function getTransactionItems(
  transactionId: string,
): Promise<TransactionItem[]> {
  return getDb()
    .transactionItems.where("transactionId")
    .equals(transactionId)
    .toArray();
}

export async function cancelLastTransaction(
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Alasan wajib diisi" };

  const latest = await getLatestTransaction();
  if (!latest || latest.cancelled) {
    return { ok: false, error: "Tidak ada transaksi untuk dibatalkan" };
  }
  if (Date.now() - latest.occurredAt > CANCEL_WINDOW_MS) {
    return { ok: false, error: "Sudah lewat 15 menit, tidak bisa dibatalkan" };
  }

  const items = await db.transactionItems
    .where("transactionId")
    .equals(latest.id)
    .toArray();

  for (const item of items) {
    const variant = await db.productVariants.get(item.variantId);
    if (variant) {
      await db.productVariants.update(item.variantId, {
        stock: variant.stock + item.qty,
      });
    }
  }

  await db.transactions.update(latest.id, {
    cancelled: true,
    cancelReason: trimmed,
    cancelledAt: Date.now(),
  });

  await logAudit({
    action: "cancel_transaction",
    table: "transactions",
    recordId: latest.id,
    oldData: { cancelled: false, finalTotal: latest.finalTotal },
    newData: { cancelled: true, reason: trimmed },
  });

  return { ok: true };
}

export async function attachCustomer(
  transactionId: string,
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const transaction = await db.transactions.get(transactionId);
  if (!transaction || transaction.cancelled) {
    return { ok: false, error: "Transaksi tidak ditemukan" };
  }

  const latest = await getLatestTransaction();
  if (!latest || latest.id !== transactionId) {
    return { ok: false, error: "Hanya transaksi terakhir yang bisa ditempeli" };
  }
  if (Date.now() - transaction.occurredAt > ATTACH_WINDOW_MS) {
    return { ok: false, error: "Sudah lewat 3 menit" };
  }

  const customer = await db.customers.get(customerId);
  if (!customer) return { ok: false, error: "Pelanggan tidak ditemukan" };

  await db.transactions.update(transactionId, {
    customerId,
    customerName: customer.name,
  });

  await logAudit({
    action: "attach_customer",
    table: "transactions",
    recordId: transactionId,
    oldData: { customerId: transaction.customerId, customerName: transaction.customerName },
    newData: { customerId, customerName: customer.name },
  });

  return { ok: true };
}

export async function getLatestTransaction(): Promise<Transaction | undefined> {
  const rows = await getDb()
    .transactions.orderBy("occurredAt")
    .reverse()
    .limit(1)
    .toArray();
  return rows[0];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}
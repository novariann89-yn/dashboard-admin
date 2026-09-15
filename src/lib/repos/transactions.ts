import { getDb } from "../db";
import { newId } from "../id";
import { computeTotals, paymentStatusFor } from "../pricing";
import { getSettings } from "../settings";
import type {
  BuyerType,
  PaymentMethod,
  StockMovement,
  Transaction,
  TransactionItem,
} from "../types";

export interface CartLineInput {
  variantId: string;
  qty: number;
  isBonus?: boolean;
}

export interface CreateTransactionInput {
  buyerType: BuyerType;
  customerId: string | null;
  items: CartLineInput[];
  paymentMethod: PaymentMethod;
  paidAmount?: number | null;
  note?: string | null;
  occurredAt?: number;
  discount?: { ruleId: string | null; ruleName: string | null; total: number } | null;
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const db = getDb();

  const lines = input.items.filter((item) => item.qty > 0);
  if (lines.length === 0) throw new Error("Keranjang masih kosong");

  const variants = await db.productVariants.bulkGet(
    lines.map((line) => line.variantId),
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

  const prepared = lines.map((line, index) => {
    const variant = variants[index];
    if (!variant) throw new Error("Produk tidak ditemukan");
    const product = productsById.get(variant.productId);
    const unitPrice = input.buyerType === "reseller" ? variant.resellerPrice : variant.sellPrice;
    return {
      variant,
      productName: product?.name ?? "?",
      sizeName: variant.sizeName,
      qty: Math.floor(line.qty),
      unitPrice,
      unitCost: variant.costPrice,
      isBonus: line.isBonus ?? false,
    };
  });

  const subtotal = prepared.reduce(
    (sum, line) => sum + (line.isBonus ? 0 : line.unitPrice * line.qty),
    0,
  );
  const discountTotal = Math.max(0, Math.round(input.discount?.total ?? 0));
  const totals = computeTotals({
    subtotal,
    discountTotal,
    roundingEnabled: settings.roundingEnabled,
    roundingStep: settings.roundingStep,
  });

  const paidAmount =
    input.paidAmount ?? (input.buyerType === "umum" ? totals.finalTotal : totals.finalTotal);
  const paymentStatus = paymentStatusFor(totals.finalTotal, paidAmount);

  const transaction: Transaction = {
    id: newId(),
    occurredAt: now,
    buyerType: input.buyerType,
    customerId: input.customerId,
    customerName,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    discountRuleId: input.discount?.ruleId ?? null,
    discountRuleName: input.discount?.ruleName ?? null,
    roundingAdjust: totals.roundingAdjust,
    finalTotal: totals.finalTotal,
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paidAmount: Math.max(0, Math.round(paidAmount)),
    note: input.note ?? null,
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
    sizeName: line.sizeName,
    qty: line.qty,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    lineDiscount: 0,
    isBonus: line.isBonus,
  }));

  const movements: StockMovement[] = prepared.map((line) => ({
    id: newId(),
    variantId: line.variant.id,
    occurredAt: now,
    type: line.isBonus ? "bonus" : "sale",
    qty: -line.qty,
    refTransactionId: transaction.id,
    note: null,
  }));

  await db.transaction(
    "rw",
    [
      db.transactions,
      db.transactionItems,
      db.stockMovements,
      db.productVariants,
      db.settings,
    ],
    async () => {
      await db.transactions.add(transaction);
      await db.transactionItems.bulkAdd(items);
      await db.stockMovements.bulkAdd(movements);

      for (const line of prepared) {
        const current = await db.productVariants.get(line.variant.id);
        if (current) {
          await db.productVariants.update(line.variant.id, {
            stock: current.stock - line.qty,
          });
        }
      }
    },
  );

  return transaction;
}

export async function listRecentTransactions(limit = 20): Promise<Transaction[]> {
  const rows = await getDb().transactions.orderBy("occurredAt").reverse().limit(limit).toArray();
  return rows;
}

export async function listTransactionsByCustomer(
  customerId: string,
): Promise<Transaction[]> {
  const rows = await getDb().transactions.where("customerId").equals(customerId).toArray();
  return rows.sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return getDb().transactions.get(id);
}

export async function getTransactionItems(
  transactionId: string,
): Promise<TransactionItem[]> {
  return getDb().transactionItems.where("transactionId").equals(transactionId).toArray();
}

export async function countItems(): Promise<number> {
  return getDb().transactionItems.count();
}
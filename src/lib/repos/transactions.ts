import { getDb } from "../db";
import { computeDiscount, type DiscountOutcome } from "../discounts";
import { daysBetween } from "../format";
import { newId } from "../id";
import { computeTotals, paymentStatusFor } from "../pricing";
import { resolveResellerPrice, type ResellerLevelInput } from "../reseller";
import { getSettings } from "../settings";
import { logAudit } from "./audit";
import type {
  BuyerType,
  PaymentMethod,
  StockMovement,
  Transaction,
  TransactionItem,
} from "../types";

const CANCEL_WINDOW_MS = 15 * 60 * 1000;
const ATTACH_WINDOW_MS = 3 * 60 * 1000;

export interface CreateTransactionInput {
  buyerType: BuyerType;
  customerId: string | null;
  items: { variantId: string; qty: number }[];
  paymentMethod: PaymentMethod;
  paidAmount?: number | null;
  note?: string | null;
  occurredAt?: number;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  discount: DiscountOutcome;
  totalCost: number;
  marginWarning: boolean;
  resellerLevelName: string | null;
}

async function loadResellerLevels(): Promise<ResellerLevelInput[]> {
  const db = getDb();
  const [levels, prices] = await Promise.all([
    db.resellerLevels.toArray(),
    db.resellerLevelPrices.toArray(),
  ]);

  return levels.map((level) => ({
    id: level.id,
    name: level.name,
    minBottles: level.minBottles,
    active: level.active,
    prices: Object.fromEntries(
      prices
        .filter((price) => price.levelId === level.id)
        .map((price) => [price.variantId, price.price]),
    ),
  }));
}

export async function createTransaction(
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
  let lockedLevelId: string | null = null;
  if (input.customerId) {
    const customer = await db.customers.get(input.customerId);
    customerName = customer?.name ?? null;
    lockedLevelId = customer?.resellerLevelId ?? null;
  }

  const totalBottles = requested.reduce((sum, item) => sum + item.qty, 0);
  const levels = input.buyerType === "reseller" ? await loadResellerLevels() : [];

  let resellerLevelName: string | null = null;

  const prepared = requested.map((item, index) => {
    const variant = variants[index];
    if (!variant) throw new Error("Produk tidak ditemukan");
    const product = productsById.get(variant.productId);

    let unitPrice = variant.sellPrice;
    if (input.buyerType === "reseller") {
      const tier = resolveResellerPrice({
        totalBottles,
        moq: settings.resellerMoq,
        levels,
        lockedLevelId,
        variantId: variant.id,
        fallbackPrice: variant.resellerPrice,
      });
      if (tier.eligible) {
        unitPrice = tier.price;
        resellerLevelName = tier.levelName;
      }
    }

    return {
      variant,
      productName: product?.name ?? "?",
      category: product?.category ?? "Umum",
      qty: Math.floor(item.qty),
      unitPrice,
      unitCost: variant.costPrice,
    };
  });

  const rules = await db.discountRules.toArray();
  const variantSellPrices = Object.fromEntries(
    (await db.productVariants.toArray()).map((variant) => [
      variant.id,
      variant.sellPrice,
    ]),
  );

  const discount = computeDiscount({
    buyerType: input.buyerType,
    lines: prepared.map((line) => ({
      variantId: line.variant.id,
      productId: line.variant.productId,
      category: line.category,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    rules,
    variantSellPrices,
    now,
  });

  const subtotal = prepared.reduce(
    (sum, line) => sum + line.unitPrice * line.qty,
    0,
  );
  const discountTotal = Math.min(subtotal, Math.max(0, discount.discountTotal));
  const totals = computeTotals({
    subtotal,
    discountTotal,
    roundingEnabled: settings.roundingEnabled,
    roundingStep: settings.roundingStep,
  });

  const bonusPrepared = await Promise.all(
    discount.bonusItems.map(async (bonus) => {
      const variant = await db.productVariants.get(bonus.variantId);
      if (!variant) return null;
      const product = productsById.get(variant.productId);
      return {
        variant,
        productName: product?.name ?? "?",
        qty: Math.floor(bonus.qty),
        unitCost: variant.costPrice,
      };
    }),
  );

  const bonusLines = bonusPrepared.filter(
    (line): line is NonNullable<typeof line> => line !== null && line.qty > 0,
  );

  const totalCost =
    prepared.reduce((sum, line) => sum + line.unitCost * line.qty, 0) +
    bonusLines.reduce((sum, line) => sum + line.unitCost * line.qty, 0);
  const marginWarning = totals.finalTotal < Math.round(totalCost * 1.1);

  const paidAmount = Math.max(
    0,
    Math.round(input.paidAmount ?? totals.finalTotal),
  );
  const paymentStatus = paymentStatusFor(totals.finalTotal, paidAmount);

  const transaction: Transaction = {
    id: newId(),
    occurredAt: now,
    buyerType: input.buyerType,
    customerId: input.customerId,
    customerName,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    discountRuleId: discount.ruleId,
    discountRuleName: discount.ruleName,
    roundingAdjust: totals.roundingAdjust,
    finalTotal: totals.finalTotal,
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paidAmount,
    note: input.note ?? null,
    cancelled: false,
    cancelReason: null,
    cancelledAt: null,
    createdAt: Date.now(),
  };

  const items: TransactionItem[] = [
    ...prepared.map((line) => ({
      id: newId(),
      transactionId: transaction.id,
      variantId: line.variant.id,
      productName: line.productName,
      sizeName: line.variant.sizeName,
      qty: line.qty,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
      lineDiscount: discount.lineDiscounts[line.variant.id] ?? 0,
      isBonus: false,
    })),
    ...bonusLines.map((line) => ({
      id: newId(),
      transactionId: transaction.id,
      variantId: line.variant.id,
      productName: line.productName,
      sizeName: line.variant.sizeName,
      qty: line.qty,
      unitPrice: 0,
      unitCost: line.unitCost,
      lineDiscount: 0,
      isBonus: true,
    })),
  ];

  const movements: StockMovement[] = [
    ...prepared.map((line) => ({
      id: newId(),
      variantId: line.variant.id,
      occurredAt: now,
      type: "sale" as const,
      qty: -line.qty,
      refTransactionId: transaction.id,
      note: null,
    })),
    ...bonusLines.map((line) => ({
      id: newId(),
      variantId: line.variant.id,
      occurredAt: now,
      type: "bonus" as const,
      qty: -line.qty,
      refTransactionId: transaction.id,
      note: null,
    })),
  ];

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

      const quantities = new Map<string, number>();
      for (const line of [...prepared, ...bonusLines]) {
        quantities.set(
          line.variant.id,
          (quantities.get(line.variant.id) ?? 0) + line.qty,
        );
      }

      for (const [variantId, qty] of quantities) {
        const current = await db.productVariants.get(variantId);
        if (current) {
          await db.productVariants.update(variantId, {
            stock: current.stock - qty,
          });
        }
      }
    },
  );

  return {
    transaction,
    discount,
    totalCost,
    marginWarning,
    resellerLevelName,
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

export interface Receivable {
  transaction: Transaction;
  remaining: number;
  ageDays: number;
}

export async function listReceivables(): Promise<Receivable[]> {
  const rows = await getDb().transactions.toArray();
  return rows
    .filter(
      (transaction) =>
        !transaction.cancelled &&
        transaction.buyerType === "reseller" &&
        transaction.paymentStatus !== "paid",
    )
    .map((transaction) => ({
      transaction,
      remaining: Math.max(0, transaction.finalTotal - transaction.paidAmount),
      ageDays: daysBetween(transaction.occurredAt),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

export async function recordPayment(
  transactionId: string,
  amount: number,
  note?: string | null,
): Promise<void> {
  const db = getDb();
  const transaction = await db.transactions.get(transactionId);
  if (!transaction) throw new Error("Transaksi tidak ditemukan");

  const value = Math.max(0, Math.round(amount));
  if (value <= 0) throw new Error("Jumlah bayar tidak valid");

  const paidAmount = transaction.paidAmount + value;
  const paymentStatus = paymentStatusFor(transaction.finalTotal, paidAmount);

  await db.transaction("rw", [db.payments, db.transactions], async () => {
    await db.payments.add({
      id: newId(),
      transactionId,
      paidAt: Date.now(),
      amount: value,
      note: note ?? null,
    });
    await db.transactions.update(transactionId, { paidAmount, paymentStatus });
  });

  await logAudit({
    action: "record_payment",
    table: "transactions",
    recordId: transactionId,
    oldData: { paidAmount: transaction.paidAmount, paymentStatus: transaction.paymentStatus },
    newData: { paidAmount, paymentStatus, amount: value },
  });
}

export async function listPayments(transactionId: string) {
  return getDb().payments.where("transactionId").equals(transactionId).toArray();
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

export async function cancelLastTransaction(reason: string): Promise<ActionResult> {
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

  const movements: StockMovement[] = items.map((item) => ({
    id: newId(),
    variantId: item.variantId,
    occurredAt: Date.now(),
    type: "cancel",
    qty: item.qty,
    refTransactionId: latest.id,
    note: "Batal transaksi",
  }));

  await db.transaction(
    "rw",
    [db.transactions, db.stockMovements, db.productVariants],
    async () => {
      await db.transactions.update(latest.id, {
        cancelled: true,
        cancelReason: trimmed,
        cancelledAt: Date.now(),
      });

      if (movements.length > 0) {
        await db.stockMovements.bulkAdd(movements);
      }

      for (const item of items) {
        const variant = await db.productVariants.get(item.variantId);
        if (variant) {
          await db.productVariants.update(item.variantId, {
            stock: variant.stock + item.qty,
          });
        }
      }
    },
  );

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
): Promise<ActionResult> {
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
    buyerType: customer.type,
  });

  await logAudit({
    action: "attach_customer",
    table: "transactions",
    recordId: transactionId,
    oldData: { customerId: transaction.customerId, customerName: transaction.customerName },
    newData: { customerId, customerName: customer.name, buyerType: customer.type },
  });

  return { ok: true };
}
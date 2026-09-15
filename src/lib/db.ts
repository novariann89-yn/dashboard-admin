import Dexie, { type Table } from "dexie";
import type {
  AuditLog,
  CashSession,
  Customer,
  DiscountRule,
  Expense,
  Payment,
  PriceHistory,
  Product,
  ProductReturn,
  ProductVariant,
  ResellerLevel,
  ResellerLevelPrice,
  Setting,
  StockClosing,
  StockClosingItem,
  StockMovement,
  StockOpening,
  Transaction,
  TransactionItem,
} from "./types";

export class TokoDB extends Dexie {
  products!: Table<Product, string>;
  productVariants!: Table<ProductVariant, string>;
  priceHistory!: Table<PriceHistory, string>;
  customers!: Table<Customer, string>;
  resellerLevels!: Table<ResellerLevel, string>;
  resellerLevelPrices!: Table<ResellerLevelPrice, string>;
  discountRules!: Table<DiscountRule, string>;
  transactions!: Table<Transaction, string>;
  transactionItems!: Table<TransactionItem, string>;
  payments!: Table<Payment, string>;
  returns!: Table<ProductReturn, string>;
  stockMovements!: Table<StockMovement, string>;
  expenses!: Table<Expense, string>;
  cashSessions!: Table<CashSession, string>;
  auditLog!: Table<AuditLog, string>;
  settings!: Table<Setting, string>;
  stockOpenings!: Table<StockOpening, string>;
  stockClosings!: Table<StockClosing, string>;
  stockClosingItems!: Table<StockClosingItem, string>;

  constructor() {
    super("toko-db");
    this.version(1).stores({
      products: "id, sortOrder, active",
      productVariants: "id, productId, active, sortOrder",
      priceHistory: "id, variantId, createdAt",
      customers: "id, type, phoneNormal, nameNormal, active",
      resellerLevels: "id, sortOrder, active",
      resellerLevelPrices: "id, levelId, variantId, [levelId+variantId]",
      discountRules: "id, active, appliesTo",
      transactions: "id, occurredAt, customerId, buyerType, cancelled",
      transactionItems: "id, transactionId, variantId",
      payments: "id, transactionId, paidAt",
      returns: "id, occurredAt, customerId, variantId",
      stockMovements: "id, variantId, occurredAt, type",
      expenses: "id, occurredAt, category",
      cashSessions: "id, date",
      auditLog: "id, at, table, recordId",
      settings: "key",
    });

    this.version(2).stores({
      stockOpenings: "id, date, variantId, [date+variantId]",
      stockClosings: "id, date, closedAt",
      stockClosingItems: "id, closingId, variantId",
    });
  }
}

let instance: TokoDB | null = null;

export function getDb(): TokoDB {
  if (!instance) instance = new TokoDB();
  return instance;
}

export function resetDbInstance(): void {
  instance = null;
}
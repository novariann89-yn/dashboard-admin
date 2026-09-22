import Dexie, { type Table } from "dexie";
import type {
  AuditLog,
  Customer,
  Expense,
  Product,
  ProductVariant,
  Setting,
  StockOpening,
  Transaction,
  TransactionItem,
} from "./types";

export class TokoDB extends Dexie {
  products!: Table<Product, string>;
  productVariants!: Table<ProductVariant, string>;
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  transactionItems!: Table<TransactionItem, string>;
  expenses!: Table<Expense, string>;
  auditLog!: Table<AuditLog, string>;
  settings!: Table<Setting, string>;
  stockOpenings!: Table<StockOpening, string>;

  constructor() {
    super("toko-db");
    this.version(1).stores({
      products: "id, sortOrder, active, emoji",
      productVariants: "id, productId, active, sortOrder, sellPrice, costPrice",
      customers: "id, name, phoneNormal, nameNormal, active",
      transactions: "id, occurredAt, customerId, paymentMethod, finalTotal, cancelled",
      transactionItems: "id, transactionId, variantId, qty, unitPrice, unitCost",
      expenses: "id, occurredAt, category, amount",
      auditLog: "id, at, table, recordId",
      settings: "key",
      stockOpenings: "id, date, variantId, qty",
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
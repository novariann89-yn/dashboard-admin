import Dexie, { type Table } from "dexie";
import type {
  AuditLog,
  Customer,
  Expense,
  ExpensePreset,
  LoyaltyClaim,
  Product,
  ProductVariant,
  Setting,
  Transaction,
  TransactionItem,
  User,
} from "./types";

export class TokoDB extends Dexie {
  products!: Table<Product, string>;
  productVariants!: Table<ProductVariant, string>;
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  transactionItems!: Table<TransactionItem, string>;
  expenses!: Table<Expense, string>;
  expensePresets!: Table<ExpensePreset, string>;
  users!: Table<User, string>;
  auditLog!: Table<AuditLog, string>;
  settings!: Table<Setting, string>;
  loyaltyClaims!: Table<LoyaltyClaim, string>;

  constructor() {
    super("toko-db");
    this.version(1).stores({
      products: "id, sortOrder, active, emoji",
      productVariants: "id, productId, active, sortOrder, sellPrice, costPrice, netProfitPerUnit, stock",
      customers: "id, name, phoneNormal, nameNormal, active",
      transactions: "id, occurredAt, customerId, paymentMethod, finalTotal, cancelled",
      transactionItems: "id, transactionId, variantId, qty, unitPrice, unitCost, netProfitSnapshot",
      expenses: "id, occurredAt, category, amount",
      expensePresets: "id, sortOrder, active, name",
      users: "id, username, role, active",
      auditLog: "id, at, table, recordId",
      settings: "key",
    });
    this.version(2).stores({
      loyaltyClaims: "id, customerId, productId, claimedAt",
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
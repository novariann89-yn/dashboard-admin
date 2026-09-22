export type ID = string;

export type BuyerType = "umum" | "member";

export interface Product {
  id: ID;
  name: string;
  emoji: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface ProductVariant {
  id: ID;
  productId: ID;
  sizeName: string;
  sellPrice: number;
  costPrice: number;
  stock: number;
  active: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface Customer {
  id: ID;
  name: string;
  phoneNormal: string;
  nameNormal: string;
  active: boolean;
}

export interface Transaction {
  id: ID;
  occurredAt: number;
  buyerType: BuyerType;
  customerId: ID | null;
  customerName: string | null;
  subtotal: number;
  finalTotal: number;
  paymentMethod: "cash";
  cancelled: boolean;
  cancelReason: string | null;
  cancelledAt: number | null;
  createdAt: number;
}

export interface TransactionItem {
  id: ID;
  transactionId: ID;
  variantId: ID;
  productName: string;
  sizeName: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
}

export interface Expense {
  id: ID;
  occurredAt: number;
  category: string;
  amount: number;
  note: string | null;
}

export interface AuditLog {
  id: ID;
  at: number;
  action: string;
  table: string;
  recordId: string | null;
  oldData: string | null;
  newData: string | null;
}

export interface StockMovement {
  id: ID;
  variantId: ID;
  occurredAt: number;
  type: "sale" | "bonus" | "sale" | "cancel";
  qty: number;
  refTransactionId: ID | null;
  note: string | null;
}

export interface StockOpening {
  id: ID;
  date: string;
  variantId: ID;
  qty: number;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: string;
}
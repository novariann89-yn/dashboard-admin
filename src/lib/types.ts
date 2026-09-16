export type ID = string;

export type CustomerType = "member" | "reseller";
export type BuyerType = "umum" | "member" | "reseller";
export type PaymentMethod = "cash" | "qris" | "transfer";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type StockMovementType =
  | "opening"
  | "sale"
  | "bonus"
  | "damage"
  | "return"
  | "addition"
  | "correction";

export interface Product {
  id: ID;
  name: string;
  category: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface ProductVariant {
  id: ID;
  productId: ID;
  sizeName: string;
  sellPrice: number;
  resellerPrice: number;
  costPrice: number;
  stock: number;
  active: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface PriceHistory {
  id: ID;
  variantId: ID;
  sellPrice: number;
  resellerPrice: number;
  costPrice: number;
  createdAt: number;
}

export interface Customer {
  id: ID;
  type: CustomerType;
  name: string;
  nameNormal: string;
  phone: string;
  phoneNormal: string;
  address: string | null;
  note: string | null;
  resellerLevelId: ID | null;
  suggestedPrice: number | null;
  joinedAt: number;
  active: boolean;
}

export interface ResellerLevel {
  id: ID;
  name: string;
  minBottles: number;
  sortOrder: number;
  active: boolean;
}

export interface ResellerLevelPrice {
  id: ID;
  levelId: ID;
  variantId: ID;
  price: number;
}

export type DiscountConditionType =
  | "none"
  | "min_bottles"
  | "min_amount"
  | "multiple_bottles";

export type DiscountEffectType =
  | "percent"
  | "amount"
  | "special_price"
  | "bonus_product";

export interface DiscountRule {
  id: ID;
  name: string;
  appliesTo: BuyerType;
  targetType: "all" | "product" | "variant" | "category";
  targetId: string | null;
  conditionType: DiscountConditionType;
  conditionValue: number;
  effectType: DiscountEffectType;
  effectValue: number;
  bonusVariantId: ID | null;
  bonusQty: number;
  priority: number;
  startsAt: number | null;
  endsAt: number | null;
  active: boolean;
  createdAt: number;
}

export interface Transaction {
  id: ID;
  occurredAt: number;
  buyerType: BuyerType;
  customerId: ID | null;
  customerName: string | null;
  subtotal: number;
  discountTotal: number;
  discountRuleId: ID | null;
  discountRuleName: string | null;
  roundingAdjust: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  note: string | null;
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
  lineDiscount: number;
  isBonus: boolean;
}

export interface Payment {
  id: ID;
  transactionId: ID;
  paidAt: number;
  amount: number;
  note: string | null;
}

export interface ProductReturn {
  id: ID;
  occurredAt: number;
  customerId: ID | null;
  variantId: ID;
  qty: number;
  sellable: boolean;
  refundValue: number;
  note: string | null;
}

export interface StockMovement {
  id: ID;
  variantId: ID;
  occurredAt: number;
  type: StockMovementType;
  qty: number;
  unitCost?: number;
  refTransactionId: ID | null;
  note: string | null;
}

export interface Expense {
  id: ID;
  occurredAt: number;
  category: string;
  amount: number;
  note: string | null;
}

export interface CashSession {
  id: ID;
  date: string;
  openingCash: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  closedAt: number;
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

export interface StockOpening {
  id: ID;
  date: string;
  variantId: ID;
  qty: number;
  createdAt: number;
}

export interface StockClosing {
  id: ID;
  date: string;
  closedAt: number;
  note: string | null;
}

export interface StockClosingItem {
  id: ID;
  closingId: ID;
  variantId: ID;
  openingQty: number | null;
  addedQty: number;
  soldQty: number;
  damagedQty: number;
  expectedQty: number | null;
  actualQty: number;
  difference: number | null;
}

export interface Setting {
  key: string;
  value: string;
}
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReceiptText, whatsappUrl } from "./receipt";
import type { Transaction, TransactionItem } from "./types";

const transaction: Transaction = {
  id: "t1",
  occurredAt: Date.UTC(2026, 8, 14, 3),
  buyerType: "member",
  customerId: "c1",
  customerName: "Budi",
  subtotal: 10000,
  discountTotal: 1000,
  discountRuleId: "r1",
  discountRuleName: "Diskon Member 10%",
  roundingAdjust: 0,
  finalTotal: 9000,
  paymentMethod: "cash",
  paymentStatus: "paid",
  paidAmount: 10000,
  note: null,
  cancelled: false,
  cancelReason: null,
  cancelledAt: null,
  createdAt: 0,
};

const items: TransactionItem[] = [
  {
    id: "i1",
    transactionId: "t1",
    variantId: "small",
    productName: "Sari Kedelai",
    sizeName: "Kecil",
    qty: 2,
    unitPrice: 5000,
    unitCost: 3000,
    lineDiscount: 1000,
    isBonus: false,
  },
];

describe("buildReceiptText", () => {
  it("includes items, discount and total", () => {
    const text = buildReceiptText(transaction, items);
    assert.match(text, /Sari Kedelai Kecil/);
    assert.match(text, /2 x Rp 5\.000 = Rp 10\.000/);
    assert.match(text, /Diskon \(Diskon Member 10%\): -Rp 1\.000/);
    assert.match(text, /TOTAL: Rp 9\.000/);
    assert.match(text, /Pembeli: Budi/);
  });

  it("marks bonus items", () => {
    const text = buildReceiptText(transaction, [
      { ...items[0], isBonus: true, unitPrice: 0, qty: 1, lineDiscount: 0 },
    ]);
    assert.match(text, /\(bonus\)/);
  });
});

describe("whatsappUrl", () => {
  it("converts local phone numbers to international format", () => {
    const url = whatsappUrl("0812-3456-7890", "Halo");
    assert.match(url, /^https:\/\/wa\.me\/6281234567890\?text=Halo/);
  });
});
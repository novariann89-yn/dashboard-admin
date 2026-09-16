import { formatDateTime, rupiah } from "./format";
import { normalizePhone } from "./search";
import type { PaymentMethod, Transaction, TransactionItem } from "./types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

export function buildReceiptText(
  transaction: Transaction,
  items: TransactionItem[],
  storeName = "Toko Sari Kedelai",
): string {
  const lines: string[] = [];

  lines.push(`*${storeName}*`);
  lines.push(formatDateTime(transaction.occurredAt));
  if (transaction.customerName) lines.push(`Pembeli: ${transaction.customerName}`);
  lines.push("");

  for (const item of items) {
    if (item.isBonus) {
      lines.push(`${item.productName} ${item.sizeName} (bonus) x${item.qty}`);
      continue;
    }
    lines.push(`${item.productName} ${item.sizeName}`);
    lines.push(
      `${item.qty} x ${rupiah(item.unitPrice)} = ${rupiah(item.unitPrice * item.qty)}`,
    );
  }

  lines.push("");
  lines.push(`Subtotal: ${rupiah(transaction.subtotal)}`);
  if (transaction.discountTotal > 0) {
    lines.push(
      `Diskon${transaction.discountRuleName ? ` (${transaction.discountRuleName})` : ""}: -${rupiah(transaction.discountTotal)}`,
    );
  }
  if (transaction.roundingAdjust !== 0) {
    lines.push(
      `Pembulatan: ${transaction.roundingAdjust > 0 ? "+" : "-"}${rupiah(Math.abs(transaction.roundingAdjust))}`,
    );
  }
  lines.push(`*TOTAL: ${rupiah(transaction.finalTotal)}*`);
  lines.push(
    `Bayar: ${METHOD_LABELS[transaction.paymentMethod]}${
      transaction.paymentStatus === "partial"
        ? " (DP)"
        : transaction.paymentStatus === "unpaid"
          ? " (tempo)"
          : ""
    }`,
  );

  return lines.join("\n");
}

export function whatsappUrl(phone: string, text: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized
    ? `62${normalized.slice(1)}`
    : phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
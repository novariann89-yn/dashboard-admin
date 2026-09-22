import { formatDateTime, rupiah } from "./format";
import { normalizePhone } from "./search";
import type { Transaction, TransactionItem } from "./types";

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
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
    lines.push(`${item.productName} ${item.sizeName}`);
    lines.push(
      `${item.qty} x ${rupiah(item.unitPrice)} = ${rupiah(item.unitPrice * item.qty)}`,
    );
  }

  lines.push("");
  lines.push(`*TOTAL: ${rupiah(transaction.finalTotal)}*`);
  lines.push(
    `Bayar: ${METHOD_LABELS[transaction.paymentMethod] ?? METHOD_LABELS.cash}`,
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
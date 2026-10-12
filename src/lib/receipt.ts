import { formatDateTime, rupiah } from "./format";
import { normalizePhone } from "./search";
import { getCachedStoreName } from "./settings";
import type { Transaction, TransactionItem } from "./types";

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
};

export function paymentMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

export function buildReceiptText(
  transaction: Transaction,
  items: TransactionItem[],
  storeName = getCachedStoreName(),
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
    `Bayar: ${paymentMethodLabel(transaction.paymentMethod)}`,
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
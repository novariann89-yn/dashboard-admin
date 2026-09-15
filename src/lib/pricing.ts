export interface Totals {
  subtotal: number;
  discountTotal: number;
  roundingAdjust: number;
  finalTotal: number;
}

export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

export function computeTotals(input: {
  subtotal: number;
  discountTotal?: number;
  roundingEnabled: boolean;
  roundingStep: number;
}): Totals {
  const subtotal = Math.max(0, Math.round(input.subtotal));
  const discountTotal = Math.max(0, Math.round(input.discountTotal ?? 0));
  const afterDiscount = Math.max(0, subtotal - discountTotal);

  const finalTotal = input.roundingEnabled
    ? Math.max(0, roundToStep(afterDiscount, input.roundingStep))
    : afterDiscount;

  return {
    subtotal,
    discountTotal,
    roundingAdjust: finalTotal - afterDiscount,
    finalTotal,
  };
}

export function marginPercent(
  sellPrice: number,
  costPrice: number,
): number | null {
  if (!sellPrice || sellPrice <= 0 || !costPrice || costPrice <= 0) return null;
  return ((sellPrice - costPrice) / sellPrice) * 100;
}

export function changeDue(finalTotal: number, paidAmount: number): number {
  return Math.max(0, Math.round(paidAmount) - Math.round(finalTotal));
}

export function paymentStatusFor(
  finalTotal: number,
  paidAmount: number,
): "paid" | "partial" | "unpaid" {
  if (paidAmount >= finalTotal) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}
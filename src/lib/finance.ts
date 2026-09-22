import { startOfTodayWib, wibDateString } from "./format";
import type { BuyerType, Expense, Transaction, TransactionItem } from "./types";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

export type PeriodPreset = "today" | "yesterday" | "week" | "month" | "day";

export interface Period {
  preset: PeriodPreset;
  from: number;
  to: number;
  label: string;
}

function wibStartOfDay(day?: string, now = new Date()): number {
  if (day) {
    const [year, month, date] = day.split("-").map(Number);
    if (year && month && date) {
      return Date.UTC(year, month - 1, date) - WIB_OFFSET_MS;
    }
  }
  return startOfTodayWib(now).getTime();
}

export function resolvePeriod(
  preset: PeriodPreset,
  day?: string,
  now = new Date(),
): Period {
  const today = wibStartOfDay(undefined, now);

  switch (preset) {
    case "today":
      return { preset, from: today, to: today + DAY_MS, label: "Hari ini" };
    case "yesterday":
      return {
        preset,
        from: today - DAY_MS,
        to: today,
        label: "Kemarin",
      };
    case "week":
      return {
        preset,
        from: today - 6 * DAY_MS,
        to: today + DAY_MS,
        label: "7 hari terakhir",
      };
    case "month": {
      const [year, month] = wibDateString(now).split("-").map(Number);
      return {
        preset,
        from: Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS,
        to: Date.UTC(year, month, 1) - WIB_OFFSET_MS,
        label: "Bulan ini",
      };
    }
    case "day": {
      const from = wibStartOfDay(day, now);
      return { preset, from, to: from + DAY_MS, label: day ?? "Tanggal" };
    }
  }
}

function inPeriod(value: number, period: Period): boolean {
  return value >= period.from && value < period.to;
}

export interface SummaryInput {
  transactions: Transaction[];
  items: TransactionItem[];
  expenses: Expense[];
  period: Period;
}

export interface FinancialSummary {
  grossSales: number;
  netSales: number;
  rounding: number;
  netRevenue: number;
  hpp: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number | null;
  transactionCount: number;
  expenses: number;
  damageLoss: number;
}

function activeTransactionsIn(
  transactions: Transaction[],
  period: Period,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      !transaction.cancelled && inPeriod(transaction.occurredAt, period),
  );
}

export function summarize(input: SummaryInput): FinancialSummary {
  const transactions = activeTransactionsIn(input.transactions, input.period);
  const items = input.items.filter(
    (item) => transactions.some((t) => t.id === item.transactionId),
  );

  let grossSales = 0;
  let hpp = 0;
  let bottlesSold = 0;

  for (const item of items) {
    hpp += item.unitCost * item.qty;
    if (item.qty > 0) {
      grossSales += item.unitPrice * item.qty;
      bottlesSold += item.qty;
    }
  }

  let rounding = 0;
  let netRevenue = 0;
  for (const transaction of transactions) {
    netRevenue += transaction.finalTotal;
  }

  const netSales = grossSales - rounding;
  const grossProfit = netRevenue - hpp;

  const expenseTotal = input.expenses
    .filter((expense) => inPeriod(expense.occurredAt, input.period))
    .reduce((sum, expense) => sum + expense.amount, 0);

  const netProfit = grossProfit - expenseTotal;
  const marginPercent = netSales > 0 ? (netProfit / netSales) * 100 : null;

  return {
    grossSales,
    netSales,
    rounding,
    netRevenue,
    hpp,
    grossProfit,
    netProfit,
    marginPercent,
    transactionCount: transactions.length,
    expenses: expenseTotal,
    damageLoss: 0,
  };
}

export interface ProductRow {
  label: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
}

export function byProduct(input: SummaryInput): ProductRow[] {
  const transactions = activeTransactionsIn(input.transactions, input.period);
  const ids = new Set(transactions.map((transaction) => transaction.id));
  const items = input.items.filter((item) => ids.has(item.transactionId));

  const map = new Map<string, { label: string; cost: number; revenue: number; qtySold: number }>();

  for (const item of items) {
    const label = `Produk ${item.variantId}`;

    const existing = map.get(item.variantId);
    if (existing) {
      existing.cost += item.unitCost * item.qty;
      existing.revenue += item.unitPrice * item.qty;
      existing.qtySold += item.qty;
    } else {
      map.set(item.variantId, {
        label,
        cost: item.unitCost * item.qty,
        revenue: item.unitPrice * item.qty,
        qtySold: item.qty,
      });
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      profit: row.revenue - row.cost,
      marginPercent:
        row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : null,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface BuyerRow {
  buyerType: BuyerType;
  label: string;
  transactions: number;
  revenue: number;
  profit: number;
  marginPercent: number | null;
}

const BUYER_LABELS: Record<BuyerType, string> = {
  umum: "Umum",
  member: "Member",
};

export function byBuyerType(input: SummaryInput): BuyerRow[] {
  const transactions = activeTransactionsIn(input.transactions, input.period);
  const itemsByTransaction = new Map<string, TransactionItem[]>();
  for (const item of input.items) {
    const list = itemsByTransaction.get(item.transactionId) ?? [];
    list.push(item);
    itemsByTransaction.set(item.transactionId, list);
  }

  const groups: Record<BuyerType, BuyerRow> = {
    umum: { buyerType: "umum", label: BUYER_LABELS.umum, transactions: 0, revenue: 0, profit: 0, marginPercent: null },
    member: { buyerType: "member", label: BUYER_LABELS.member, transactions: 0, revenue: 0, profit: 0, marginPercent: null },
  };

  for (const transaction of transactions) {
    const group = groups[transaction.buyerType];
    if (!group) continue;
    group.transactions += 1;

    for (const item of itemsByTransaction.get(transaction.id) ?? []) {
      group.profit -= item.unitCost * item.qty;
      group.revenue += item.unitPrice * item.qty;
    }
  }

  return Object.values(groups).map((row) => ({
    ...row,
    profit: row.revenue + row.profit,
    marginPercent:
      row.revenue > 0 ? ((row.revenue + row.profit) / row.revenue) * 100 : null,
  }));
}

export interface ChartPoint {
  date: string;
  label: string;
  omzet: number;
  laba: number;
}

export function dailySeries(
  input: Omit<SummaryInput, "period">,
  days: number,
  now = new Date(),
): ChartPoint[] {
  const today = wibStartOfDay(undefined, now);
  const points: ChartPoint[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const from = today - index * DAY_MS;
    const date = wibDateString(from);
    const summary = summarize({
      ...input,
      period: { preset: "day", from, to: from + DAY_MS, label: date },
    });
    points.push({
      date,
      label: date.slice(8),
      omzet: summary.netRevenue,
      laba: summary.grossProfit,
    });
  }

  return points;
}
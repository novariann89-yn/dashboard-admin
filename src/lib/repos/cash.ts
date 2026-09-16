import { getDb } from "../db";
import { wibDateString } from "../format";
import { newId } from "../id";
import type { CashSession } from "../types";

export interface CashDaySummary {
  date: string;
  openingCash: number | null;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number | null;
  session: CashSession | null;
}

export async function getCashDaySummary(
  date = wibDateString(),
): Promise<CashDaySummary> {
  const db = getDb();
  const [transactions, expenses, payments, sessions] = await Promise.all([
    db.transactions.toArray(),
    db.expenses.toArray(),
    db.payments.toArray(),
    db.cashSessions.where("date").equals(date).toArray(),
  ]);

  const sameDay = (timestamp: number) => wibDateString(timestamp) === date;

  const cashSales =
    transactions
      .filter(
        (transaction) =>
          !transaction.cancelled &&
          transaction.paymentMethod === "cash" &&
          sameDay(transaction.occurredAt),
      )
      .reduce((sum, transaction) => sum + transaction.paidAmount, 0) +
    payments
      .filter((payment) => sameDay(payment.paidAt))
      .reduce((sum, payment) => sum + payment.amount, 0);

  const cashExpenses = expenses
    .filter((expense) => sameDay(expense.occurredAt))
    .reduce((sum, expense) => sum + expense.amount, 0);

  const session = sessions[0] ?? null;
  const openingCash = session?.openingCash ?? null;
  const expectedCash =
    openingCash !== null ? openingCash + cashSales - cashExpenses : null;

  return { date, openingCash, cashSales, cashExpenses, expectedCash, session };
}

export async function closeCash(input: {
  openingCash: number;
  actualCash: number;
  date?: string;
}): Promise<CashSession> {
  const db = getDb();
  const date = input.date ?? wibDateString();

  const existing = await db.cashSessions.where("date").equals(date).first();
  if (existing) throw new Error("Tutup kasir hari ini sudah dilakukan");

  const summary = await getCashDaySummary(date);
  const openingCash = Math.max(0, Math.round(input.openingCash));
  const expectedCash = openingCash + summary.cashSales - summary.cashExpenses;
  const actualCash = Math.max(0, Math.round(input.actualCash));

  const session: CashSession = {
    id: newId(),
    date,
    openingCash,
    expectedCash,
    actualCash,
    difference: actualCash - expectedCash,
    closedAt: Date.now(),
    note: null,
  };

  await db.cashSessions.add(session);
  return session;
}

export async function listCashSessions(limit = 7): Promise<CashSession[]> {
  const rows = await getDb().cashSessions.toArray();
  return rows.sort((a, b) => b.closedAt - a.closedAt).slice(0, limit);
}
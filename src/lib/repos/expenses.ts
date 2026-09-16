import { getDb } from "../db";
import { newId } from "../id";
import type { Expense } from "../types";

export const EXPENSE_CATEGORIES = [
  "Bahan Baku",
  "Sewa Lapak / Retribusi",
  "Transport & Bensin",
  "Plastik & Kemasan",
  "Es Batu",
  "Gaji / Upah",
  "Listrik & Air",
  "Perawatan Alat",
  "Lain-lain",
];

export async function listExpenses(limit = 100): Promise<Expense[]> {
  const rows = await getDb().expenses.toArray();
  return rows.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limit);
}

export async function createExpense(input: {
  category: string;
  amount: number;
  note?: string | null;
}): Promise<Expense> {
  const amount = Math.max(0, Math.round(input.amount));
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0");

  const expense: Expense = {
    id: newId(),
    occurredAt: Date.now(),
    category: input.category.trim() || "Lain-lain",
    amount,
    note: input.note ?? null,
  };

  await getDb().expenses.add(expense);
  return expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await getDb().expenses.delete(id);
}
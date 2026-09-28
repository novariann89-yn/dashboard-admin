import { getDb } from "../db";
import { newId } from "../id";
import type { ExpensePreset } from "../types";
import { EXPENSE_CATEGORIES } from "./expenses";

export async function listExpensePresets(
  activeOnly = true,
): Promise<ExpensePreset[]> {
  const rows = await getDb().expensePresets.toArray();
  return rows
    .filter((preset) => !activeOnly || preset.active)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
}

export async function ensureExpensePresetsSeeded(): Promise<void> {
  const db = getDb();
  if ((await db.expensePresets.count()) > 0) return;

  const presets: ExpensePreset[] = EXPENSE_CATEGORIES.map((name, index) => ({
    id: newId(),
    name,
    sortOrder: index + 1,
    active: true,
    createdAt: Date.now(),
  }));

  await db.expensePresets.bulkAdd(presets);
}

async function assertNameAvailable(
  name: string,
  excludeId?: string,
): Promise<void> {
  const rows = await getDb().expensePresets.toArray();
  const normalized = name.toLowerCase();
  if (
    rows.some(
      (preset) =>
        preset.id !== excludeId && preset.name.toLowerCase() === normalized,
    )
  ) {
    throw new Error("Kategori sudah ada");
  }
}

export async function createExpensePreset(name: string): Promise<ExpensePreset> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama kategori wajib diisi");
  await assertNameAvailable(trimmed);

  const db = getDb();
  const existing = await db.expensePresets.count();
  const preset: ExpensePreset = {
    id: newId(),
    name: trimmed,
    sortOrder: existing + 1,
    active: true,
    createdAt: Date.now(),
  };
  await db.expensePresets.add(preset);
  return preset;
}

export async function updateExpensePreset(
  id: string,
  patch: Partial<Pick<ExpensePreset, "name" | "active" | "sortOrder">>,
): Promise<void> {
  const next: Partial<Pick<ExpensePreset, "name" | "active" | "sortOrder">> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Nama kategori wajib diisi");
    await assertNameAvailable(trimmed, id);
    next.name = trimmed;
  }
  if (patch.active !== undefined) next.active = patch.active;
  if (patch.sortOrder !== undefined) next.sortOrder = patch.sortOrder;
  await getDb().expensePresets.update(id, next);
}

export async function deleteExpensePreset(id: string): Promise<void> {
  await getDb().expensePresets.delete(id);
}

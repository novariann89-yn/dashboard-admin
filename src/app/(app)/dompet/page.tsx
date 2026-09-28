"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import {
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { formatDateTime, rupiah, wibDateString } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  createExpense,
  deleteExpense,
  listExpenses,
} from "@/lib/repos/expenses";
import { getDb } from "@/lib/db";
import { listVariantsWithProduct, profitPerUnit } from "@/lib/repos/products";
import { listExpensePresets } from "@/lib/repos/expense-presets";
import { isTodayWib } from "@/lib/format";
import { resolvePeriod } from "@/lib/finance";

export default function DompetPage() {
  const toast = useToast();
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const expenses = useLiveQuery(() => listExpenses(200), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);
  const presets = useLiveQuery(() => listExpensePresets(), [], []);

  const [date, setDate] = useState(wibDateString());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set([...presets.map((preset) => preset.name), ...EXPENSE_CATEGORIES]),
      ).sort((a, b) => a.localeCompare(b, "id")),
    [presets],
  );

  const today = wibDateString();
  const todayTransactions = transactions.filter(
    (t) => !t.cancelled && isTodayWib(t.occurredAt)
  );

  const todayExpenses = expenses.filter((e) => wibDateString(e.occurredAt) === today);

  const todayItems = items.filter((item) => {
    const transaction = transactions.find((t) => t.id === item.transactionId);
    return transaction && !transaction.cancelled && isTodayWib(transaction.occurredAt);
  });

  const productSales = new Map<string, { qty: number; revenue: number; profit: number; items: string[] }>();
  for (const item of todayItems) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) continue;
    const key = `${variant.productName} ${variant.sizeName}`;
    const existing = productSales.get(key) ?? { qty: 0, revenue: 0, profit: 0, items: [] };
    existing.qty += item.qty;
    existing.revenue += item.unitPrice * item.qty;
    existing.profit += profitPerUnit(item) * item.qty;
    if (!existing.items.includes(key)) existing.items.push(key);
    productSales.set(key, existing);
  }

  const totalOmzet = todayTransactions.reduce((sum, t) => sum + t.finalTotal, 0);
  const totalProfit = Array.from(productSales.values()).reduce((sum, p) => sum + p.profit, 0);
  const totalPengeluaran = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const hasilBersih = totalProfit - totalPengeluaran;

  async function handleSaveExpense() {
    try {
      if (!amount || Number(amount) <= 0) {
        toast("Nominal wajib diisi", "error");
        return;
      }
      if (!date) {
        toast("Tanggal wajib diisi", "error");
        return;
      }
      const occurredAt =
        date === today
          ? Date.now()
          : resolvePeriod("day", date).from + 12 * 60 * 60 * 1000;
      await createExpense({
        category,
        amount: Number(amount),
        note: note || null,
        occurredAt,
      });
      setAmount("");
      setNote("");
      toast(
        date === today
          ? "Pengeluaran dicatat"
          : "Pengeluaran dicatat (lihat Histori)",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mencatat", "error");
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!window.confirm("Hapus pengeluaran ini?")) return;
    await deleteExpense(id);
    toast("Pengeluaran dihapus");
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Dompet</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-card">
          <p className="text-xs font-bold text-ink-soft">Omzet Hari Ini</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{rupiah(totalOmzet)}</p>
        </div>
        <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-card">
          <p className="text-xs font-bold text-ink-soft">Hasil Bersih</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-success">{rupiah(hasilBersih)}</p>
        </div>
        <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-card">
          <p className="text-xs font-bold text-ink-soft">Keuntungan Produk</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-success">{rupiah(totalProfit)}</p>
        </div>
        <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-card">
          <p className="text-xs font-bold text-ink-soft">Pengeluaran Hari Ini</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-error">{rupiah(totalPengeluaran)}</p>
        </div>
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Penjualan Hari Ini</h2>
        {productSales.size === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada penjualan hari ini.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {Array.from(productSales.entries()).map(([label, data]) => (
              <li key={label} className="flex items-center justify-between py-2">
                <span className="text-xs">
                  <span className="font-bold">{label}</span>
                  <span className="block text-[11px] tabular-nums text-ink-soft">
                    {data.qty} terjual
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block font-bold tabular-nums text-success">
                    {rupiah(data.revenue)}
                  </span>
                  <span className="text-[10px] tabular-nums text-ink-soft">
                    untung {rupiah(data.profit)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Catat Pengeluaran</h2>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Tanggal
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Nominal (Rp)
            </span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              placeholder="0"
              className={`${inputClass} text-right font-bold tabular-nums`}
            />
          </label>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            list="expense-categories"
            placeholder="Kategori (pilih atau ketik)"
            className={inputClass}
          />
          <datalist id="expense-categories">
            {categorySuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan (opsional)"
            className={inputClass}
          />
          <button type="button" onClick={handleSaveExpense} className={buttonClass}>
            Simpan Pengeluaran
          </button>
          {date !== today && (
            <p className="text-[11px] text-ink-soft">
              Tanggal selain hari ini tidak muncul di daftar ini — lihat Histori.
            </p>
          )}
        </div>

        {todayExpenses.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada pengeluaran hari ini.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {todayExpenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between py-2">
                <span className="text-sm">
                  <span className="font-bold">{expense.category}</span>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {formatDateTime(expense.occurredAt)}
                    {expense.note ? ` · ${expense.note}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-error">
                    {rupiah(expense.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="text-[10px] font-bold text-error underline"
                  >
                    Hapus
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useToast } from "@/components/toast";
import {
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { formatDateTime, rupiah, wibDateString } from "@/lib/format";
import {
  createExpense,
  deleteExpense,
  listExpenses,
} from "@/lib/repos/expenses";
import { getDb } from "@/lib/db";
import { listVariantsWithProduct, profitPerUnit } from "@/lib/repos/products";
import { listExpensePresets } from "@/lib/repos/expense-presets";
import { isTodayWib } from "@/lib/format";

export default function DompetPage() {
  const toast = useToast();
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const expenses = useLiveQuery(() => listExpenses(200), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);
  const presets = useLiveQuery(() => listExpensePresets(), [], []);

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

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
      if (!category || !amount || Number(amount) <= 0) {
        toast("Kategori dan nominal wajib diisi", "error");
        return;
      }
      await createExpense({ category, amount: Number(amount), note: note || null });
      setAmount("");
      setNote("");
      toast("Pengeluaran dicatat");
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
        <h2 className={sectionLabelClass}>Pengeluaran Hari Ini</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.length === 0 && (
            <p className="text-[11px] text-ink-soft">
              Belum ada kategori. Atur di Setting.
            </p>
          )}
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCategory(preset.name)}
              className={`rounded-control border-2 px-2 py-1.5 text-[11px] font-bold ${
                category === preset.name
                  ? "border-ink bg-primary text-white"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            className={`${inputClass} text-right text-lg font-bold tabular-nums`}
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan (opsional)"
            className={inputClass}
          />
          <button type="button" onClick={handleSaveExpense} className={buttonClass}>
            Simpan Pengeluaran
          </button>
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
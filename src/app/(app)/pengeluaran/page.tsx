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
  EXPENSE_CATEGORIES,
  listExpenses,
} from "@/lib/repos/expenses";

export default function PengeluaranPage() {
  const toast = useToast();
  const expenses = useLiveQuery(() => listExpenses(100), [], []);

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const month = wibDateString().slice(0, 7);
  const monthTotal = expenses
    .filter((expense) => wibDateString(expense.occurredAt).startsWith(month))
    .reduce((sum, expense) => sum + expense.amount, 0);

  async function handleSave() {
    try {
      await createExpense({ category, amount: Number(amount), note: note || null });
      setAmount("");
      setNote("");
      toast("Pengeluaran dicatat");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mencatat", "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Pengeluaran</h1>

      <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-hard-sm">
        <p className={sectionLabelClass}>Total bulan ini</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {rupiah(monthTotal)}
        </p>
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Catat pengeluaran</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-control border-2 px-2 py-1.5 text-[11px] font-bold ${
                category === item
                  ? "border-ink bg-soy"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {item}
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
          <button type="button" onClick={handleSave} className={buttonClass}>
            Simpan pengeluaran
          </button>
          <p className="text-[11px] text-ink-soft">
            Tanggal otomatis (hari ini, WIB). Dianggap pengeluaran tunai untuk
            tutup kasir.
          </p>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Riwayat (100 terakhir)</h2>
        {expenses.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada pengeluaran.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">
                  <span className="font-bold">{expense.category}</span>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {formatDateTime(expense.occurredAt)}
                    {expense.note ? ` · ${expense.note}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    {rupiah(expense.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("Hapus pengeluaran ini?")) return;
                      await deleteExpense(expense.id);
                      toast("Pengeluaran dihapus");
                    }}
                    className="text-[10px] font-bold text-brick underline"
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
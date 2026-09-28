"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { PeriodPicker, type PeriodValue } from "@/components/period-picker";
import {
  buttonClass,
  cardClass,
  sectionLabelClass,
  secondaryButtonClass,
} from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { resolvePeriod } from "@/lib/finance";
import { formatDateTime, rupiah } from "@/lib/format";

export default function LaporanPage() {
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);

  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });

  const period = resolvePeriod(periodValue.preset, periodValue.day);

  const periodTransactions = transactions
    .filter(
      (transaction) =>
        !transaction.cancelled &&
        transaction.occurredAt >= period.from &&
        transaction.occurredAt < period.to,
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);

  function exportHistoris() {
    ;(async () => {
      const rows: string[][] = [["Tanggal", "Transaksi", "Pelanggan", "Produk", "Jumlah", "Total", "Bayar"]];
      for (const transaction of periodTransactions) {
        const transactionItems = await getDb()
          .transactionItems
          .where("transactionId")
          .equals(transaction.id)
          .toArray();
        const productNames = transactionItems
          .map((item) => `${item.productName} ${item.sizeName}`)
          .join(", ");
        const totalQty = transactionItems.reduce(
          (sum, item) => sum + item.qty,
          0,
        );
        rows.push([
          formatDateTime(transaction.occurredAt),
          transaction.id.slice(0, 8),
          transaction.customerName ?? "Umum",
          productNames,
          String(totalQty),
          rupiah(transaction.finalTotal),
          transaction.paymentMethod,
        ]);
      }
      downloadCsv(`historis-${period.label}.csv`, rows);
    })();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-col gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Histori</h1>
        <PeriodPicker value={periodValue} onChange={setPeriodValue} />
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Riwayat Transaksi · {period.label}</h2>
        {periodTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {periodTransactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">
                  <span className="font-bold">
                    {formatDateTime(transaction.occurredAt)}
                  </span>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {transaction.paymentMethod === "cash"
                      ? "Tunai"
                      : transaction.paymentMethod === "qris"
                        ? "QRIS"
                        : "Transfer"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold tabular-nums">
                    {rupiah(transaction.finalTotal)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Export</h2>
          <button
            type="button"
            onClick={exportHistoris}
            className={`${secondaryButtonClass} no-print mt-2 w-full`}
          >
            Export CSV
          </button>
        </div>
        {periodTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada data.</p>
        ) : (
          <p className="mt-1 text-[10px] text-ink-soft">
            CSV memakai pemisah titik-koma agar rapi di Excel. Untuk cetak: pilih
            "Cetak / Simpan PDF" di dialog cetak.
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={() => window.print()}
        className={`${buttonClass} no-print w-full`}
      >
        Cetak / Simpan PDF
      </button>

      <p className="no-print text-xs text-ink-soft">
        Data historis tetap tersimpan meskipun hari telah berganti. Gunakan filter
        periode di atas untuk melihat transaksi lama.
      </p>
    </div>
  );
}
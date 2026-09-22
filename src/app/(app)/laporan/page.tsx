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
import {
  byProduct,
  byBuyerType,
  resolvePeriod,
  summarize,
} from "@/lib/finance";
import { formatDateTime, rupiah } from "@/lib/format";
import { listVariantsWithProduct } from "@/lib/repos/products";

export default function LaporanPage() {
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);

  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });

  const period = resolvePeriod(periodValue.preset, periodValue.day);
  const input = { transactions, items, expenses, period };
  const summary = summarize(input);
  const products = byProduct({ ...input, period });

  const periodTransactions = transactions
    .filter(
      (transaction) =>
        !transaction.cancelled &&
        transaction.occurredAt >= period.from &&
        transaction.occurredAt < period.to,
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);

  function exportSummary() {
    downloadCsv(`laporan-ringkasan-${period.label}.csv`, [
      ["Laporan keuangan", period.label],
      ["Omzet (kotor)", summary.grossSales],
      ["Penjualan bersih", summary.netSales],
      ["Pembulatan", summary.rounding],
      ["Laba kotor", summary.grossProfit],
      ["Hasil bersih", summary.netProfit],
      ["Margin (%)", summary.marginPercent === null ? "" : summary.marginPercent.toFixed(1)],
      ["Jumlah transaksi", summary.transactionCount],
    ]);
  }

  function exportProducts() {
    downloadCsv(`laporan-produk-${period.label}.csv`, [
      ["Produk", "Terjual", "Omzet", "Laba"],
      ...products.map((row) => [
        row.label,
        row.qtySold,
        row.revenue,
        row.profit,
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-col gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Laporan</h1>
        <PeriodPicker value={periodValue} onChange={setPeriodValue} />
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Ringkasan · {period.label}</h2>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Omzet (kotor)</dt>
            <dd className="font-bold tabular-nums">{rupiah(summary.grossSales)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Penjualan bersih</dt>
            <dd className="font-bold tabular-nums text-pingan">{rupiah(summary.netSales)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Laba kotor</dt>
            <dd className="font-bold tabular-nums text-pingan">{rupiah(summary.grossProfit)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Hasil bersih</dt>
            <dd className="font-bold tabular-nums text-pingan">{rupiah(summary.netProfit)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-right text-xs font-bold text-ink-soft">
          Margin:{" "}
          {summary.marginPercent === null
            ? "-"
            : `${summary.marginPercent.toFixed(1)}%`}
        </p>
        <button
          type="button"
          onClick={exportSummary}
          className={`${secondaryButtonClass} no-print mt-3 w-full`}
        >
          Unduh CSV ringkasan
        </button>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Per produk</h2>
          <button
            type="button"
            onClick={exportProducts}
            className="no-print text-xs font-bold text-ink-soft underline"
          >
            CSV
          </button>
        </div>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada penjualan.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-ink-soft">
                  <th className="py-1">Produk</th>
                  <th className="py-1 text-right">Terjual</th>
                  <th className="py-1 text-right">Omzet</th>
                  <th className="py-1 text-right">Laba</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {products.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-1.5 pr-1 font-bold">{row.label}</td>
                    <td className="py-1.5 text-right">{row.qtySold}</td>
                    <td className="py-1.5 text-right">{row.revenue}</td>
                    <td className="py-1.5 text-right font-bold">{row.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>CSV Export</h2>
          <button
            type="button"
            onClick={exportProducts}
            className="no-print text-xs font-bold text-ink-soft underline"
          >
            Produk
          </button>
        </div>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada data.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-ink-soft">
                  <th className="py-1">Produk</th>
                  <th className="py-1 text-right">Terjual</th>
                  <th className="py-1 text-right">Omzet</th>
                  <th className="py-1 text-right">Laba</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {products.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-1.5 pr-1 font-bold">{row.label}</td>
                    <td className="py-1.5 text-right">{row.qtySold}</td>
                    <td className="py-1.5 text-right">{row.revenue}</td>
                    <td className="py-1.5 text-right font-bold">{row.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        CSV memakai pemisah titik-koma agar rapi di Excel. Untuk PDF: pilih
        "Simpan sebagai PDF" di dialog cetak.
      </p>
    </div>
  );
}
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { PeriodPicker, type PeriodValue } from "@/components/period-picker";
import {
  buttonClass,
  cardClass,
  sectionLabelClass,
  secondaryButtonClass,
  statusVoidClass,
} from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import {
  byBuyerType,
  byProduct,
  resolvePeriod,
  summarize,
} from "@/lib/finance";
import { formatDateTime, rupiah } from "@/lib/format";
import { listVariantsWithProduct } from "@/lib/repos/products";

export default function LaporanPage() {
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const movements = useLiveQuery(() => getDb().stockMovements.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);

  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });

  const variantCosts = Object.fromEntries(
    variants.map((variant) => [variant.id, variant.costPrice]),
  );
  const input = { transactions, items, movements, expenses, variantCosts };
  const period = resolvePeriod(periodValue.preset, periodValue.day);

  const summary = summarize({ ...input, period });
  const products = byProduct({ ...input, period });
  const buyers = byBuyerType({ ...input, period });

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
      ["Diskon", summary.discount],
      ["Penjualan bersih", summary.netSales],
      ["Pembulatan", summary.rounding],
      ["HPP / modal terjual", summary.hpp],
      ["Laba kotor", summary.grossProfit],
      ["Biaya operasional", summary.expenses],
      ["Kerugian produk rusak", summary.damageLoss],
      ["Laba bersih", summary.netProfit],
      [
        "Margin (%)",
        summary.marginPercent === null ? "" : summary.marginPercent.toFixed(1),
      ],
      ["Jumlah transaksi", summary.transactionCount],
      ["Botol terjual", summary.bottlesSold],
      ["Botol bonus", summary.bottlesBonus],
    ]);
  }

  function exportProducts() {
    downloadCsv(`laporan-produk-${period.label}.csv`, [
      ["Produk", "Terjual", "Bonus", "Omzet", "Modal", "Laba", "Margin %"],
      ...products.map((row) => [
        row.label,
        row.qtySold,
        row.qtyBonus,
        row.revenue,
        row.cost,
        row.profit,
        row.marginPercent === null ? "" : row.marginPercent.toFixed(1),
      ]),
    ]);
  }

  function exportBuyers() {
    downloadCsv(`laporan-pembeli-${period.label}.csv`, [
      ["Tipe pembeli", "Transaksi", "Omzet", "Laba", "Margin %"],
      ...buyers.map((row) => [
        row.label,
        row.transactions,
        row.revenue,
        row.profit,
        row.marginPercent === null ? "" : row.marginPercent.toFixed(1),
      ]),
    ]);
  }

  function exportTransactions() {
    downloadCsv(`laporan-transaksi-${period.label}.csv`, [
      ["Tanggal", "Pembeli", "Tipe", "Subtotal", "Diskon", "Pembulatan", "Total", "Metode", "Status", "Dibayar"],
      ...periodTransactions.map((transaction) => [
        formatDateTime(transaction.occurredAt),
        transaction.customerName ?? "Umum",
        transaction.buyerType,
        transaction.subtotal,
        transaction.discountTotal,
        transaction.roundingAdjust,
        transaction.finalTotal,
        transaction.paymentMethod,
        transaction.paymentStatus,
        transaction.paidAmount,
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-col gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Laporan</h1>
        <PeriodPicker value={periodValue} onChange={setPeriodValue} />
      </div>

      <section className={`${cardClass} hidden print:block`}>
        <h1 className="text-lg font-extrabold">Laporan Keuangan</h1>
        <p className="text-xs text-ink-soft">
          {period.label} · dicetak {formatDateTime(Date.now())}
        </p>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Ringkasan · {period.label}</h2>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <Line label="Omzet (kotor)" value={summary.grossSales} />
          <Line label="Diskon" value={-summary.discount} />
          <Line label="Penjualan bersih" value={summary.netSales} strong />
          <Line label="Pembulatan" value={summary.rounding} />
          <Line label="HPP / modal terjual" value={-summary.hpp} />
          <Line label="Laba kotor" value={summary.grossProfit} strong />
          <Line label="Biaya operasional" value={-summary.expenses} />
          <Line label="Kerugian produk rusak" value={-summary.damageLoss} />
          <Line label="Laba bersih" value={summary.netProfit} strong />
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
                  <th className="py-1 text-right">Jual</th>
                  <th className="py-1 text-right">Bonus</th>
                  <th className="py-1 text-right">Omzet</th>
                  <th className="py-1 text-right">Laba</th>
                  <th className="py-1 text-right">M%</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {products.map((row) => (
                  <tr key={row.variantId} className="border-t border-line">
                    <td className="py-1.5 pr-1 font-bold">{row.label}</td>
                    <td className="py-1.5 text-right">{row.qtySold}</td>
                    <td className="py-1.5 text-right">{row.qtyBonus}</td>
                    <td className="py-1.5 text-right">{row.revenue}</td>
                    <td className="py-1.5 text-right font-bold">
                      {row.profit}
                    </td>
                    <td className="py-1.5 text-right">
                      {row.marginPercent === null
                        ? "-"
                        : row.marginPercent.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Per tipe pembeli</h2>
          <button
            type="button"
            onClick={exportBuyers}
            className="no-print text-xs font-bold text-ink-soft underline"
          >
            CSV
          </button>
        </div>
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {buyers.map((row) => (
            <li key={row.buyerType} className="flex items-center justify-between py-2 text-xs">
              <span className="font-bold">{row.label}</span>
              <span className="tabular-nums text-ink-soft">
                {row.transactions}x · {rupiah(row.revenue)} · laba{" "}
                <span className="font-bold text-pandan">{rupiah(row.profit)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>
            Transaksi ({periodTransactions.length})
          </h2>
          <button
            type="button"
            onClick={exportTransactions}
            className="no-print text-xs font-bold text-ink-soft underline"
          >
            CSV
          </button>
        </div>
        {periodTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Tidak ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {periodTransactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between py-2 text-xs">
                <span>
                  <span className="font-bold">
                    {transaction.customerName ?? "Umum"}
                  </span>
                  <span className="block tabular-nums text-ink-soft">
                    {formatDateTime(transaction.occurredAt)} ·{" "}
                    {transaction.buyerType}
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-bold tabular-nums">
                    {rupiah(transaction.finalTotal)}
                  </span>
                  {transaction.paymentStatus !== "paid" && (
                    <span className={`${statusVoidClass} ml-1`}>
                      {transaction.paymentStatus === "partial" ? "DP" : "tempo"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
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

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-bold" : "text-ink-soft"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-extrabold" : ""}`}>
        {value < 0 ? `−${rupiah(Math.abs(value))}` : rupiah(value)}
      </dd>
    </div>
  );
}
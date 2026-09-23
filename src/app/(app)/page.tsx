"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { IconDownload, IconPlus } from "@/components/icons";
import { FinanceChart } from "@/components/line-chart";
import { PeriodPicker, type PeriodValue } from "@/components/period-picker";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  cardClass,
  linkClass,
  sectionLabelClass,
  statusVoidClass,
  strongCardClass,
} from "@/components/ui";
import { downloadBackup } from "@/lib/backup";
import { getDb } from "@/lib/db";
import {
  byBuyerType,
  byProduct,
  dailySeries,
  resolvePeriod,
  summarize,
} from "@/lib/finance";
import { formatTime, isTodayWib, rupiah } from "@/lib/format";
import { listCustomers } from "@/lib/repos/customers";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { stockLevel } from "@/lib/repos/stock";
import { cancelLastTransaction, getTransactionItems } from "@/lib/repos/transactions";
import { buildReceiptText, whatsappUrl } from "@/lib/receipt";
import { getSettings } from "@/lib/settings";

export default function BerandaPage() {
  const toast = useToast();

  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);
  const settings = useLiveQuery(() => getSettings(), [], null);
  const customers = useLiveQuery(() => listCustomers(), [], []);

  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });
  const [chartDays, setChartDays] = useState(7);

  const variantCosts = Object.fromEntries(
    variants.map((variant) => [variant.id, variant.costPrice]),
  );
  const input = { transactions, items, expenses, variantCosts };
  const period = resolvePeriod(periodValue.preset, periodValue.day);

  const summary = summarize({ ...input, period });
  const products = byProduct({ ...input, period });
  const buyers = byBuyerType({ ...input, period });
  const chart = dailySeries(input, chartDays);

  const lowStock = variants.filter(
    (variant) => variant.active && stockLevel(variant.stock) !== "high",
  );
  const missingCost = variants.filter(
    (variant) => variant.active && variant.costPrice <= 0,
  );

  const needsBackup =
    settings !== null && Date.now() - settings.lastBackupAt > 24 * 60 * 60 * 1000;

  const recent = [...transactions]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, 5);

  const latestActive =
    [...transactions]
      .filter((transaction) => !transaction.cancelled)
      .sort((a, b) => b.occurredAt - a.occurredAt)[0] ?? null;
  const canCancelLatest = latestActive
    ? Date.now() - latestActive.occurredAt <= 15 * 60 * 1000
    : false;

  const todayBottles = items
    .filter((item) => {
      const transaction = transactions.find((t) => t.id === item.transactionId);
      return transaction && !transaction.cancelled && isTodayWib(transaction.occurredAt);
    })
    .reduce((sum, item) => sum + item.qty, 0);

  async function handleBackup() {
    await downloadBackup();
    toast("Backup diunduh");
  }

  async function handleCancelLatest() {
    const reason = window.prompt("Alasan pembatalan?");
    if (!reason || !reason.trim()) return;
    if (!window.confirm("Batalkan transaksi terakhir? Stok akan dikembalikan.")) {
      return;
    }
    const result = await cancelLastTransaction(reason);
    if (!result.ok) {
      toast(result.error ?? "Gagal membatalkan", "error");
      return;
    }
    toast("Transaksi dibatalkan, stok dikembalikan");
  }

  async function handleWhatsapp(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    let phone = transaction.customerId
      ? (customers.find((item) => item.id === transaction.customerId)?.phoneNormal ?? "")
      : "";
    if (!phone) {
      phone = window.prompt("Nomor HP tujuan (08xxx)") ?? "";
      if (!phone.trim()) return;
    }
    const items = await getTransactionItems(transaction.id);
    window.open(
      whatsappUrl(phone, buildReceiptText(transaction, items)),
      "_blank",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/beli"
        className="flex items-center justify-center gap-2 rounded-card border-2 border-ink bg-soy px-4 py-4 text-base font-extrabold shadow-hard transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <IconPlus className="h-5 w-5" />
        Catat Pembelian
      </Link>

      <div className="grid grid-cols-4 gap-1.5">
        <Link
          href="/pengeluaran"
          className="rounded-control border-2 border-line bg-surface py-2 text-center text-[11px] font-bold text-ink-soft"
        >
          Pengeluaran
        </Link>
        <Link
          href="/kasir"
          className="rounded-control border-2 border-line bg-surface py-2 text-center text-[11px] font-bold text-ink-soft"
        >
          Kasir
        </Link>
        <Link
          href="/laporan"
          className="rounded-control border-2 border-line bg-surface py-2 text-center text-[11px] font-bold text-ink-soft"
        >
          Laporan
        </Link>
        <Link
          href="/stok"
          className="rounded-control border-2 border-line bg-surface py-2 text-center text-[11px] font-bold text-ink-soft"
        >
          Stok
        </Link>
      </div>

      <PeriodPicker value={periodValue} onChange={setPeriodValue} />

      <div className="grid grid-cols-2 gap-3">
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Omzet</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            {rupiah(summary.grossSales)}
          </p>
          <p className="text-[10px] text-ink-soft">{period.label}</p>
        </div>
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Laba kotor</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-pandan">
            {rupiah(summary.grossProfit)}
          </p>
          <p className="text-[10px] text-ink-soft">{period.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cardClass}>
          <p className="text-xs font-semibold text-ink-soft">Botol terjual</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            —
          </p>
          <p className="text-[10px] tabular-nums text-ink-soft">
            Hari ini: {todayBottles}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold text-ink-soft">Transaksi</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            {summary.transactionCount}
          </p>
        </div>
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Rincian keuangan · {period.label}</h2>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <Row label="Omzet (kotor)" value={summary.grossSales} />
          <Row label="Diskon" value={0} />
          <Row label="Penjualan bersih" value={summary.netSales} strong />
          {summary.rounding !== 0 && (
            <Row label="Pembulatan" value={summary.rounding} />
          )}
          <Row label="HPP / modal terjual" value={-summary.hpp} />
          <div className="my-1 border-t-2 border-dashed border-ink/25" />
          <Row label="Laba kotor" value={summary.grossProfit} strong />
          <Row label="Biaya operasional" value={-summary.expenses} />
          <Row label="Kerugian produk rusak" value={-summary.damageLoss} />
          <div className="my-1 border-t-2 border-ink" />
          <Row label="Laba bersih" value={summary.netProfit} strong />
        </dl>
        <p className="mt-2 text-right text-xs font-bold text-ink-soft">
          Margin:{" "}
          {summary.marginPercent === null
            ? "-"
            : `${summary.marginPercent.toFixed(1)}%`}
        </p>
        <Link
          href="/laporan"
          className={`${linkClass} mt-2 inline-block text-xs`}
        >
          Laporan & unduh CSV
        </Link>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Grafik omzet & laba</h2>
          <div className="flex gap-1">
            {[7, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setChartDays(days)}
                className={`rounded-control border-2 px-2 py-0.5 text-[11px] font-bold ${
                  chartDays === days
                    ? "border-ink bg-soy"
                    : "border-line bg-surface text-ink-soft"
                }`}
              >
                {days}h
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <FinanceChart data={chart} />
        </div>
      </section>

      <details className={cardClass}>
        <summary className="cursor-pointer text-sm font-extrabold">
          Produk paling untung
        </summary>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada penjualan.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {products.slice(0, 8).map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2">
                <span className="text-xs">
                  <span className="font-bold">{row.label}</span>
                  <span className="block text-[11px] tabular-nums text-ink-soft">
                    {row.qtySold} terjual
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block font-bold tabular-nums text-pandan">
                    {rupiah(row.profit)}
                  </span>
                  <span className="text-[10px] tabular-nums text-ink-soft">
                    {rupiah(row.revenue)} ·{" "}
                    {row.marginPercent === null
                      ? "-"
                      : `${row.marginPercent.toFixed(0)}%`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className={cardClass}>
        <summary className="cursor-pointer text-sm font-extrabold">
          Rincian per tipe pembeli
        </summary>
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {buyers.map((row) => (
            <li key={row.buyerType} className="flex items-center justify-between py-2">
              <span className="text-xs font-bold">{row.label}</span>
              <span className="text-right text-xs">
                <span className="block font-bold tabular-nums">
                  {rupiah(row.revenue)}
                </span>
                <span className="text-[10px] tabular-nums text-ink-soft">
                  laba {rupiah(row.profit)} · {row.transactions}x
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {lowStock.length > 0 && (
        <section className="rounded-card border-2 border-soy-dark/50 bg-cream p-4">
          <p className="text-sm font-bold text-soy-dark">Stok menipis</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-soy-dark">
            {lowStock.map((variant) => (
              <li key={variant.id} className="tabular-nums">
                {variant.productName} {variant.sizeName}: {variant.stock}
              </li>
            ))}
          </ul>
        </section>
      )}

      {missingCost.length > 0 && (
        <section className="rounded-card border-2 border-brick/40 bg-brick/10 p-4">
          <p className="text-sm font-bold text-brick">Produk belum diisi modal</p>
          <ul className="mt-1 text-xs text-brick">
            {missingCost.map((variant) => (
              <li key={variant.id}>
                {variant.productName} {variant.sizeName}
              </li>
            ))}
          </ul>
          <Link
            href="/setting"
            className="mt-2 inline-block text-xs font-bold text-brick underline"
          >
            Isi di Setting
          </Link>
        </section>
      )}

      {needsBackup && (
        <section className="rounded-card border-2 border-soy-dark/50 bg-cream p-4">
          <p className="text-sm font-bold">Belum backup hari ini</p>
          <p className="mt-1 text-xs text-ink-soft">
            Data hanya tersimpan di HP ini. Unduh backup supaya aman.
          </p>
          <button
            onClick={handleBackup}
            className="mt-3 inline-flex items-center gap-2 rounded-control border-2 border-ink bg-soy px-3 py-2 text-xs font-bold shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <IconDownload className="h-4 w-4" />
            Backup sekarang
          </button>
        </section>
      )}

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Transaksi terakhir</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {recent.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm">
                  <span className="font-bold">
                    {transaction.customerName ?? "Umum"}
                  </span>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {formatTime(transaction.occurredAt)} ·{" "}
                    {transaction.paymentMethod === "cash"
                      ? "Tunai"
                      : transaction.paymentMethod === "qris"
                        ? "QRIS"
                        : "Transfer"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold tabular-nums">
                    {rupiah(transaction.finalTotal)}
                  </span>
{transaction.cancelled && (
                    <span className={statusVoidClass}>
                      dibatalkan
                      {transaction.cancelReason
                        ? `: ${transaction.cancelReason}`
                        : ""}
                    </span>
                  )}
                  <span className="mt-1 flex justify-end gap-2">
                    {transaction.id === latestActive?.id && canCancelLatest && (
                      <button
                        type="button"
                        onClick={handleCancelLatest}
                        className="text-[10px] font-bold text-brick underline"
                      >
                        Batalkan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleWhatsapp(transaction.id)}
                      className="text-[10px] font-bold text-pandan underline"
                    >
                      WA
                    </button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({
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
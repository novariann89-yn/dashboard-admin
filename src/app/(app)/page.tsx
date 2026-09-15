"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { IconDownload } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  cardClass,
  linkClass,
  sectionLabelClass,
  strongCardClass,
} from "@/components/ui";
import { downloadBackup } from "@/lib/backup";
import { getDb } from "@/lib/db";
import { formatTime, isTodayWib, rupiah } from "@/lib/format";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { getSettings } from "@/lib/settings";

export default function BerandaPage() {
  const toast = useToast();
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);
  const settings = useLiveQuery(() => getSettings(), [], null);

  const activeToday = transactions.filter(
    (transaction) => !transaction.cancelled && isTodayWib(transaction.occurredAt),
  );
  const todayIds = new Set(activeToday.map((transaction) => transaction.id));
  const todayItems = items.filter((item) => todayIds.has(item.transactionId));

  const revenue = activeToday.reduce(
    (sum, transaction) => sum + transaction.finalTotal,
    0,
  );
  const bottles = todayItems.reduce((sum, item) => sum + item.qty, 0);

  const missingCost = variants.filter(
    (variant) => variant.active && variant.costPrice <= 0,
  );

  const needsBackup =
    settings !== null &&
    Date.now() - settings.lastBackupAt > 24 * 60 * 60 * 1000;

  const recent = [...transactions]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, 5);

  async function handleBackup() {
    await downloadBackup();
    toast("Backup diunduh");
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/beli"
        className="flex items-center justify-center gap-2 rounded-card border-2 border-ink bg-soy px-4 py-4 text-base font-extrabold shadow-hard transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        Catat Pembelian
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Omzet hari ini</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            {rupiah(revenue)}
          </p>
        </div>
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Transaksi</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            {activeToday.length}
          </p>
        </div>
      </div>

      <div className={strongCardClass}>
        <p className={sectionLabelClass}>Botol keluar hari ini</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">{bottles}</p>
      </div>

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
                    <span className="text-[10px] font-bold text-brick">
                      dibatalkan
                    </span>
                  )}
                  {!transaction.cancelled &&
                    transaction.paymentStatus !== "paid" && (
                      <span className="text-[10px] font-bold text-brick">
                        {transaction.paymentStatus === "partial"
                          ? "DP"
                          : "tempo"}
                      </span>
                    )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/pelanggan"
          className={`${linkClass} mt-3 inline-block text-xs`}
        >
          Lihat pelanggan
        </Link>
      </section>
    </div>
  );
}
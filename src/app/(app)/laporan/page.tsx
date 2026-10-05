"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { PeriodPicker, type PeriodValue } from "@/components/period-picker";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  sectionLabelClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { downloadCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { resolvePeriod } from "@/lib/finance";
import { formatDateTime, rupiah } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { canDeleteHistory } from "@/lib/permissions";
import { deleteTransactions } from "@/lib/repos/transactions";
import { useMultiSelect } from "@/lib/use-multi-select";

export default function LaporanPage() {
  const toast = useToast();
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);

  const [canDelete, setCanDelete] = useState(false);
  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });

  useEffect(() => {
    setCanDelete(canDeleteHistory(getSession()));
  }, []);

  const period = resolvePeriod(periodValue.preset, periodValue.day);

  const periodTransactions = transactions
    .filter(
      (transaction) =>
        !transaction.cancelled &&
        transaction.occurredAt >= period.from &&
        transaction.occurredAt < period.to,
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);

  const selection = useMultiSelect(
    periodTransactions.map((transaction) => transaction.id),
    canDelete,
  );

  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodValue]);

  async function deleteSelected() {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    const answer = window.prompt(
      `Ketik HAPUS untuk menghapus ${ids.length} transaksi (stok tidak dikembalikan):`,
    );
    if (answer !== "HAPUS") return;
    await deleteTransactions(ids);
    toast(`${ids.length} transaksi dihapus`);
    selection.clear();
  }

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

        {selection.selectMode && (
          <div className="no-print mt-2 flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas p-2">
            <span className="text-xs font-bold tabular-nums">
              {selection.selected.size} dipilih
            </span>
            <button
              type="button"
              onClick={selection.toggleAll}
              className={smallButtonClass}
            >
              {selection.allSelected ? "Kosongkan" : "Pilih semua"}
            </button>
            <button
              type="button"
              onClick={selection.clear}
              className={smallButtonClass}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={selection.nothingSelected}
              className={`${dangerButtonClass} ml-auto`}
            >
              Hapus
            </button>
          </div>
        )}

        {canDelete && !selection.selectMode && periodTransactions.length > 0 && (
          <p className="mt-1 text-[11px] text-ink-soft">
            Tahan riwayat untuk memilih &amp; hapus.
          </p>
        )}

        {periodTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {periodTransactions.map((transaction) => {
              const isSelected = selection.selected.has(transaction.id);
              return (
                <li
                  key={transaction.id}
                  onPointerDown={() => selection.startHold(transaction.id)}
                  onPointerUp={selection.cancelHold}
                  onPointerLeave={selection.cancelHold}
                  onPointerCancel={selection.cancelHold}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={() => {
                    selection.handleClick(transaction.id);
                  }}
                  className={`flex items-center justify-between gap-2 py-2.5 ${
                    selection.selectMode ? "cursor-pointer" : ""
                  } ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {selection.selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        tabIndex={-1}
                        className="pointer-events-none h-4 w-4 accent-error"
                      />
                    )}
                    <span>
                      <span className="font-bold">
                        {formatDateTime(transaction.occurredAt)}
                      </span>
                      <span className="block text-xs tabular-nums text-ink-soft">
                        Tunai
                      </span>
                    </span>
                  </span>
                  <span className="block font-bold tabular-nums">
                    {rupiah(transaction.finalTotal)}
                  </span>
                </li>
              );
            })}
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
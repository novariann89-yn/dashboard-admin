"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
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

export default function LaporanPage() {
  const toast = useToast();
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const expenses = useLiveQuery(() => getDb().expenses.toArray(), [], []);

  const [canDelete, setCanDelete] = useState(false);
  const [periodValue, setPeriodValue] = useState<PeriodValue>({
    preset: "today",
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    setCanDelete(canDeleteHistory(getSession()));
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, [periodValue]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function startHold(id: string) {
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setSelectMode(true);
      setSelected(new Set([id]));
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 500);
    }, 600);
  }

  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRowClick(id: string) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggleSelect(id);
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const answer = window.prompt(
      `Ketik HAPUS untuk menghapus ${ids.length} transaksi (stok tidak dikembalikan):`,
    );
    if (answer !== "HAPUS") return;
    await deleteTransactions(ids);
    toast(`${ids.length} transaksi dihapus`);
    setSelected(new Set());
    setSelectMode(false);
  }

  const period = resolvePeriod(periodValue.preset, periodValue.day);

  const periodTransactions = transactions
    .filter(
      (transaction) =>
        !transaction.cancelled &&
        transaction.occurredAt >= period.from &&
        transaction.occurredAt < period.to,
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);

  const allSelected =
    periodTransactions.length > 0 &&
    selected.size === periodTransactions.length;

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

        {canDelete && !selectMode && periodTransactions.length > 0 && (
          <p className="mt-1 text-[11px] text-ink-soft">
            Tahan riwayat untuk memilih &amp; hapus.
          </p>
        )}

        {selectMode && (
          <div className="no-print mt-2 flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas p-2">
            <span className="text-xs font-bold tabular-nums">
              {selected.size} dipilih
            </span>
            <button
              type="button"
              onClick={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(periodTransactions.map((transaction) => transaction.id)),
                )
              }
              className={smallButtonClass}
            >
              {allSelected ? "Kosongkan" : "Pilih semua"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setSelectMode(false);
              }}
              className={smallButtonClass}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className={`${dangerButtonClass} ml-auto`}
            >
              Hapus
            </button>
          </div>
        )}

        {periodTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {periodTransactions.map((transaction) => {
              const isSelected = selected.has(transaction.id);
              return (
                <li
                  key={transaction.id}
                  onPointerDown={
                    canDelete && !selectMode
                      ? () => startHold(transaction.id)
                      : undefined
                  }
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={
                    selectMode
                      ? () => handleRowClick(transaction.id)
                      : undefined
                  }
                  className={`flex items-center justify-between gap-2 py-2.5 ${
                    selectMode ? "cursor-pointer" : ""
                  } ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {selectMode && (
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
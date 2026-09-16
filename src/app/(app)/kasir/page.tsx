"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  statusActiveClass,
  statusVoidClass,
} from "@/components/ui";
import { formatDate, rupiah } from "@/lib/format";
import {
  closeCash,
  getCashDaySummary,
  listCashSessions,
} from "@/lib/repos/cash";

export default function KasirPage() {
  const toast = useToast();
  const summary = useLiveQuery(() => getCashDaySummary(), [], null);
  const sessions = useLiveQuery(() => listCashSessions(7), [], []);

  const [openingCash, setOpeningCash] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!summary || summary.session) return;
    setActualCash(String(summary.expectedCash ?? ""));
  }, [summary]);

  if (!summary) {
    return <p className="text-sm text-ink-soft">Memuat kasir...</p>;
  }

  const expectedPreview =
    Number(openingCash || 0) + summary.cashSales - summary.cashExpenses;

  async function handleClose() {
    if (summary!.session) return;
    if (!window.confirm("Tutup kasir hari ini?")) return;
    setSaving(true);
    try {
      await closeCash({
        openingCash: Number(openingCash),
        actualCash: Number(actualCash),
      });
      toast("Kasir ditutup");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menutup", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Tutup Kasir</h1>
        <span className={summary.session ? statusActiveClass : badgeClass}>
          {summary.session ? "sudah ditutup" : "belum ditutup"}
        </span>
      </div>
      <p className="-mt-3 text-xs text-ink-soft">
        {formatDate(summary.session?.closedAt ?? Date.now())} · penjualan tunai
        dan pengeluaran tunai dihitung otomatis.
      </p>

      <section className={cardClass}>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Penjualan tunai</dt>
            <dd className="font-bold tabular-nums">{rupiah(summary.cashSales)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">Pengeluaran tunai</dt>
            <dd className="font-bold tabular-nums text-brick">
              −{rupiah(summary.cashExpenses)}
            </dd>
          </div>
        </dl>

        {summary.session ? (
          <dl className="mt-3 flex flex-col gap-1.5 border-t-2 border-ink pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Kas awal</dt>
              <dd className="font-bold tabular-nums">
                {rupiah(summary.session.openingCash)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Kas seharusnya</dt>
              <dd className="font-bold tabular-nums">
                {rupiah(summary.session.expectedCash)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Kas fisik</dt>
              <dd className="font-bold tabular-nums">
                {rupiah(summary.session.actualCash)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <dt className="font-bold">Selisih</dt>
              <dd
                className={`font-extrabold tabular-nums ${
                  summary.session.difference === 0 ? "text-pandan" : "text-brick"
                }`}
              >
                {rupiah(summary.session.difference)}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-3 flex flex-col gap-2 border-t-2 border-dashed border-ink/25 pt-3">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink-soft">Kas awal (modal laci)</span>
              <input
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="w-28 rounded-control border-2 border-line bg-white px-2 py-1.5 text-right font-bold tabular-nums"
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Kas seharusnya</span>
              <span className="font-extrabold tabular-nums">
                {rupiah(expectedPreview)}
              </span>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink-soft">Kas fisik (hitung uang)</span>
              <input
                value={actualCash}
                onChange={(event) => setActualCash(event.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="w-28 rounded-control border-2 border-line bg-white px-2 py-1.5 text-right font-bold tabular-nums"
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Selisih</span>
              <span
                className={`font-extrabold tabular-nums ${
                  Number(actualCash || 0) - expectedPreview === 0
                    ? "text-pandan"
                    : "text-brick"
                }`}
              >
                {rupiah(Number(actualCash || 0) - expectedPreview)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className={`${buttonClass} mt-1 w-full`}
            >
              {saving ? "Menyimpan..." : "Tutup kasir hari ini"}
            </button>
          </div>
        )}
      </section>

      {sessions.length > 0 && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Riwayat tutup kasir</h2>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between py-2 text-xs">
                <span className="tabular-nums">{formatDate(session.closedAt)}</span>
                <span className="tabular-nums text-ink-soft">
                  seharusnya {rupiah(session.expectedCash)}
                </span>
                <span
                  className={
                    session.difference === 0
                      ? "font-bold text-pandan"
                      : `font-bold text-brick ${statusVoidClass}`
                  }
                >
                  {session.difference === 0
                    ? "pas"
                    : rupiah(session.difference)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-soft">
        Catatan: pembayaran QRIS/transfer tidak dihitung sebagai kas tunai.
        Pembayaran piutang dianggap tunai. Pengeluaran dianggap tunai.
      </p>
    </div>
  );
}
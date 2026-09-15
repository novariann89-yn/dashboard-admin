"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  statusVoidClass,
} from "@/components/ui";
import { formatDateTime, rupiah } from "@/lib/format";
import { listReceivables, recordPayment } from "@/lib/repos/transactions";

export default function PiutangPage() {
  const toast = useToast();
  const receivables = useLiveQuery(() => listReceivables(), [], []);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const totalRemaining = receivables.reduce(
    (sum, item) => sum + item.remaining,
    0,
  );

  async function handlePay(transactionId: string, remaining: number) {
    const raw = amounts[transactionId];
    const amount = raw === undefined || raw === "" ? remaining : Number(raw);
    try {
      await recordPayment(transactionId, amount);
      toast("Pembayaran dicatat");
      setAmounts((current) => ({ ...current, [transactionId]: "" }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mencatat", "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/pelanggan"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Kembali ke pelanggan
        </Link>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight">Piutang</h1>
      </div>

      <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-hard-sm">
        <p className={sectionLabelClass}>Total belum dibayar</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {rupiah(totalRemaining)}
        </p>
      </div>

      <section className={cardClass}>
        {receivables.length === 0 ? (
          <p className="text-sm text-ink-soft">Tidak ada piutang.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {receivables.map(({ transaction, remaining, ageDays }) => (
              <li key={transaction.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-bold">
                      {transaction.customerName ?? "Reseller"}
                    </span>
                    <span className="block text-xs tabular-nums text-ink-soft">
                      {formatDateTime(transaction.occurredAt)}
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <span
                      className={
                        ageDays >= 7 ? statusVoidClass : badgeClass
                      }
                    >
                      {ageDays} hari
                    </span>
                    <span className="mt-1 block font-bold tabular-nums">
                      Sisa {rupiah(remaining)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={amounts[transaction.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [transaction.id]: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    placeholder={`Bayar penuh ${rupiah(remaining)}`}
                    className={`${inputClass} text-right text-sm font-bold tabular-nums`}
                  />
                  <button
                    type="button"
                    onClick={() => handlePay(transaction.id, remaining)}
                    className={buttonClass}
                  >
                    Terima
                  </button>
                </div>
                <p className="text-[11px] text-ink-soft tabular-nums">
                  Total {rupiah(transaction.finalTotal)} · sudah dibayar{" "}
                  {rupiah(transaction.paidAmount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        Isi jumlah kalau pembayaran sebagian, atau biarkan kosong untuk
        melunasi.
      </p>
    </div>
  );
}
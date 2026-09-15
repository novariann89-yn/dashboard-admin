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
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  closeDay,
  getDaySummary,
  getOpeningSuggestions,
  listRecentClosings,
  recordAddition,
  recordDamage,
  saveOpening,
} from "@/lib/repos/stock-days";

export default function StokPage() {
  const toast = useToast();

  const summary = useLiveQuery(() => getDaySummary(), [], null);
  const suggestions = useLiveQuery(() => getOpeningSuggestions(), [], null);
  const closings = useLiveQuery(() => listRecentClosings(), [], []);

  const [openingInputs, setOpeningInputs] = useState<Record<string, string>>({});
  const [openingInit, setOpeningInit] = useState(false);
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [actualsInit, setActualsInit] = useState(false);

  const [moveVariantId, setMoveVariantId] = useState("");
  const [moveType, setMoveType] = useState<"addition" | "damage">("addition");
  const [moveQty, setMoveQty] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!suggestions || openingInit) return;
    setOpeningInputs(
      Object.fromEntries(
        Object.entries(suggestions).map(([id, qty]) => [id, String(qty)]),
      ),
    );
    setOpeningInit(true);
  }, [suggestions, openingInit]);

  useEffect(() => {
    if (!summary || actualsInit) return;
    setActualInputs(
      Object.fromEntries(
        summary.rows.map((row) => [
          row.variantId,
          String(row.expectedQty ?? row.currentStock),
        ]),
      ),
    );
    setActualsInit(true);
  }, [summary, actualsInit]);

  if (!summary) {
    return <p className="text-sm text-ink-soft">Memuat stok...</p>;
  }

  async function handleSaveOpenings() {
    setSavingOpening(true);
    try {
      let saved = 0;
      for (const row of summary!.rows) {
        const raw = openingInputs[row.variantId];
        if (raw === undefined || raw === "") continue;
        await saveOpening(row.variantId, Number(raw));
        saved += 1;
      }
      toast(saved > 0 ? `Stok awal disimpan (${saved} produk)` : "Tidak ada isian");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    } finally {
      setSavingOpening(false);
    }
  }

  async function handleMovement() {
    if (!moveVariantId || !moveQty) {
      toast("Pilih produk dan isi jumlah", "error");
      return;
    }
    try {
      if (moveType === "addition") {
        await recordAddition(moveVariantId, Number(moveQty));
        toast("Tambahan stok dicatat");
      } else {
        await recordDamage(moveVariantId, Number(moveQty));
        toast("Produk rusak dicatat");
      }
      setMoveQty("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mencatat", "error");
    }
  }

  async function handleCloseDay() {
    const actuals: Record<string, number> = {};
    for (const row of summary!.rows) {
      const raw = actualInputs[row.variantId];
      if (raw !== undefined && raw !== "") actuals[row.variantId] = Number(raw);
    }
    if (Object.keys(actuals).length === 0) {
      toast("Isi hitungan fisik dulu", "error");
      return;
    }
    if (!window.confirm("Tutup buku stok hari ini?")) return;

    setClosing(true);
    try {
      await closeDay(actuals);
      toast("Tutup buku selesai");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal tutup buku", "error");
    } finally {
      setClosing(false);
    }
  }

  const confirmed = summary.rows.filter((row) => row.openingQty !== null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Stok</h1>
        <span className={summary.closing ? statusActiveClass : badgeClass}>
          {summary.closing ? "sudah tutup buku" : "belum tutup buku"}
        </span>
      </div>

      {!summary.closing && (
        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className={sectionLabelClass}>1. Stok awal hari ini</h2>
            <button
              type="button"
              onClick={() => {
                setOpeningInputs(
                  Object.fromEntries(
                    summary.rows.map((row) => [
                      row.variantId,
                      String(row.currentStock),
                    ]),
                  ),
                );
              }}
              className="text-xs font-bold text-ink-soft underline"
            >
              Salin stok sekarang
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Isi jumlah fisik pagi ini. Tombol salin memakai sisa stok terakhir.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {summary.rows.map((row) => (
              <label
                key={row.variantId}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">
                  <span className="font-bold">{row.productName}</span>
                  <span className="block text-[11px] text-ink-soft">
                    {row.sizeName}
                    {row.openingQty !== null
                      ? ` · tercatat: ${row.openingQty}`
                      : ""}
                  </span>
                </span>
                <input
                  value={openingInputs[row.variantId] ?? ""}
                  onChange={(event) =>
                    setOpeningInputs((current) => ({
                      ...current,
                      [row.variantId]: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  className="w-20 rounded-control border-2 border-line bg-white px-2 py-1.5 text-right text-sm font-bold tabular-nums"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSaveOpenings}
            disabled={savingOpening}
            className={`${buttonClass} mt-3 w-full`}
          >
            {savingOpening ? "Menyimpan..." : "Simpan stok awal"}
          </button>
        </section>
      )}

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>2. Tambahan / produk rusak</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={moveVariantId}
            onChange={(event) => setMoveVariantId(event.target.value)}
            className={inputClass}
          >
            <option value="">Pilih produk</option>
            {summary.rows.map((row) => (
              <option key={row.variantId} value={row.variantId}>
                {row.productName} {row.sizeName}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setMoveType("addition")}
              className={`rounded-control border-2 py-2 text-xs font-bold ${
                moveType === "addition"
                  ? "border-ink bg-soy"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              Tambahan
            </button>
            <button
              type="button"
              onClick={() => setMoveType("damage")}
              className={`rounded-control border-2 py-2 text-xs font-bold ${
                moveType === "damage"
                  ? "border-ink bg-brick text-cream"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              Rusak
            </button>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={moveQty}
            onChange={(event) => setMoveQty(event.target.value)}
            inputMode="numeric"
            placeholder="Jumlah"
            className={`${inputClass} text-right font-bold tabular-nums`}
          />
          <button type="button" onClick={handleMovement} className={buttonClass}>
            Catat
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>3. Ringkasan & tutup buku</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-soft">
                <th className="py-1">Produk</th>
                <th className="py-1 text-right">Awal</th>
                <th className="py-1 text-right">+</th>
                <th className="py-1 text-right">Jual</th>
                <th className="py-1 text-right">Rusak</th>
                <th className="py-1 text-right">Seharusnya</th>
                <th className="py-1 text-right">Fisik</th>
                <th className="py-1 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.rows.map((row) => (
                <tr key={row.variantId} className="border-t border-line">
                  <td className="py-2 pr-1">
                    <span className="font-bold">{row.productName}</span>
                    <span className="block text-[10px] text-ink-soft">
                      {row.sizeName}
                    </span>
                  </td>
                  <td className="py-2 text-right">{row.openingQty ?? "-"}</td>
                  <td className="py-2 text-right">{row.addedQty}</td>
                  <td className="py-2 text-right">{row.soldQty}</td>
                  <td className="py-2 text-right">{row.damagedQty}</td>
                  <td className="py-2 text-right">
                    {row.expectedQty ?? "-"}
                  </td>
                  <td className="py-2 text-right">
                    {summary.closing ? (
                      row.closedActual
                    ) : (
                      <input
                        value={actualInputs[row.variantId] ?? ""}
                        onChange={(event) =>
                          setActualInputs((current) => ({
                            ...current,
                            [row.variantId]: event.target.value,
                          }))
                        }
                        inputMode="numeric"
                        className="w-14 rounded border border-line bg-white px-1 py-0.5 text-right text-xs font-bold tabular-nums"
                      />
                    )}
                  </td>
                  <td
                    className={`py-2 text-right font-bold ${
                      row.closedDifference && row.closedDifference !== 0
                        ? "text-brick"
                        : ""
                    }`}
                  >
                    {row.closedDifference === null
                      ? "-"
                      : row.closedDifference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!summary.closing ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[11px] text-ink-soft">
              {confirmed.length < summary.rows.length
                ? "Isi stok awal dulu supaya kolom \"seharusnya\" bisa dihitung."
                : "Selisih = fisik − seharusnya. Selisih masuk catatan koreksi."}
            </p>
            <button
              type="button"
              onClick={handleCloseDay}
              disabled={closing}
              className={`${buttonClass} w-full`}
            >
              {closing ? "Menyimpan..." : "Tutup buku hari ini"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs font-bold text-pandan">
            Tutup buku sudah dilakukan. Selisih tercatat di riwayat.
          </p>
        )}
      </section>

      {closings.length > 0 && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Riwayat tutup buku</h2>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {closings.map((closing) => (
              <li key={closing.id} className="py-2 text-xs">
                <span className="font-bold">{formatDate(closing.closedAt)}</span>
                {closing.note ? (
                  <span className="block text-ink-soft">{closing.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-soft">
        Stok berkurang otomatis dari penjualan (termasuk bonus). Tutup buku
        mencatat hitungan fisik dan koreksi selisih.
      </p>
    </div>
  );
}
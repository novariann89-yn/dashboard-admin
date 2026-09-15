"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { rupiah } from "@/lib/format";
import { levelMarginWarning } from "@/lib/reseller";
import {
  createResellerLevel,
  listResellerLevels,
  removeLevelPrice,
  setLevelPrice,
  updateResellerLevel,
  type ResellerLevelWithPrices,
} from "@/lib/repos/discounts";
import { listVariants } from "@/lib/repos/products";
import { getSettings, updateSettings } from "@/lib/settings";

export function ResellerSection() {
  const toast = useToast();
  const levels = useLiveQuery(() => listResellerLevels(), [], []);
  const settings = useLiveQuery(() => getSettings(), [], null);

  const [moqInput, setMoqInput] = useState("");
  const [moqReady, setMoqReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMin, setNewMin] = useState("24");

  useEffect(() => {
    if (!settings || moqReady) return;
    setMoqInput(String(settings.resellerMoq));
    setMoqReady(true);
  }, [settings, moqReady]);

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Reseller — level & harga</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Harga grosir flat per botol. Pembeli mendapat harga level yang tercapai
        dari total botol dalam satu transaksi.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Minimal beli (MOQ, botol)
          </span>
          <input
            value={moqInput}
            onChange={(event) => setMoqInput(event.target.value)}
            inputMode="numeric"
            className={`${inputClass} text-right tabular-nums`}
          />
        </label>
        <button
          type="button"
          onClick={async () => {
            await updateSettings({
              resellerMoq: Math.max(1, Number(moqInput) || 24),
            });
            toast("MOQ disimpan");
          }}
          className={buttonClass}
        >
          Simpan
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {levels.map((level) => (
          <LevelEditor key={level.id} level={level} />
        ))}
        {levels.length === 0 && (
          <p className="text-xs text-ink-soft">
            Belum ada level. Harga reseller dasar (per varian di atas) tetap
            dipakai kalau level kosong.
          </p>
        )}
      </div>

      {showAdd ? (
        <div className="mt-3 flex flex-col gap-2 rounded-control border-2 border-dashed border-ink/30 p-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nama level (mis. Reseller Menengah)"
            className={inputClass}
          />
          <input
            value={newMin}
            onChange={(event) => setNewMin(event.target.value)}
            inputMode="numeric"
            placeholder="Minimal botol"
            className={`${inputClass} text-right tabular-nums`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!newName.trim()) return;
                await createResellerLevel({
                  name: newName,
                  minBottles: Number(newMin) || 1,
                });
                setNewName("");
                setNewMin("24");
                setShowAdd(false);
                toast("Level ditambah");
              }}
              className={buttonClass}
            >
              Tambah level
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-control border-2 border-line px-3 text-xs font-bold text-ink-soft"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-3 w-full rounded-control border-2 border-dashed border-ink/40 py-2 text-xs font-bold text-ink-soft"
        >
          + Level reseller
        </button>
      )}
    </section>
  );
}

function LevelEditor({ level }: { level: ResellerLevelWithPrices }) {
  const toast = useToast();
  const variants = useLiveQuery(() => listVariants(true), [], []);
  const [name, setName] = useState(level.name);
  const [minBottles, setMinBottles] = useState(String(level.minBottles));
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(level.prices).map(([variantId, price]) => [
        variantId,
        String(price),
      ]),
    ),
  );

  async function save() {
    await updateResellerLevel(level.id, {
      name: name.trim() || level.name,
      minBottles: Math.max(1, Number(minBottles) || level.minBottles),
    });
    for (const variant of variants) {
      const raw = prices[variant.id];
      if (raw === undefined || raw === "") {
        await removeLevelPrice(level.id, variant.id);
      } else {
        await setLevelPrice(level.id, variant.id, Number(raw));
      }
    }
    toast("Level disimpan");
  }

  return (
    <div className="rounded-control border-2 border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-control border border-line bg-canvas px-2 py-1.5 text-xs font-bold"
        />
        <button
          type="button"
          onClick={async () => {
            await updateResellerLevel(level.id, { active: !level.active });
            toast("Level diperbarui");
          }}
          className="shrink-0 text-[11px] font-bold text-ink-soft underline"
        >
          {level.active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>

      <label className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
          Minimal botol
        </span>
        <input
          value={minBottles}
          onChange={(event) => setMinBottles(event.target.value)}
          inputMode="numeric"
          className="w-20 rounded border border-line bg-canvas px-2 py-1 text-right font-bold tabular-nums"
        />
      </label>

      <div className="mt-2 flex flex-col gap-2">
        {variants.map((variant) => {
          const raw = prices[variant.id] ?? "";
          const price = Number(raw) || 0;
          const warning =
            raw !== "" && levelMarginWarning(price, variant.costPrice);
          return (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-xs">
                <span className="font-bold">{variant.sizeName}</span>
                <span className="block text-[10px] tabular-nums text-ink-soft">
                  modal {rupiah(variant.costPrice)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {warning && (
                  <span className="text-[10px] font-bold text-brick">
                    margin tipis
                  </span>
                )}
                <input
                  value={raw}
                  onChange={(event) =>
                    setPrices((current) => ({
                      ...current,
                      [variant.id]: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  placeholder="harga"
                  className={`w-24 rounded border bg-canvas px-2 py-1 text-right text-xs font-bold tabular-nums ${
                    warning ? "border-brick text-brick" : "border-line"
                  }`}
                />
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={save}
        className="mt-3 w-full rounded-control border-2 border-ink bg-soy py-1.5 text-xs font-bold"
      >
        Simpan level
      </button>
    </div>
  );
}
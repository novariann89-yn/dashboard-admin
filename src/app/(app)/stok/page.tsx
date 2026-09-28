"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { listVariantsWithProduct, type VariantWithProduct } from "@/lib/repos/products";
import { addStock, setStock, stockLevel } from "@/lib/repos/stock";

const STATUS: Record<
  ReturnType<typeof stockLevel>,
  { label: string; className: string }
> = {
  high: { label: "Baik", className: "text-success" },
  low: { label: "Menipis", className: "text-warning" },
  empty: { label: "Habis", className: "text-error" },
};

export default function StokPage() {
  const variants = useLiveQuery(
    () => listVariantsWithProduct(false),
    [],
    [] as VariantWithProduct[],
  );

  const lowStock = variants.filter(
    (variant) => variant.active && stockLevel(variant.stock) !== "high",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Stok</h1>
        <p className="text-sm text-ink-soft">
          Stok berkurang otomatis saat penjualan. Gunakan kolom di tiap produk
          untuk menambah atau menyesuaikan stok.
        </p>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-ink-soft">Belum ada produk.</p>
      ) : (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Daftar Stok</h2>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {variants.map((variant) => (
              <StockRow key={variant.id} variant={variant} />
            ))}
          </ul>
        </section>
      )}

      {lowStock.length > 0 && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Perlu ditambah</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-soft">
            {lowStock.map((variant) => (
              <li key={variant.id} className="tabular-nums">
                {variant.productName} {variant.sizeName}: {variant.stock}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StockRow({ variant }: { variant: VariantWithProduct }) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);

  const level = stockLevel(variant.stock);
  const status = STATUS[level];
  const amount = Number(qty);

  async function run(action: "add" | "set") {
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Masukkan jumlah lebih dari 0", "error");
      return;
    }
    setBusy(true);
    try {
      const next = action === "add" ? await addStock(variant.id, amount) : await setStock(variant.id, amount);
      setQty("");
      toast(
        action === "add"
          ? `Stok ditambah. Sisa ${next}`
          : `Stok disesuaikan menjadi ${next}`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mengubah stok", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-xl">{variant.productEmoji}</span>
          <span className="text-sm">
            <span className="font-bold text-ink">{variant.productName}</span>
            <span className="block text-xs text-ink-soft">
              {variant.sizeName}
              {!variant.active ? " · nonaktif" : ""}
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className={`block text-lg font-extrabold tabular-nums ${status.className}`}>
            {variant.stock}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
            {status.label}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={qty}
          onChange={(event) => setQty(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Jumlah"
          className={`${inputClass} py-2 text-right tabular-nums`}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => run("add")}
          className={`${buttonClass} shrink-0 px-3 py-2`}
        >
          + Tambah
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("set")}
          className={`${badgeClass} shrink-0 cursor-pointer px-3 py-2`}
        >
          Sesuaikan
        </button>
      </div>
    </li>
  );
}

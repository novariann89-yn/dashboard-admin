"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { cardClass, sectionLabelClass } from "@/components/ui";
import { stockLevel } from "@/lib/repos/stock";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { rupiah } from "@/lib/format";

const badgeClass: Record<"high" | "low" | "empty", string> = {
  high: "border-pandan/40 bg-pandan/10 text-pandan",
  low: "border-soy-dark/40 bg-cream text-soy-dark",
  empty: "border-brick/40 bg-brick/10 text-brick",
};

export default function StokPage() {
  const variants = useLiveQuery(() => listVariantsWithProduct(true), [], []);

  const totalBottles = variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Stok</h1>

      <div className="rounded-card border-2 border-ink bg-surface p-4 shadow-hard-sm">
        <p className={sectionLabelClass}>Total botol tercatat</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">{totalBottles}</p>
      </div>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Stok per varian</h2>
        {variants.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Belum ada produk. Tambah di Setting.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {variants.map((variant) => {
              const level = stockLevel(variant.stock);
              return (
                <li
                  key={variant.id}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-sm">
                    <span className="font-bold">{variant.productName}</span>
                    <span className="block text-xs text-ink-soft">
                      {variant.sizeName} · {rupiah(variant.sellPrice)}
                    </span>
                  </span>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-bold tabular-nums ${badgeClass[level]}`}
                  >
                    {variant.stock}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        Stok berkurang otomatis setiap penjualan. Kelola stok harian (stok awal,
        produk rusak, tambahan, tutup buku) menyusul di fase berikutnya.
      </p>
    </div>
  );
}
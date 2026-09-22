"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { cardClass, sectionLabelClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getDb } from "@/lib/db";
import { listVariantsWithProduct } from "@/lib/repos/products";

export default function StokPage() {
  const toast = useToast();
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);
  const [lowStock, setLowStock] = useState<Array<{ id: string; productName: string; sizeName: string; stock: number }>>([]);

  useEffect(() => {
    const threshold = 20;
    const low = variants.filter(
      (v) => v.active && (v.stock ?? 0) <= threshold,
    ) as Array<{ id: string; productName: string; sizeName: string; stock: number }>;
    setLowStock(low);
  }, [variants]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Stok</h1>

      <p className="text-sm text-ink-soft">
        Stok berkurang otomatis dari penjualan. Stok nol menampilkan badge peringatan.
      </p>

      {variants.length === 0 && (
        <p className="mt-2 text-sm text-ink-soft">Belum ada produk.</p>
      )}

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Daftar Stok</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-soft">
                <th className="py-1">Produk</th>
                <th className="py-1 text-right">Ukuran</th>
                <th className="py-1 text-right">Stok</th>
                <th className="py-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {variants.map((variant) => {
                const stock = variant.stock ?? 0;
                const isLow = stock <= 0 ? "Habis" : stock <= 20 ? "Tepi" : "Baik";
                return (
                  <tr key={variant.id} className="border-t border-line">
                    <td className="py-2 pr-1">
                      <span className="font-bold">{variant.productName}</span>
                      <span className="block text-[10px] text-ink-soft">{variant.sizeName}</span>
                    </td>
                    <td className="py-2 text-right">{variant.sizeName}</td>
                    <td className="py-2 text-right">
                      <span className="font-bold tabular-nums">{stock}</span>
                    </td>
                    <td className="py-2 text-right">{isLow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {lowStock.length > 0 && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Stok menipis</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-soft">
            {lowStock.map((item) => (
              <li key={item.id} className="tabular-nums">
                {item.productName} {item.sizeName}: {item.stock}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { IconX, IconMinus, IconPlus } from "@/components/icons";
import { useCart } from "./cart-context";

export function ProductDetailSheet() {
  const { detailVariant, addItem } = useCart();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [detailVariant]);

  if (!detailVariant) return null;

  const maxQty = detailVariant.stock;
  const isOutOfStock = detailVariant.stock <= 0;

  const handleDecrement = () => {
    if (qty > 1) setQty(qty - 1);
  };

  const handleIncrement = () => {
    if (qty < maxQty) setQty(qty + 1);
  };

  const handleAdd = () => {
    addItem({
      variantId: detailVariant.id,
      productName: detailVariant.productName,
      sizeName: detailVariant.sizeName,
      emoji: detailVariant.productEmoji,
      qty,
      unitPrice: detailVariant.sellPrice,
      unitCost: detailVariant.costPrice,
      stock: detailVariant.stock,
    });
  };

  if (!detailVariant) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-surface rounded-t-card p-4 shadow-elevated max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-ink">Pilih Variasi</h2>
          <button onClick={() => {}} className="p-1 rounded-control text-ink-soft hover:text-ink">
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 bg-surface rounded-card border border-line">
          <span className="text-4xl">{detailVariant.productEmoji}</span>
          <div className="flex-1">
            <p className="font-bold text-ink">{detailVariant.productName}</p>
            <p className="text-xs text-ink-soft">{detailVariant.sizeName}</p>
            <p className="mt-1 text-lg font-extrabold text-primary tabular-nums">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(detailVariant.sellPrice)}
            </p>
            <p className="text-[10px] text-ink-soft">Stok tersedia: {detailVariant.stock}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-ink-soft mb-2">Jumlah</label>
          <div className="flex items-center justify-between p-3 bg-surface rounded-card border border-line">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              className="rounded-control border-2 border-line bg-surface p-2 disabled:opacity-40"
              aria-label="Kurangi"
            >
              <span className="text-xl">−</span>
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) => {
                const val = Math.max(1, Math.min(detailVariant.stock, parseInt(e.target.value) || 1));
                setQty(val);
              }}
              min={1}
              max={detailVariant.stock}
              className="w-20 text-center text-lg font-extrabold tabular-nums border-none bg-transparent focus:outline-none"
            />
            <button
              onClick={() => setQty(Math.min(detailVariant.stock, qty + 1))}
              disabled={qty >= detailVariant.stock}
              className="rounded-control border-2 border-line bg-surface p-2 disabled:opacity-40"
              aria-label="Tambah"
            >
              <span className="text-xl">+</span>
            </button>
          </div>
          <p className="text-[10px] text-ink-soft mt-1 text-right">Maks: {detailVariant.stock} pcs</p>
        </div>

        <div className="mb-4 pt-2 border-t border-line">
          <div className="flex justify-between text-base font-bold">
            <span>Subtotal</span>
            <span className="text-primary tabular-nums">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(detailVariant.sellPrice * qty)}
            </span>
          </div>
        </div>

        <button
          onClick={() => {}}
          disabled={qty > detailVariant.stock}
          className="w-full rounded-control bg-gradient-primary text-white py-3.5 font-extrabold shadow-card disabled:opacity-40"
        >
          Masukkan ke Keranjang
        </button>

        <button
          onClick={() => {}}
          className="w-full mt-2 rounded-control border-2 border-line text-ink-soft py-2 text-sm font-bold"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
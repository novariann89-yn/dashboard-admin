"use client";

import { useEffect, useState } from "react";
import { IconMinus, IconPlus, IconX } from "@/components/icons";
import { rupiah } from "@/lib/format";
import { useCart } from "./cart-context";

export function ProductDetailSheet() {
  const { detailProduct, closeDetail, addItem } = useCart();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!detailProduct) return;
    const firstAvailable =
      detailProduct.variants.find((v) => v.stock > 0) ?? detailProduct.variants[0];
    setSelectedId(firstAvailable?.id ?? null);
    setQty(1);
  }, [detailProduct]);

  if (!detailProduct) return null;

  const selected =
    detailProduct.variants.find((v) => v.id === selectedId) ?? null;
  const maxQty = selected ? Math.max(1, selected.stock) : 1;
  const canAdd = !!selected && selected.stock > 0;

  function handleAdd() {
    if (!selected || !canAdd) return;
    addItem({
      variantId: selected.id,
      productName: detailProduct!.productName,
      sizeName: selected.sizeName,
      emoji: detailProduct!.productEmoji,
      qty,
      unitPrice: selected.sellPrice,
      unitCost: selected.costPrice,
      stock: selected.stock,
    });
    closeDetail();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={closeDetail}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative w-full max-w-md animate-slide-up rounded-t-card border-t border-line bg-surface p-4 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">Pilih Varian</h2>
          <button
            type="button"
            onClick={closeDetail}
            className="rounded-control p-1 text-ink-soft transition hover:text-ink"
            aria-label="Tutup"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl">{detailProduct.productEmoji}</span>
          <div>
            <p className="font-bold text-ink">{detailProduct.productName}</p>
            <p className="text-xs text-ink-soft">
              {canAdd && selected
                ? `${rupiah(selected.sellPrice)} · stok ${selected.stock}`
                : "Stok habis"}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Ukuran / varian
          </p>
          <div className="flex flex-wrap gap-2">
            {detailProduct.variants.map((variant) => {
              const disabled = variant.stock <= 0;
              const active = variant.id === selectedId;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedId(variant.id);
                    setQty(1);
                  }}
                  className={`rounded-control border px-3 py-2 text-left text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line bg-surface text-ink"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span className="block font-bold">{variant.sizeName}</span>
                  <span className="tabular-nums">{rupiah(variant.sellPrice)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Jumlah
          </p>
          <div className="flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={!canAdd || qty <= 1}
              className="rounded-control p-2 text-ink disabled:opacity-30"
              aria-label="Kurangi"
            >
              <IconMinus className="h-5 w-5" />
            </button>
            <span className="text-lg font-extrabold tabular-nums text-ink">
              {canAdd ? qty : 0}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={!canAdd || qty >= maxQty}
              className="rounded-control p-2 text-ink disabled:opacity-30"
              aria-label="Tambah"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-bold text-ink">Subtotal</span>
          <span className="text-lg font-extrabold tabular-nums text-primary">
            {rupiah((selected?.sellPrice ?? 0) * (canAdd ? qty : 0))}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full rounded-control bg-primary py-3 font-extrabold text-white transition active:scale-[0.99] disabled:opacity-40"
        >
          {canAdd ? "Masukkan ke Keranjang" : "Stok habis"}
        </button>
      </div>
    </div>
  );
}

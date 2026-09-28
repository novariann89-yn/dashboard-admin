"use client";

import { useRouter } from "next/navigation";
import { IconMinus, IconPlus, IconTrash, IconX } from "@/components/icons";
import { rupiah } from "@/lib/format";
import { useCart } from "./cart-context";

export function CartSheet() {
  const router = useRouter();
  const {
    items,
    updateQty,
    removeItem,
    clearCart,
    subtotal,
    totalItems,
    isOpen,
    setIsOpen,
  } = useCart();

  if (!isOpen || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative w-full max-w-md animate-slide-up rounded-t-card border-t border-line bg-surface p-4 shadow-elevated">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">
            Keranjang <span className="text-ink-soft">({totalItems})</span>
          </h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-control p-1 text-ink-soft transition hover:text-ink"
            aria-label="Tutup"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex items-center gap-3 rounded-control border border-line p-2"
            >
              <span className="text-2xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {item.productName}
                </p>
                <p className="text-xs text-ink-soft">
                  {item.sizeName} · {rupiah(item.unitPrice)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateQty(item.variantId, item.qty - 1)}
                  className="rounded-control border border-line p-1 text-ink"
                  aria-label="Kurangi"
                >
                  <IconMinus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-extrabold tabular-nums text-ink">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(item.variantId, item.qty + 1)}
                  disabled={item.qty >= item.stock}
                  className="rounded-control border border-line p-1 text-ink disabled:opacity-30"
                  aria-label="Tambah"
                >
                  <IconPlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.variantId)}
                  className="ml-1 rounded-control p-1 text-error"
                  aria-label="Hapus"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Total</span>
            <span className="text-xl font-extrabold tabular-nums text-primary">
              {rupiah(subtotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push("/checkout");
            }}
            className="w-full rounded-control bg-primary py-3 font-extrabold text-white transition active:scale-[0.99]"
          >
            Lanjut ke Pembayaran
          </button>
          <button
            type="button"
            onClick={clearCart}
            className="mt-2 w-full rounded-control border border-line py-2 text-sm font-bold text-ink-soft transition hover:text-error"
          >
            Kosongkan Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}

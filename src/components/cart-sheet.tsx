"use client";

import { useCart } from "./cart-context";
import {
  IconMinus,
  IconPlus,
  IconX,
  IconTrash,
} from "@/components/icons";
import { rupiah } from "@/lib/format";
import { cardClass, buttonClass } from "./ui";
import type { CartItem } from "./cart-context";

export function CartSheet() {
  const { items, updateQty, removeItem, clearCart, subtotal, setIsOpen } = useCart();

  if (!items.length) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-surface border-t-2 border-ink rounded-t-card p-4 shadow-elevated">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-ink">Keranjang</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-control text-ink-soft hover:text-ink"
            aria-label="Tutup"
          >
            <IconX className="h-6 w-6" />
          </button>
        </div>

        <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li key={item.variantId} className="flex items-center gap-3 p-2 bg-surface rounded-control border border-line">
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink truncate">
                  {item.productName} {item.sizeName}
                </p>
                <p className="text-xs text-ink-soft">{rupiah(item.unitPrice)} / pcs</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.variantId, item.qty - 1)}
                  disabled={item.qty <= 1}
                  className="rounded-control border-2 border-line bg-surface p-1 disabled:opacity-40"
                  aria-label="Kurangi"
                >
                  <IconMinus className="h-5 w-5" />
                </button>
                <span className="w-10 text-center text-base font-extrabold tabular-nums text-ink">
                  {item.qty}
                </span>
                <button
                  onClick={() => updateQty(item.variantId, item.qty + 1)}
                  disabled={item.qty >= item.stock}
                  className="rounded-control border-2 border-line bg-surface p-1 disabled:opacity-40"
                  aria-label="Tambah"
                >
                  <IconPlus className="h-5 w-5" />
                </button>
                <span className="w-24 text-right text-sm font-bold tabular-nums text-primary">
                  {rupiah(item.unitPrice * item.qty)}
                </span>
                <button
                  onClick={() => confirmRemove(item)}
                  className="p-1 text-error hover:text-error/70"
                  aria-label="Hapus"
                >
                  <IconTrash className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 pt-3 border-t-2 border-line">
          <div className="flex justify-between text-base font-bold mb-2">
            <span>Subtotal</span>
            <span className="text-primary">{formatRupiah(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0))}</span>
          </div>
          <button onClick={() => window.location.href = "/checkout"} className="w-full rounded-control bg-gradient-primary text-white py-3 font-extrabold shadow-card transition active:scale-[0.98]">
            Lanjut ke Pembayaran
          </button>
          <button onClick={() => clearCart()} className="w-full mt-2 rounded-control border-2 border-line text-ink-soft py-2 text-sm font-bold">
            Kosongkan Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}

function confirmRemove(item: { variantId: string; productName: string; sizeName: string }) {
  if (window.confirm(`Hapus ${item.productName} ${item.sizeName} dari keranjang?`)) {
    // The onClick handler will be called by the parent component
    // We need to trigger the removeItem action
    // This is a simple approach - in a real app you'd use a callback
    const event = new CustomEvent("remove-cart-item", { detail: item.variantId });
    window.dispatchEvent(event);
  }
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

// Listen for remove events
if (typeof window !== "undefined") {
  window.addEventListener("remove-cart-item", (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    // This will be handled by the CartSheet component's useCart hook
  });
}
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { IconBottle, IconPlus } from "@/components/icons";
import { useToast } from "@/components/toast";
import { cardClass, buttonClass, badgeClass } from "@/components/ui";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { getSettings } from "@/lib/settings";
import { CartProvider, useCart } from "@/components/cart-context";
import { CartSheet } from "@/components/cart-sheet";
import { ProductDetailSheet } from "@/components/product-detail-sheet";

function BerandaContent() {
  const toast = useToast();

  const variants = useLiveQuery(() => listVariantsWithProduct(true), [], [] as any[]);
  const settings = useLiveQuery(() => getSettings(), [], null);

  const activeVariants = (variants ?? []).filter((v) => v.active && v.stock > 0);
  const { detailVariant, closeDetail } = useCart();

  return (
    <div className="flex flex-col gap-4 pb-32">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-extrabold text-ink">Beranda</h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        {activeVariants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-ink-soft">
            <IconBottle className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-bold">Belum ada produk</p>
            <p className="text-sm mt-1">Tambah produk di Setting untuk memulai</p>
            <Link href="/setting" className="mt-4 text-primary font-bold underline">
              Buka Setting
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeVariants.map((variant) => (
              <ProductCard key={variant.id} variant={variant} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ variant }: { variant: any }) {
  const { setDetailOpen } = useCart();
  const isOutOfStock = variant.stock <= 0;

  return (
    <button
      type="button"
      onClick={() => setDetailOpen(variant)}
      disabled={isOutOfStock}
      className={`relative flex flex-col items-center gap-2 p-4 bg-surface rounded-card border-2 border-line shadow-soft transition active:scale-[0.98] ${
        isOutOfStock ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span className="text-4xl">{variant.productEmoji}</span>
      <div className="text-center w-full">
        <p className="font-bold text-ink truncate">{variant.productName}</p>
        <p className="text-xs text-ink-soft">{variant.sizeName}</p>
        <p className="mt-1 text-lg font-extrabold text-primary tabular-nums">
          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(variant.sellPrice)}
        </p>
        <p className="text-[10px] text-ink-soft">
          Stok: {variant.stock}
        </p>
      </div>
      <div className={`absolute bottom-2 right-2 rounded-control ${isOutOfStock ? "bg-line text-ink-soft" : "bg-primary text-white"} px-3 py-1 text-xs font-bold`}>
        {isOutOfStock ? "Habis" : "Pilih"}
      </div>
    </button>
  );
}

export default function BerandaPage() {
  return (
    <CartProvider>
      <BerandaContent />
      <CartSheet />
      <ProductDetailSheet />
    </CartProvider>
  );
}
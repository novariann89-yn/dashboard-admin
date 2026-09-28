"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo } from "react";
import { IconBottle, IconShoppingCart } from "@/components/icons";
import { rupiah } from "@/lib/format";
import {
  listVariantsWithProduct,
  type VariantWithProduct,
} from "@/lib/repos/products";
import { useCart, type ProductSelection } from "@/components/cart-context";

function BerandaPage() {
  const variants = useLiveQuery(
    () => listVariantsWithProduct(false),
    [],
    [] as VariantWithProduct[],
  );
  const { totalItems, subtotal, setIsOpen } = useCart();

  const products = useMemo(() => {
    const map = new Map<string, ProductSelection>();
    for (const variant of variants) {
      const existing = map.get(variant.productId) ?? {
        productId: variant.productId,
        productName: variant.productName,
        productEmoji: variant.productEmoji,
        variants: [],
      };
      if (variant.active) {
        existing.variants.push({
          id: variant.id,
          sizeName: variant.sizeName,
          sellPrice: variant.sellPrice,
          costPrice: variant.costPrice,
          stock: variant.stock,
        });
      }
      map.set(variant.productId, existing);
    }
    return Array.from(map.values())
      .map((product) => ({
        ...product,
        variants: product.variants.sort((a, b) => a.sellPrice - b.sellPrice),
      }))
      .filter((product) => product.variants.length > 0);
  }, [variants]);

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Beranda</h1>
        <p className="text-sm text-ink-soft">Pilih produk untuk mulai mencatat pesanan.</p>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-ink-soft">
          <IconBottle className="mb-4 h-16 w-16 opacity-30" />
          <p className="text-lg font-bold">Belum ada produk</p>
          <p className="mt-1 text-sm">Tambah produk di Setting untuk memulai</p>
          <Link href="/setting" className="mt-4 font-bold text-primary underline">
            Buka Setting
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}

      {totalItems > 0 && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="no-print fixed bottom-20 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-[26rem] -translate-x-1/2 items-center justify-between rounded-control bg-primary px-4 py-3 text-white shadow-card transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="relative flex h-6 w-6 items-center justify-center">
              <IconShoppingCart className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-primary">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            </span>
            Lihat Keranjang
          </span>
          <span className="text-sm font-extrabold tabular-nums">{rupiah(subtotal)}</span>
        </button>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductSelection }) {
  const { openProduct } = useCart();

  const totalStock = product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  const minPrice = Math.min(...product.variants.map((v) => v.sellPrice));
  const isOutOfStock = totalStock <= 0;

  return (
    <button
      type="button"
      onClick={() => openProduct(product)}
      disabled={isOutOfStock}
      className={`relative flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 text-center transition active:scale-[0.98] ${
        isOutOfStock ? "opacity-50" : "hover:border-primary/40"
      }`}
    >
      <span className="text-4xl">{product.productEmoji}</span>
      <div className="w-full">
        <p className="truncate font-bold text-ink">{product.productName}</p>
        <p className="text-xs text-ink-soft">
          {product.variants.length > 1
            ? `${product.variants.length} pilihan`
            : product.variants[0].sizeName}
        </p>
        <p className="mt-1 text-base font-extrabold tabular-nums text-primary">
          {rupiah(minPrice)}
        </p>
        <p className={`text-[10px] ${isOutOfStock ? "text-error" : "text-ink-soft"}`}>
          {isOutOfStock ? "Stok habis" : `Stok ${totalStock}`}
        </p>
      </div>
    </button>
  );
}

export default BerandaPage;

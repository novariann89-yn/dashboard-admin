"use client";

import { useState } from "react";
import { IconMinus, IconPlus } from "@/components/icons";

type ProductOption = { id: number; name: string; price: number };

export function PurchaseItems({ products }: { products: ProductOption[] }) {
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      products.map((product, index) => [product.id, index === 0 ? 1 : 0]),
    ),
  );

  const total = products.reduce(
    (sum, product) => sum + product.price * (quantities[product.id] ?? 0),
    0,
  );

  function change(id: number, delta: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => {
        const quantity = quantities[product.id] ?? 0;
        return (
          <div
            key={product.id}
            className={`flex items-center justify-between gap-3 rounded-control border-2 p-3 ${
              quantity > 0 ? "border-ink bg-cream" : "border-line bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-bold">{product.name}</p>
              <p className="text-xs tabular-nums text-ink-soft">
                Rp {product.price.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => change(product.id, -1)}
                aria-label={`Kurangi ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-control border-2 border-ink bg-surface active:translate-y-[1px]"
              >
                <IconMinus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-lg font-extrabold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => change(product.id, 1)}
                aria-label={`Tambah ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-control border-2 border-ink bg-soy active:translate-y-[1px]"
              >
                <IconPlus className="h-4 w-4" />
              </button>
            </div>
            <input type="hidden" name={`qty_${product.id}`} value={quantity} />
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t-2 border-dashed border-ink/30 pt-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          Total
        </span>
        <span className="text-xl font-extrabold tabular-nums">
          Rp {total.toLocaleString("id-ID")}
        </span>
      </div>
    </div>
  );
}

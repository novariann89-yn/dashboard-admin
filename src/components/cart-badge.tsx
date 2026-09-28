"use client";

import { useCart } from "./cart-context";
import { IconShoppingCart } from "@/components/icons";

export function CartBadge() {
  const { totalItems, setIsOpen } = useCart();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative p-2 rounded-control bg-primary text-white shadow-card"
      aria-label="Keranjang"
    >
      <IconShoppingCart className="h-6 w-6" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-error text-white text-[10px] font-extrabold flex items-center justify-center">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  );
}
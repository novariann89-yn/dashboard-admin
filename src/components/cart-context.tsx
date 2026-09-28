"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { ProductVariant } from "@/lib/types";

export interface CartItem {
  variantId: string;
  productName: string;
  sizeName: string;
  emoji: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  stock: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty"> & { qty: number }) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  detailVariant: any;
  setDetailOpen: (variant: any) => void;
  closeDetail: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [detailVariant, setDetailVariant] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("toko-cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("toko-cart", JSON.stringify(items));
    }
  }, [items, hydrated]);

  function addItem(newItem: Omit<CartItem, "qty"> & { qty: number }) {
    setItems((prev) => {
      const existing = prev.find((item) => item.variantId === newItem.variantId);
      if (existing) {
        const newQty = Math.min(existing.qty + newItem.qty, existing.stock);
        return prev.map((item) =>
          item.variantId === newItem.variantId ? { ...item, qty: newQty } : item
        );
      }
      return [...prev, newItem];
    });
    setIsOpen(true);
  }

  function updateQty(variantId: string, qty: number) {
    setItems((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId ? { ...item, qty: Math.max(0, Math.min(qty, item.stock)) } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }

  function clearCart() {
    setItems([]);
    setIsOpen(false);
  }

  function closeDetail() {
    setDetailVariant(null);
  }

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        totalItems,
        subtotal,
        isOpen,
        setIsOpen,
        detailVariant,
        setDetailOpen: setDetailVariant,
        closeDetail,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
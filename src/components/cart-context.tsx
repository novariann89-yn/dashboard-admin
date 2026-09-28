"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

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

export interface ProductVariantOption {
  id: string;
  sizeName: string;
  sellPrice: number;
  costPrice: number;
  stock: number;
}

export interface ProductSelection {
  productId: string;
  productName: string;
  productEmoji: string;
  variants: ProductVariantOption[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  detailProduct: ProductSelection | null;
  openProduct: (product: ProductSelection) => void;
  closeDetail: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "toko-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductSelection | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
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
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  function addItem(newItem: CartItem) {
    setItems((prev) => {
      const existing = prev.find((item) => item.variantId === newItem.variantId);
      if (existing) {
        const max = Math.max(existing.stock, newItem.stock);
        const qty = Math.min(existing.qty + newItem.qty, max);
        return prev.map((item) =>
          item.variantId === newItem.variantId
            ? { ...item, qty, stock: max, unitPrice: newItem.unitPrice, unitCost: newItem.unitCost }
            : item,
        );
      }
      return [...prev, { ...newItem, qty: Math.min(newItem.qty, newItem.stock) }];
    });
  }

  function updateQty(variantId: string, qty: number) {
    setItems((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? { ...item, qty: Math.max(0, Math.min(qty, item.stock)) }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }

  function clearCart() {
    setItems([]);
    setIsOpen(false);
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
        detailProduct,
        openProduct: setDetailProduct,
        closeDetail: () => setDetailProduct(null),
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

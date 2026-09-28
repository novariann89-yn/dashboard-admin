"use client";

import { useEffect } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { LoginGate } from "@/components/login-gate";
import { ToastProvider } from "@/components/toast";
import { CartProvider } from "@/components/cart-context";
import { CartSheet } from "@/components/cart-sheet";
import { ProductDetailSheet } from "@/components/product-detail-sheet";
import { IconBottle } from "@/components/icons";
import { readCachedTheme, syncThemeClass } from "@/lib/theme";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const apply = () => {
      syncThemeClass(readCachedTheme());
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <ToastProvider>
      <CartProvider>
        <LoginGate>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
            <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary shadow-soft">
                  <IconBottle className="h-4 w-4 text-white" />
                </span>
                <span className="text-sm font-extrabold tracking-tight text-ink">
                  Dashboard Admin
                </span>
              </div>
            </header>

            <main className="flex-1 p-4 pb-28">{children}</main>

            <BottomNav />
          </div>
          <CartSheet />
          <ProductDetailSheet />
        </LoginGate>
      </CartProvider>
    </ToastProvider>
  );
}
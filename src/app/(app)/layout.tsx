"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { LoginGate } from "@/components/login-gate";
import { PermissionGate } from "@/components/permission-gate";
import { ToastProvider } from "@/components/toast";
import { CartProvider } from "@/components/cart-context";
import { CartSheet } from "@/components/cart-sheet";
import { ProductDetailSheet } from "@/components/product-detail-sheet";
import { getSession, logout as doLogout, type Session } from "@/lib/auth";
import { readCachedTheme, syncThemeClass } from "@/lib/theme";
import { useAppName } from "@/lib/use-app-name";
import { loadAndApplyBackground } from "@/lib/background";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appName = useAppName();

  useEffect(() => {
    const apply = () => {
      syncThemeClass(readCachedTheme());
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    loadAndApplyBackground();
  }, []);

  return (
    <ToastProvider>
      <CartProvider>
        <LoginGate>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
            <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <img
                    src="/icons/icon-192.png"
                    alt=""
                    className="h-8 w-8 rounded-control object-cover shadow-soft"
                  />
                  <span className="text-sm font-extrabold tracking-tight text-ink">
                    {appName}
                  </span>
                </div>
                <SessionMenu />
              </div>
            </header>

            <main className="flex-1 p-4 pb-28">
              <PermissionGate>{children}</PermissionGate>
            </main>

            <BottomNav />
          </div>
          <CartSheet />
          <ProductDetailSheet />
        </LoginGate>
      </CartProvider>
    </ToastProvider>
  );
}

function SessionMenu() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  if (!session) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        {session.role === "owner" ? "Owner" : "Admin"}
      </span>
      <button
        type="button"
        onClick={() => {
          doLogout();
          window.location.href = "/";
        }}
        className="text-[11px] font-bold text-ink-soft transition hover:text-error"
      >
        Keluar
      </button>
    </div>
  );
}

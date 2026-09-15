"use client";

import { BottomNav } from "@/components/bottom-nav";
import { PinGate } from "@/components/pin-gate";
import { ToastProvider } from "@/components/toast";
import { IconBottle } from "@/components/icons";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <PinGate>
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
          <header className="sticky top-0 z-10 border-b-2 border-ink bg-surface">
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-control border-2 border-ink bg-soy">
                <IconBottle className="h-4 w-4" />
              </span>
              <span className="text-sm font-extrabold tracking-tight">
                Dashboard Admin
              </span>
            </div>
          </header>

          <main className="flex-1 p-4 pb-28">{children}</main>

          <BottomNav />
        </div>
      </PinGate>
    </ToastProvider>
  );
}
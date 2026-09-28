"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  IconBox,
  IconHistory,
  IconHome,
  IconSettings,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { getSession, type Session } from "@/lib/auth";
import { visiblePages } from "@/lib/permissions";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  beranda: IconHome,
  pelanggan: IconUsers,
  stok: IconBox,
  dompet: IconWallet,
  historis: IconHistory,
  setting: IconSettings,
};

export function BottomNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, [pathname]);

  const items = visiblePages(session);
  if (items.length === 0) return null;

  return (
    <nav className="no-print fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-line bg-surface/90 backdrop-blur">
      <div
        className="grid gap-1 px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ key, label, href }) => {
          const Icon = ICONS[key] ?? IconHome;
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-control px-1 py-1.5 text-[10px] font-bold transition ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

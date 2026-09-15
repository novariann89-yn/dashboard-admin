"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBottle,
  IconBox,
  IconHome,
  IconSettings,
  IconUsers,
} from "@/components/icons";

const navItems = [
  { href: "/", label: "Beranda", Icon: IconHome },
  { href: "/beli", label: "Beli", Icon: IconBottle },
  { href: "/pelanggan", label: "Pelanggan", Icon: IconUsers },
  { href: "/stok", label: "Stok", Icon: IconBox },
  { href: "/setting", label: "Setting", Icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t-2 border-ink bg-surface">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {navItems.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-control border-2 px-1 py-1.5 text-[10px] font-bold ${
                active
                  ? "border-ink bg-soy text-ink"
                  : "border-transparent text-ink-soft"
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
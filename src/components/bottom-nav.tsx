"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/pembelian", label: "Beli" },
  { href: "/member", label: "Member" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/pengaturan", label: "Atur" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-gray-200 bg-white text-center">
      {navItems.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`py-3 text-xs ${
              active ? "font-semibold text-black" : "text-gray-500"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

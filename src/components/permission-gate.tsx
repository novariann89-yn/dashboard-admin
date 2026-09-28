"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLock } from "@/components/icons";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export function PermissionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(canAccess(getSession(), pathname));
  }, [pathname]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-ink-soft">
        Memuat...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
          <IconLock className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-ink">Akses ditolak</h2>
        <p className="mt-1 max-w-xs text-sm text-ink-soft">
          Akun ini tidak memiliki izin untuk membuka halaman tersebut.
        </p>
        <Link
          href="/"
          className="mt-5 rounded-control bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

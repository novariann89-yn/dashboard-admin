import type { UserRole } from "./types";

export interface PageDef {
  key: string;
  label: string;
  href: string;
  ownerOnly?: boolean;
}

export const PAGES: PageDef[] = [
  { key: "beranda", label: "Beranda", href: "/" },
  { key: "pelanggan", label: "Pelanggan", href: "/pelanggan" },
  { key: "stok", label: "Stok", href: "/stok" },
  { key: "dompet", label: "Dompet", href: "/dompet", ownerOnly: true },
  { key: "historis", label: "Histori", href: "/laporan" },
  { key: "setting", label: "Setting", href: "/setting", ownerOnly: true },
];

const PATH_ALIASES: Record<string, string> = {
  "/checkout": "beranda",
};

export interface AccessSession {
  role: UserRole;
  permissions: string[];
}

export function permissionForPath(pathname: string): PageDef | null {
  const alias = PATH_ALIASES[pathname];
  if (alias) {
    return PAGES.find((page) => page.key === alias) ?? null;
  }
  if (pathname === "/") return PAGES[0];
  return (
    PAGES.find(
      (page) =>
        page.href !== "/" &&
        (pathname === page.href || pathname.startsWith(page.href + "/")),
    ) ?? null
  );
}

export function canAccess(
  session: AccessSession | null,
  pathname: string,
): boolean {
  if (!session) return false;
  const page = permissionForPath(pathname);
  if (!page) return true;
  if (session.role === "owner") return true;
  if (page.ownerOnly) return false;
  return session.permissions.includes(page.key);
}

export function visiblePages(session: AccessSession | null): PageDef[] {
  if (!session) return [];
  return PAGES.filter((page) => {
    if (session.role === "owner") return true;
    if (page.ownerOnly) return false;
    return session.permissions.includes(page.key);
  });
}

export const DELETE_HISTORY = "delete_history";

export function canDeleteHistory(session: AccessSession | null): boolean {
  if (!session) return false;
  if (session.role === "owner") return true;
  return session.permissions.includes(DELETE_HISTORY);
}

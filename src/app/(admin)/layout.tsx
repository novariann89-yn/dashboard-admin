import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { BottomNav } from "@/components/bottom-nav";
import { IconBottle } from "@/components/icons";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b-2 border-ink bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-control border-2 border-ink bg-soy">
              <IconBottle className="h-4 w-4" />
            </span>
            <span className="text-sm font-extrabold tracking-tight">
              Toko Mas Andik
            </span>
          </Link>
          <form action={logoutAction}>
            <button className="text-xs font-semibold text-ink-soft underline decoration-line decoration-2 underline-offset-2">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-4 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}

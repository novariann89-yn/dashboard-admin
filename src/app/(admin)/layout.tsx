import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { BottomNav } from "@/components/bottom-nav";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/" className="text-sm font-bold">
          Toko Mas Andik
        </Link>
        <form action={logoutAction}>
          <button className="text-xs text-gray-500">Keluar</button>
        </form>
      </header>

      <main className="flex-1 p-4 pb-24">{children}</main>

      <BottomNav />
    </div>
  );
}
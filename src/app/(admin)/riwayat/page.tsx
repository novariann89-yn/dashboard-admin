import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { cardClass } from "@/components/ui";
import { db } from "@/db";
import { members, purchases } from "@/db/schema";
import { formatDateTime, rupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RiwayatPage() {
  const rows = await db
    .select({
      id: purchases.id,
      totalAmount: purchases.totalAmount,
      status: purchases.status,
      occurredAt: purchases.occurredAt,
      countsTowardBonus: purchases.countsTowardBonus,
      memberName: members.name,
    })
    .from(purchases)
    .innerJoin(members, eq(purchases.memberId, members.id))
    .orderBy(desc(purchases.occurredAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Riwayat Pembelian</h1>

      <section className={cardClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada pembelian.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <Link href={`/riwayat/${p.id}`} className="font-medium underline">
                    {p.memberName}
                  </Link>
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(p.occurredAt)}
                    {!p.countsTowardBonus && " | tidak dihitung bonus"}
                  </span>
                </span>
                <span className="text-right">
                  {rupiah(p.totalAmount)}
                  {p.status === "void" && (
                    <span className="block text-xs text-red-600">dibatalkan</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">Menampilkan 100 transaksi terakhir.</p>
    </div>
  );
}

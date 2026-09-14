import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import {
  cardClass,
  sectionLabelClass,
  statusVoidClass,
} from "@/components/ui";
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Riwayat Pembelian</h1>

      <section className={cardClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">Belum ada pembelian.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="text-sm">
                  <Link href={`/riwayat/${p.id}`} className="font-bold">
                    {p.memberName}
                  </Link>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {formatDateTime(p.occurredAt)}
                    {!p.countsTowardBonus && " · tidak dihitung bonus"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold tabular-nums">
                    {rupiah(p.totalAmount)}
                  </span>
                  {p.status === "void" && (
                    <span className={`${statusVoidClass} mt-1`}>dibatalkan</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={sectionLabelClass}>Menampilkan 100 transaksi terakhir.</p>
    </div>
  );
}

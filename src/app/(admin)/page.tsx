import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { redeemBonusAction } from "@/actions/bonus";
import {
  badgeClass,
  buttonClass,
  cardClass,
  linkClass,
  smallButtonClass,
} from "@/components/ui";
import { db } from "@/db";
import {
  bonusEvents,
  bonusRules,
  members,
  purchaseItems,
  purchases,
} from "@/db/schema";
import { formatDateTime, rupiah, startOfTodayWib, startOfWeekWib } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const todayStart = startOfTodayWib();
  const weekStart = startOfWeekWib();

  const [today] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${purchases.totalAmount}), 0)`,
    })
    .from(purchases)
    .where(
      and(eq(purchases.status, "active"), gte(purchases.occurredAt, todayStart)),
    );

  const [bottles] = await db
    .select({ qty: sql<number>`coalesce(sum(${purchaseItems.quantity}), 0)` })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(
      and(eq(purchases.status, "active"), gte(purchases.occurredAt, todayStart)),
    );

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.isActive, true));

  const [newMembers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(gte(members.joinedAt, weekStart));

  const [rule] = await db
    .select()
    .from(bonusRules)
    .where(eq(bonusRules.isActive, true))
    .limit(1);

  const nearBonus = rule
    ? await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.isActive, true),
            gte(members.bonusProgress, Math.max(rule.threshold - 2, 1)),
            lt(members.bonusProgress, rule.threshold),
          ),
        )
        .orderBy(desc(members.bonusProgress))
        .limit(5)
    : [];

  const pendingBonuses = await db
    .select({
      id: bonusEvents.id,
      rewardProductName: bonusEvents.rewardProductName,
      rewardQty: bonusEvents.rewardQty,
      earnedAt: bonusEvents.earnedAt,
      memberName: members.name,
      memberId: members.id,
    })
    .from(bonusEvents)
    .innerJoin(members, eq(bonusEvents.memberId, members.id))
    .where(eq(bonusEvents.status, "earned"))
    .orderBy(desc(bonusEvents.earnedAt))
    .limit(10);

  const recent = await db
    .select({
      id: purchases.id,
      totalAmount: purchases.totalAmount,
      status: purchases.status,
      occurredAt: purchases.occurredAt,
      memberName: members.name,
      memberId: members.id,
    })
    .from(purchases)
    .innerJoin(members, eq(purchases.memberId, members.id))
    .orderBy(desc(purchases.occurredAt))
    .limit(5);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Beranda</h1>

      <Link href="/pembelian" className={`${buttonClass} text-center`}>
        + Catat Pembelian
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <div className={cardClass}>
          <p className="text-xs text-gray-500">Transaksi hari ini</p>
          <p className="text-xl font-bold">{Number(today?.count ?? 0)}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-gray-500">Omzet hari ini</p>
          <p className="text-xl font-bold">{rupiah(Number(today?.revenue ?? 0))}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-gray-500">Botol terjual</p>
          <p className="text-xl font-bold">{Number(bottles?.qty ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={cardClass}>
          <p className="text-xs text-gray-500">Member aktif</p>
          <p className="text-xl font-bold">{Number(memberCount?.count ?? 0)}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-gray-500">Member baru minggu ini</p>
          <p className="text-xl font-bold">{Number(newMembers?.count ?? 0)}</p>
        </div>
      </div>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Bonus belum diberikan</h2>
        {pendingBonuses.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada bonus tertunda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingBonuses.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  <Link href={`/member/${event.memberId}`} className="font-medium underline">
                    {event.memberName}
                  </Link>{" "}
                  - {event.rewardQty} {event.rewardProductName}
                </span>
                <form action={redeemBonusAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="back" value="/" />
                  <button className={smallButtonClass}>Tandai diberikan</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rule && (
        <section className={cardClass}>
          <h2 className="mb-2 text-sm font-semibold">
            Hampir dapat bonus ({rule.threshold} pembelian)
          </h2>
          {nearBonus.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {nearBonus.map((m) => (
                <li key={m.id} className="flex justify-between text-sm">
                  <Link href={`/member/${m.id}`} className="underline">
                    {m.name}
                  </Link>
                  <span className={badgeClass}>
                    {m.bonusProgress}/{rule.threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Transaksi terakhir</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada transaksi.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  <Link href={`/riwayat/${p.id}`} className={linkClass}>
                    {p.memberName}
                  </Link>
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(p.occurredAt)}
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
    </div>
  );
}

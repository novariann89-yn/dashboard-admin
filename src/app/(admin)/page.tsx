import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { redeemBonusAction } from "@/actions/bonus";
import { IconPlus } from "@/components/icons";
import {
  buttonClass,
  cardClass,
  linkClass,
  sectionLabelClass,
  smallButtonClass,
  statusVoidClass,
  strongCardClass,
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Beranda</h1>

      <Link href="/pembelian" className={buttonClass}>
        <IconPlus className="h-4 w-4" />
        Catat Pembelian
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Transaksi hari ini</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {Number(today?.count ?? 0)}
          </p>
        </div>
        <div className={strongCardClass}>
          <p className={sectionLabelClass}>Botol terjual</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {Number(bottles?.qty ?? 0)}
          </p>
        </div>
      </div>

      <div className={strongCardClass}>
        <p className={sectionLabelClass}>Omzet hari ini</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">
          {rupiah(Number(today?.revenue ?? 0))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cardClass}>
          <p className="text-xs font-semibold text-ink-soft">Member aktif</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            {Number(memberCount?.count ?? 0)}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-semibold text-ink-soft">
            Member baru minggu ini
          </p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            {Number(newMembers?.count ?? 0)}
          </p>
        </div>
      </div>

      <section
        className={
          pendingBonuses.length > 0
            ? "rounded-card border-2 border-soy-dark/50 bg-cream p-4"
            : cardClass
        }
      >
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          Bonus belum diberikan
          {pendingBonuses.length > 0 && (
            <span className="rounded-full bg-soy px-2 py-0.5 text-xs font-bold tabular-nums text-ink">
              {pendingBonuses.length}
            </span>
          )}
        </h2>
        {pendingBonuses.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Tidak ada bonus tertunda.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pendingBonuses.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  <Link href={`/member/${event.memberId}`} className={linkClass}>
                    {event.memberName}
                  </Link>
                  <span className="block text-xs font-medium text-ink-soft">
                    {event.rewardQty} {event.rewardProductName} ·{" "}
                    {formatDateTime(event.earnedAt)}
                  </span>
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
          <h2 className={sectionLabelClass}>
            Hampir dapat bonus ({rule.threshold} pembelian)
          </h2>
          {nearBonus.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Belum ada.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {nearBonus.map((m) => {
                const pct = Math.min(
                  100,
                  Math.round((m.bonusProgress / rule.threshold) * 100),
                );
                return (
                  <li key={m.id}>
                    <div className="flex items-center justify-between text-sm">
                      <Link href={`/member/${m.id}`} className="font-semibold">
                        {m.name}
                      </Link>
                      <span className="tabular-nums text-ink-soft">
                        {m.bonusProgress}/{rule.threshold}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-line">
                      <div
                        className="h-2 rounded-full bg-soy"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Transaksi terakhir</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada transaksi.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">
                  <Link href={`/riwayat/${p.id}`} className="font-semibold">
                    {p.memberName}
                  </Link>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {formatDateTime(p.occurredAt)}
                  </span>
                </span>
                <span className="text-right text-sm font-bold tabular-nums">
                  {rupiah(p.totalAmount)}
                  {p.status === "void" && (
                    <span className={`${statusVoidClass} mt-1 block w-fit`}>
                      dibatalkan
                    </span>
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

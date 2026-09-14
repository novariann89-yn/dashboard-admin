import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateMemberAction } from "@/actions/members";
import { IconArrowLeft } from "@/components/icons";
import {
  alertErrorClass,
  alertSuccessClass,
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  linkClass,
  sectionLabelClass,
  statusActiveClass,
  statusVoidClass,
  strongCardClass,
} from "@/components/ui";
import { db } from "@/db";
import { bonusEvents, bonusRules, members, purchases } from "@/db/schema";
import { formatDateTime, rupiah } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const memberId = Number(id);
  if (!Number.isFinite(memberId) || memberId <= 0) notFound();

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) notFound();

  const history = await db
    .select()
    .from(purchases)
    .where(eq(purchases.memberId, memberId))
    .orderBy(desc(purchases.occurredAt))
    .limit(50);

  const bonuses = await db
    .select()
    .from(bonusEvents)
    .where(eq(bonusEvents.memberId, memberId))
    .orderBy(desc(bonusEvents.earnedAt));

  const [rule] = await db
    .select()
    .from(bonusRules)
    .where(eq(bonusRules.isActive, true))
    .limit(1);

  const threshold = rule?.threshold ?? 0;
  const pct =
    threshold > 0
      ? Math.min(100, Math.round((member.bonusProgress / threshold) * 100))
      : 0;

  const error = first(sp.error);
  const ok = first(sp.ok);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/member"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Kembali ke daftar member
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-soy text-lg font-extrabold">
            {member.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {member.name}
            </h1>
            <p className="text-sm tabular-nums text-ink-soft">
              {formatPhone(member.phone)}
            </p>
          </div>
        </div>
      </div>

      {error && <p className={alertErrorClass}>{error}</p>}
      {ok && <p className={alertSuccessClass}>{ok}</p>}

      <section className={strongCardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Progress bonus</h2>
          <span className={badgeClass}>
            {member.bonusProgress}/{threshold || "-"}
          </span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-line">
          <div
            className="h-2.5 rounded-full bg-soy"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-ink-soft">Total pembelian</p>
            <p className="text-xl font-extrabold tabular-nums">
              {member.totalPurchases}x
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft">Total bonus</p>
            <p className="text-xl font-extrabold tabular-nums">
              {member.totalBonuses}x
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Terdaftar: {formatDateTime(member.joinedAt)}
        </p>
      </section>

      <details className={cardClass}>
        <summary className="cursor-pointer text-sm font-extrabold">
          Ubah data member
        </summary>
        <form action={updateMemberAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={member.id} />
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Nama</span>
            <input name="name" defaultValue={member.name} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Nomor HP</span>
            <input
              name="phone"
              defaultValue={member.phone}
              inputMode="tel"
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Catatan</span>
            <input name="notes" defaultValue={member.notes ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Progress bonus saat ini</span>
            <input
              type="number"
              name="bonusProgress"
              min={0}
              defaultValue={member.bonusProgress}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-3 rounded-control border-2 border-line bg-white p-3 text-sm font-bold">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={member.isActive}
              className="h-5 w-5 accent-soy-dark"
            />
            Member aktif
          </label>
          <button className={buttonClass}>Simpan</button>
        </form>
      </details>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Riwayat bonus</h2>
        {bonuses.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada bonus.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {bonuses.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-semibold">
                  {b.rewardQty} {b.rewardProductName}
                  <span className="block text-xs font-normal tabular-nums text-ink-soft">
                    {formatDateTime(b.earnedAt)}
                  </span>
                </span>
                <span
                  className={
                    b.status === "redeemed" ? statusActiveClass : badgeClass
                  }
                >
                  {b.status === "redeemed" ? "sudah diberikan" : "belum diberikan"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>
          Riwayat pembelian (50 terakhir)
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada pembelian.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">
                  <Link href={`/riwayat/${p.id}`} className={linkClass}>
                    {formatDateTime(p.occurredAt)}
                  </Link>
                  {p.status === "void" && (
                    <span className={`${statusVoidClass} ml-2`}>dibatalkan</span>
                  )}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {rupiah(p.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

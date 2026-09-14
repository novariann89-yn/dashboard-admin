import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateMemberAction } from "@/actions/members";
import { badgeClass, buttonClass, cardClass, inputClass } from "@/components/ui";
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

  const error = first(sp.error);
  const ok = first(sp.ok);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/member" className="text-xs text-gray-500 underline">
          Kembali ke daftar member
        </Link>
        <h1 className="text-lg font-bold">{member.name}</h1>
        <p className="text-sm text-gray-600">{formatPhone(member.phone)}</p>
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {ok}
        </p>
      )}

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Ringkasan</h2>
        <p className="text-sm">
          Progress bonus:{" "}
          <span className={badgeClass}>
            {member.bonusProgress}/{rule?.threshold ?? "-"}
          </span>
        </p>
        <p className="text-sm">Total pembelian: {member.totalPurchases}x</p>
        <p className="text-sm">Total bonus didapat: {member.totalBonuses}x</p>
        <p className="text-sm">Terdaftar: {formatDateTime(member.joinedAt)}</p>
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Ubah data</h2>
        <form action={updateMemberAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={member.id} />
          <label className="text-sm">
            Nama
            <input name="name" defaultValue={member.name} className={inputClass} required />
          </label>
          <label className="text-sm">
            Nomor HP
            <input
              name="phone"
              defaultValue={member.phone}
              inputMode="tel"
              className={inputClass}
              required
            />
          </label>
          <label className="text-sm">
            Catatan
            <input name="notes" defaultValue={member.notes ?? ""} className={inputClass} />
          </label>
          <label className="text-sm">
            Progress bonus saat ini
            <input
              type="number"
              name="bonusProgress"
              min={0}
              defaultValue={member.bonusProgress}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={member.isActive} />
            Member aktif
          </label>
          <button className={buttonClass}>Simpan</button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Riwayat bonus</h2>
        {bonuses.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada bonus.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {bonuses.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>
                  {b.rewardQty} {b.rewardProductName}
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(b.earnedAt)}
                  </span>
                </span>
                <span className="text-xs">
                  {b.status === "redeemed" ? "sudah diberikan" : "belum diberikan"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Riwayat pembelian (50 terakhir)</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada pembelian.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <Link href={`/riwayat/${p.id}`} className="underline">
                    {formatDateTime(p.occurredAt)}
                  </Link>
                  {p.status === "void" && (
                    <span className="ml-1 text-xs text-red-600">dibatalkan</span>
                  )}
                </span>
                <span>{rupiah(p.totalAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

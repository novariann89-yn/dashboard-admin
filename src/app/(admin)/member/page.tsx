import { desc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { createMemberAction } from "@/actions/members";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  smallButtonClass,
} from "@/components/ui";
import { db } from "@/db";
import { bonusRules, members } from "@/db/schema";
import { formatPhone } from "@/lib/phone";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const error = first(sp.error);
  const ok = first(sp.ok);

  const rows = q
    ? await db
        .select()
        .from(members)
        .where(or(like(members.name, `%${q}%`), like(members.phone, `%${q}%`)))
        .orderBy(desc(members.joinedAt))
        .limit(200)
    : await db.select().from(members).orderBy(desc(members.joinedAt)).limit(200);

  const [rule] = await db
    .select()
    .from(bonusRules)
    .where(eq(bonusRules.isActive, true))
    .limit(1);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Member</h1>

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
        <h2 className="mb-2 text-sm font-semibold">Tambah member</h2>
        <form action={createMemberAction} className="flex flex-col gap-2">
          <input name="name" placeholder="Nama" className={inputClass} required />
          <input
            name="phone"
            placeholder="08xxxxxxxxxx"
            inputMode="tel"
            className={inputClass}
            required
          />
          <input name="notes" placeholder="Catatan (opsional)" className={inputClass} />
          <button className={buttonClass}>Tambah</button>
        </form>
      </section>

      <section className={cardClass}>
        <form method="get" className="mb-3 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari nama / nomor"
            className={inputClass}
          />
          <button className={buttonClass}>Cari</button>
        </form>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada member.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <div className="text-sm">
                  <Link href={`/member/${m.id}`} className="font-medium underline">
                    {m.name}
                  </Link>
                  {!m.isActive && <span className="ml-1 text-xs text-gray-400">(nonaktif)</span>}
                  <p className="text-xs text-gray-500">{formatPhone(m.phone)}</p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <span className={badgeClass}>
                    {m.bonusProgress}/{rule?.threshold ?? "-"}
                  </span>
                  <p>{m.totalPurchases}x beli | {m.totalBonuses} bonus</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Menampilkan maksimal 200 member. Gunakan pencarian untuk mempersempit.
      </p>
      <Link href="/pembelian" className={`${smallButtonClass} text-center`}>
        Catat pembelian
      </Link>
    </div>
  );
}

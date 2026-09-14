import { desc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { createMemberAction } from "@/actions/members";
import { IconPlus, IconSearch } from "@/components/icons";
import {
  alertErrorClass,
  alertSuccessClass,
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
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

  const threshold = rule?.threshold ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Member</h1>

      {error && <p className={alertErrorClass}>{error}</p>}
      {ok && <p className={alertSuccessClass}>{ok}</p>}

      <details className={cardClass}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
          <IconPlus className="h-4 w-4" />
          Tambah member
        </summary>
        <form action={createMemberAction} className="mt-3 flex flex-col gap-3">
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
      </details>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nama / nomor"
          className={inputClass}
        />
        <button className={buttonClass}>
          <IconSearch className="h-4 w-4" />
          Cari
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Tidak ada member.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => {
            const pct =
              threshold > 0
                ? Math.min(100, Math.round((m.bonusProgress / threshold) * 100))
                : 0;
            return (
              <li key={m.id}>
                <Link
                  href={`/member/${m.id}`}
                  className={`block rounded-card border p-3 ${
                    m.isActive
                      ? "border-line bg-surface"
                      : "border-line bg-canvas opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">
                        {m.name}
                        {!m.isActive && (
                          <span className="ml-1 text-xs font-medium text-ink-soft">
                            (nonaktif)
                          </span>
                        )}
                      </p>
                      <p className="text-xs tabular-nums text-ink-soft">
                        {formatPhone(m.phone)}
                      </p>
                    </div>
                    <span className={badgeClass}>
                      {m.bonusProgress}/{threshold || "-"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-line">
                    <div
                      className="h-1.5 rounded-full bg-soy"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-ink-soft">
                    {m.totalPurchases}x beli · {m.totalBonuses} bonus
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className={sectionLabelClass}>
        Menampilkan maksimal 200 member. Gunakan pencarian untuk mempersempit.
      </p>
    </div>
  );
}

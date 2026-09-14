import { eq } from "drizzle-orm";
import { recordPurchaseAction } from "@/actions/purchases";
import { IconSearch } from "@/components/icons";
import { PurchaseItems } from "@/components/purchase-items";
import {
  alertErrorClass,
  alertSuccessClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  strongCardClass,
} from "@/components/ui";
import { db } from "@/db";
import { bonusRules, members, products, type Member } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StepHeading({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-soy text-xs font-extrabold">
        {step}
      </span>
      {children}
    </h2>
  );
}

export default async function PembelianPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawPhone = first(sp.phone).trim();
  const ok = first(sp.ok) === "1";
  const error = first(sp.error);
  const successMember = first(sp.member);
  const successBonus = first(sp.bonus);
  const successProgress = first(sp.progress);

  let normalized: string | null = null;
  let member: Member | undefined;
  if (rawPhone) {
    normalized = normalizePhone(rawPhone);
    if (normalized) {
      member = (
        await db.select().from(members).where(eq(members.phone, normalized)).limit(1)
      )[0];
    }
  }

  const [rule] = await db
    .select()
    .from(bonusRules)
    .where(eq(bonusRules.isActive, true))
    .limit(1);

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.sortOrder);

  const threshold = rule?.threshold ?? 0;
  const memberPct =
    member && threshold > 0
      ? Math.min(100, Math.round((member.bonusProgress / threshold) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Catat Pembelian</h1>

      {ok && (
        <div className={alertSuccessClass}>
          <p className="font-bold">Pembelian {successMember} tersimpan.</p>
          {successProgress && (
            <p className="mt-0.5 text-xs tabular-nums">
              Progress bonus: {successProgress}
            </p>
          )}
          {successBonus && (
            <div className="mt-2 rounded-control border-2 border-ink bg-soy p-3 text-ink">
              <p className="text-xs font-bold uppercase tracking-wider">
                Bonus didapat
              </p>
              <p className="text-base font-extrabold">{successBonus}</p>
              <p className="text-xs font-medium">
                Tandai sudah diberikan di Beranda.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <div className={alertErrorClass}>{error}</div>}

      <section className={cardClass}>
        <StepHeading step="1">Cek nomor HP</StepHeading>
        <form method="get" className="flex gap-2">
          <input
            name="phone"
            defaultValue={rawPhone}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={inputClass}
            required
          />
          <button className={buttonClass}>
            <IconSearch className="h-4 w-4" />
            Cek
          </button>
        </form>

        {rawPhone && !normalized && (
          <p className="mt-2 text-sm font-medium text-brick">Nomor tidak valid.</p>
        )}

        {member && (
          <div className="mt-3 rounded-control border-2 border-ink bg-cream p-3">
            <p className="text-sm font-bold">
              {member.name}
              {!member.isActive && (
                <span className="ml-1 text-xs font-medium text-ink-soft">
                  (nonaktif)
                </span>
              )}
            </p>
            <div className="mt-2 h-2 rounded-full bg-white">
              <div
                className="h-2 rounded-full bg-soy"
                style={{ width: `${memberPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-ink-soft">
              Progress bonus {member.bonusProgress}/{threshold || "-"} ·{" "}
              {member.totalPurchases}x beli
            </p>
          </div>
        )}

        {normalized && !member && (
          <p className="mt-2 text-sm text-ink-soft">
            Nomor belum terdaftar. Isi nama di bawah untuk daftar member baru.
          </p>
        )}
      </section>

      {normalized ? (
        <section className={strongCardClass}>
          <StepHeading step="2">Barang dan simpan</StepHeading>
          <form action={recordPurchaseAction} className="flex flex-col gap-4">
            <input type="hidden" name="phone" value={normalized} />

            {!member && (
              <label className="flex flex-col gap-2">
                <span className={sectionLabelClass}>Nama member baru</span>
                <input name="name" className={inputClass} required />
              </label>
            )}

            <PurchaseItems products={productList} />

            <label className="flex flex-col gap-2">
              <span className={sectionLabelClass}>Catatan (opsional)</span>
              <input name="note" className={inputClass} />
            </label>

            <label className="flex flex-col gap-2">
              <span className={sectionLabelClass}>
                Tanggal pembelian (opsional, untuk data lama)
              </span>
              <input type="datetime-local" name="occurredAt" className={inputClass} />
            </label>

            <label className="flex items-center gap-3 rounded-control border-2 border-line bg-white p-3 text-sm font-bold">
              <input
                type="checkbox"
                name="counts"
                defaultChecked
                className="h-5 w-5 accent-soy-dark"
              />
              Hitung untuk bonus
            </label>

            <button className={buttonClass}>Simpan Pembelian</button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-ink-soft">
          Masukkan dan cek nomor HP dulu untuk membuka form pembelian.
        </p>
      )}
    </div>
  );
}

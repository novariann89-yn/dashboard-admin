import { eq } from "drizzle-orm";
import { recordPurchaseAction } from "@/actions/purchases";
import { buttonClass, cardClass, inputClass } from "@/components/ui";
import { db } from "@/db";
import { bonusRules, members, products, type Member } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Catat Pembelian</h1>

      {ok && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm">
          <p className="font-medium">Pembelian {successMember} tersimpan.</p>
          {successProgress && <p>Progress bonus: {successProgress}</p>}
          {successBonus && (
            <p className="font-semibold text-green-700">
              BONUS: {successBonus} (tandai sudah diberikan di Beranda)
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">1. Cek nomor HP</h2>
        <form method="get" className="flex gap-2">
          <input
            name="phone"
            defaultValue={rawPhone}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={inputClass}
            required
          />
          <button className={buttonClass}>Cek</button>
        </form>

        {rawPhone && !normalized && (
          <p className="mt-2 text-sm text-red-600">Nomor tidak valid.</p>
        )}

        {member && (
          <div className="mt-2 rounded bg-gray-50 p-2 text-sm">
            <p>
              Member: <strong>{member.name}</strong>
              {!member.isActive && " (nonaktif)"}
            </p>
            <p>
              Progress bonus: {member.bonusProgress}/{rule?.threshold ?? "-"} | Total
              pembelian: {member.totalPurchases}
            </p>
          </div>
        )}

        {normalized && !member && (
          <p className="mt-2 text-sm text-gray-600">
            Nomor belum terdaftar. Isi nama di bawah untuk daftar member baru.
          </p>
        )}
      </section>

      {normalized ? (
        <section className={cardClass}>
          <h2 className="mb-2 text-sm font-semibold">2. Barang dan simpan</h2>
          <form action={recordPurchaseAction} className="flex flex-col gap-3">
            <input type="hidden" name="phone" value={normalized} />

            {!member && (
              <label className="text-sm">
                Nama member baru
                <input name="name" className={inputClass} required />
              </label>
            )}

            {productList.map((p, index) => (
              <label
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {p.name} - Rp {p.price.toLocaleString("id-ID")}
                </span>
                <input
                  type="number"
                  name={`qty_${p.id}`}
                  min={0}
                  defaultValue={index === 0 ? 1 : 0}
                  inputMode="numeric"
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                />
              </label>
            ))}

            <label className="text-sm">
              Catatan (opsional)
              <input name="note" className={inputClass} />
            </label>

            <label className="text-sm">
              Tanggal pembelian (opsional, untuk data lama)
              <input type="datetime-local" name="occurredAt" className={inputClass} />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="counts" defaultChecked />
              Hitung untuk bonus
            </label>

            <button className={buttonClass}>Simpan Pembelian</button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-gray-500">
          Masukkan dan cek nomor HP dulu untuk membuka form pembelian.
        </p>
      )}
    </div>
  );
}

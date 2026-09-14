import { eq } from "drizzle-orm";
import {
  toggleProductAction,
  updateBonusRuleAction,
  updateProductAction,
} from "@/actions/settings";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  smallButtonClass,
} from "@/components/ui";
import { db } from "@/db";
import { bonusRules, products } from "@/db/schema";
import { rupiah } from "@/lib/format";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = first(sp.error);
  const ok = first(sp.ok);

  const productList = await db
    .select()
    .from(products)
    .orderBy(products.sortOrder, products.id);

  const [rule] = await db
    .select()
    .from(bonusRules)
    .where(eq(bonusRules.isActive, true))
    .limit(1);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Pengaturan</h1>

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
        <h2 className="mb-2 text-sm font-semibold">Produk dan harga</h2>
        <div className="flex flex-col gap-4">
          {productList.map((p) => (
            <div key={p.id} className="rounded border border-gray-100 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className={badgeClass}>
                  {p.isActive ? "aktif" : "nonaktif"}
                </span>
                <span className="text-xs text-gray-500">{rupiah(p.price)}</span>
              </div>
              <form action={updateProductAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={p.id} />
                <label className="flex-1 text-xs">
                  Nama
                  <input name="name" defaultValue={p.name} className={inputClass} />
                </label>
                <label className="w-24 text-xs">
                  Harga
                  <input
                    type="number"
                    name="price"
                    min={0}
                    defaultValue={p.price}
                    className={inputClass}
                  />
                </label>
                <button className={smallButtonClass}>Simpan</button>
              </form>
              <form action={toggleProductAction} className="mt-1">
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-gray-500 underline">
                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Aturan bonus</h2>
        <p className="mb-2 text-xs text-gray-500">
          Member dapat hadiah setiap mencapai jumlah pembelian tertentu. Hitungan
          di-reset setelah bonus didapat.
        </p>
        <form action={updateBonusRuleAction} className="flex flex-col gap-2">
          {rule && <input type="hidden" name="ruleId" value={rule.id} />}
          <label className="text-sm">
            Jumlah pembelian
            <input
              type="number"
              name="threshold"
              min={1}
              defaultValue={rule?.threshold ?? 10}
              className={inputClass}
              required
            />
          </label>
          <label className="text-sm">
            Produk hadiah
            <select
              name="rewardProductId"
              defaultValue={rule?.rewardProductId ?? ""}
              className={inputClass}
              required
            >
              <option value="" disabled>
                Pilih produk
              </option>
              {productList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Jumlah hadiah
            <input
              type="number"
              name="rewardQty"
              min={1}
              defaultValue={rule?.rewardQty ?? 1}
              className={inputClass}
              required
            />
          </label>
          <button className={buttonClass}>Simpan aturan</button>
        </form>
        {rule && (
          <p className="mt-2 text-xs text-gray-500">
            Aktif sekarang: {rule.threshold} pembelian - {rule.rewardQty} hadiah.
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Backup data</h2>
        <p className="mb-2 text-xs text-gray-500">
          Unduh data sebagai file CSV (bisa dibuka di Excel atau Google Sheets).
          Sebaiknya simpan salinan setiap minggu.
        </p>
        <div className="flex flex-col gap-2">
          <a href="/export/members" className={`${smallButtonClass} text-center`}>
            Unduh data member
          </a>
          <a href="/export/purchases" className={`${smallButtonClass} text-center`}>
            Unduh data pembelian
          </a>
          <a href="/export/bonuses" className={`${smallButtonClass} text-center`}>
            Unduh data bonus
          </a>
        </div>
      </section>
    </div>
  );
}

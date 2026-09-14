import { eq } from "drizzle-orm";
import {
  toggleProductAction,
  updateBonusRuleAction,
  updateProductAction,
} from "@/actions/settings";
import { IconDownload } from "@/components/icons";
import {
  alertErrorClass,
  alertSuccessClass,
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  secondaryButtonClass,
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

  const rewardProduct = productList.find((p) => p.id === rule?.rewardProductId);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Pengaturan</h1>

      {error && <p className={alertErrorClass}>{error}</p>}
      {ok && <p className={alertSuccessClass}>{ok}</p>}

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Produk dan harga</h2>
        <div className="mt-3 flex flex-col gap-4">
          {productList.map((p) => (
            <div
              key={p.id}
              className="rounded-control border-2 border-line bg-white p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={
                    p.isActive
                      ? "inline-flex items-center rounded-md border border-pandan/40 bg-pandan/10 px-2 py-0.5 text-xs font-bold text-pandan"
                      : badgeClass
                  }
                >
                  {p.isActive ? "aktif" : "nonaktif"}
                </span>
                <span className="text-xs font-bold tabular-nums text-ink-soft">
                  {rupiah(p.price)}
                </span>
              </div>
              <form action={updateProductAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={p.id} />
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    Nama
                  </span>
                  <input name="name" defaultValue={p.name} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    Harga
                  </span>
                  <input
                    type="number"
                    name="price"
                    min={0}
                    defaultValue={p.price}
                    className={`${inputClass} tabular-nums`}
                  />
                </label>
                <button className={secondaryButtonClass}>Simpan</button>
              </form>
              <form action={toggleProductAction} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs font-semibold text-ink-soft underline decoration-line decoration-2 underline-offset-2">
                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Aturan bonus</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Member dapat hadiah setiap mencapai jumlah pembelian tertentu. Hitungan
          di-reset setelah bonus didapat.
        </p>
        {rule && rewardProduct && (
          <p className="mt-3 rounded-control border-2 border-soy-dark/50 bg-cream p-3 text-sm font-bold">
            Setiap {rule.threshold} pembelian → {rule.rewardQty}{" "}
            {rewardProduct.name}
          </p>
        )}
        <form action={updateBonusRuleAction} className="mt-3 flex flex-col gap-3">
          {rule && <input type="hidden" name="ruleId" value={rule.id} />}
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Jumlah pembelian</span>
            <input
              type="number"
              name="threshold"
              min={1}
              defaultValue={rule?.threshold ?? 10}
              className={`${inputClass} tabular-nums`}
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Produk hadiah</span>
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
          <label className="flex flex-col gap-2">
            <span className={sectionLabelClass}>Jumlah hadiah</span>
            <input
              type="number"
              name="rewardQty"
              min={1}
              defaultValue={rule?.rewardQty ?? 1}
              className={`${inputClass} tabular-nums`}
              required
            />
          </label>
          <button className={buttonClass}>Simpan aturan</button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Backup data</h2>
        <p className="mt-1 mb-3 text-xs text-ink-soft">
          Unduh data sebagai file CSV (bisa dibuka di Excel atau Google Sheets).
          Sebaiknya simpan salinan setiap minggu.
        </p>
        <div className="flex flex-col gap-2">
          <a href="/export/members" className={secondaryButtonClass}>
            <IconDownload className="h-4 w-4" />
            Unduh data member
          </a>
          <a href="/export/purchases" className={secondaryButtonClass}>
            <IconDownload className="h-4 w-4" />
            Unduh data pembelian
          </a>
          <a href="/export/bonuses" className={secondaryButtonClass}>
            <IconDownload className="h-4 w-4" />
            Unduh data bonus
          </a>
        </div>
        <p className={`${sectionLabelClass} mt-3`}>
          Catatan: file CSV memakai pemisah titik-koma (;) agar rapi di Excel.
        </p>
      </section>
    </div>
  );
}

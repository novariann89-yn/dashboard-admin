import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redeemBonusAction } from "@/actions/bonus";
import { voidPurchaseAction } from "@/actions/purchases";
import { IconArrowLeft } from "@/components/icons";
import {
  alertErrorClass,
  alertSuccessClass,
  cardClass,
  dangerButtonClass,
  linkClass,
  sectionLabelClass,
  smallButtonClass,
  statusActiveClass,
  statusVoidClass,
  strongCardClass,
} from "@/components/ui";
import { db } from "@/db";
import { bonusEvents, members, purchaseItems, purchases } from "@/db/schema";
import { formatDateTime, rupiah } from "@/lib/format";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RiwayatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const purchaseId = Number(id);
  if (!Number.isFinite(purchaseId) || purchaseId <= 0) notFound();

  const [row] = await db
    .select({
      purchase: purchases,
      memberName: members.name,
      memberId: members.id,
    })
    .from(purchases)
    .innerJoin(members, eq(purchases.memberId, members.id))
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!row) notFound();

  const items = await db
    .select()
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, purchaseId));

  const [bonus] = await db
    .select()
    .from(bonusEvents)
    .where(eq(bonusEvents.purchaseId, purchaseId))
    .limit(1);

  const error = first(sp.error);
  const ok = first(sp.ok);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/riwayat"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Kembali ke riwayat
        </Link>
      </div>

      {error && <p className={alertErrorClass}>{error}</p>}
      {ok && <p className={alertSuccessClass}>Pembelian dibatalkan.</p>}
      {row.purchase.status === "void" && (
        <p className={alertErrorClass}>Transaksi ini sudah dibatalkan.</p>
      )}

      <section className={strongCardClass}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold tracking-tight">
            Transaksi #{row.purchase.id}
          </h1>
          <span
            className={
              row.purchase.status === "void" ? statusVoidClass : statusActiveClass
            }
          >
            {row.purchase.status === "void" ? "dibatalkan" : "aktif"}
          </span>
        </div>
        <p className="mt-1 text-sm tabular-nums text-ink-soft">
          {formatDateTime(row.purchase.occurredAt)}
        </p>
        <p className="mt-3 text-sm">
          Member:{" "}
          <Link href={`/member/${row.memberId}`} className={linkClass}>
            {row.memberName}
          </Link>
        </p>
        <p className="text-sm text-ink-soft">
          Hitung bonus: {row.purchase.countsTowardBonus ? "ya" : "tidak"}
        </p>
        {row.purchase.note && (
          <p className="mt-2 rounded-control bg-cream p-2 text-sm text-ink-soft">
            Catatan: {row.purchase.note}
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Barang</h2>
        <ul className="mt-1 flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between border-b-2 border-dashed border-ink/15 py-3 last:border-b-0"
            >
              <span className="text-sm">
                <span className="font-semibold">{item.productName}</span>
                <span className="text-ink-soft"> x{item.quantity}</span>
                <span className="block text-xs tabular-nums text-ink-soft">
                  @ {rupiah(item.unitPrice)}
                </span>
              </span>
              <span className="text-sm font-bold tabular-nums">
                {rupiah(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-ink pt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Total
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            {rupiah(row.purchase.totalAmount)}
          </span>
        </div>
      </section>

      {bonus && (
        <section className="rounded-card border-2 border-soy-dark/50 bg-cream p-4">
          <h2 className={sectionLabelClass}>Bonus dari transaksi ini</h2>
          <p className="mt-1 text-sm font-bold">
            {bonus.rewardQty} {bonus.rewardProductName}
          </p>
          <p className="text-xs font-medium text-ink-soft">
            {bonus.status === "redeemed" ? "Sudah diberikan" : "Belum diberikan"}
          </p>
          {bonus.status === "earned" && (
            <form action={redeemBonusAction} className="mt-3">
              <input type="hidden" name="eventId" value={bonus.id} />
              <input type="hidden" name="back" value={`/riwayat/${purchaseId}`} />
              <button className={smallButtonClass}>Tandai sudah diberikan</button>
            </form>
          )}
        </section>
      )}

      {row.purchase.status === "active" && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>Batalkan transaksi</h2>
          <p className="mt-1 mb-3 text-xs text-ink-soft">
            Pembatalan mengembalikan hitungan pembelian member. Transaksi yang
            memicu bonus tidak bisa dibatalkan.
          </p>
          <form action={voidPurchaseAction}>
            <input type="hidden" name="purchaseId" value={purchaseId} />
            <button className={dangerButtonClass}>Batalkan</button>
          </form>
        </section>
      )}
    </div>
  );
}

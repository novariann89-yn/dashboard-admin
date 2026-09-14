import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redeemBonusAction } from "@/actions/bonus";
import { voidPurchaseAction } from "@/actions/purchases";
import { buttonClass, cardClass, smallButtonClass } from "@/components/ui";
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
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/riwayat" className="text-xs text-gray-500 underline">
          Kembali ke riwayat
        </Link>
        <h1 className="text-lg font-bold">Transaksi #{row.purchase.id}</h1>
        <p className="text-sm text-gray-600">
          {formatDateTime(row.purchase.occurredAt)}
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          Pembelian dibatalkan.
        </p>
      )}

      {row.purchase.status === "void" && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Transaksi ini sudah dibatalkan.
        </p>
      )}

      <section className={cardClass}>
        <p className="text-sm">
          Member:{" "}
          <Link href={`/member/${row.memberId}`} className="font-medium underline">
            {row.memberName}
          </Link>
        </p>
        <p className="text-sm">
          Hitung bonus: {row.purchase.countsTowardBonus ? "ya" : "tidak"}
        </p>
        {row.purchase.note && (
          <p className="text-sm text-gray-600">Catatan: {row.purchase.note}</p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-2 text-sm font-semibold">Barang</h2>
        <ul className="flex flex-col divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between py-2 text-sm">
              <span>
                {item.productName} x{item.quantity}
                <span className="block text-xs text-gray-500">
                  @ {rupiah(item.unitPrice)}
                </span>
              </span>
              <span>{rupiah(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-right text-sm font-bold">
          Total: {rupiah(row.purchase.totalAmount)}
        </p>
      </section>

      {bonus && (
        <section className={cardClass}>
          <h2 className="mb-2 text-sm font-semibold">Bonus dari transaksi ini</h2>
          <p className="text-sm">
            {bonus.rewardQty} {bonus.rewardProductName} -{" "}
            {bonus.status === "redeemed" ? "sudah diberikan" : "belum diberikan"}
          </p>
          {bonus.status === "earned" && (
            <form action={redeemBonusAction} className="mt-2">
              <input type="hidden" name="eventId" value={bonus.id} />
              <input type="hidden" name="back" value={`/riwayat/${purchaseId}`} />
              <button className={smallButtonClass}>Tandai sudah diberikan</button>
            </form>
          )}
        </section>
      )}

      {row.purchase.status === "active" && (
        <section className={cardClass}>
          <h2 className="mb-2 text-sm font-semibold">Batalkan transaksi</h2>
          <p className="mb-2 text-xs text-gray-500">
            Pembatalan mengembalikan hitungan pembelian member. Transaksi yang
            memicu bonus tidak bisa dibatalkan.
          </p>
          <form action={voidPurchaseAction}>
            <input type="hidden" name="purchaseId" value={purchaseId} />
            <button className={`${buttonClass} bg-red-600`}>Batalkan</button>
          </form>
        </section>
      )}
    </div>
  );
}

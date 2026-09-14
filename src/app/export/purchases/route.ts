import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, purchaseItems, purchases } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { csvDate, csvDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireSession();

  const rows = await db
    .select({
      purchaseId: purchases.id,
      occurredAt: purchases.occurredAt,
      memberName: members.name,
      phone: members.phone,
      status: purchases.status,
      countsTowardBonus: purchases.countsTowardBonus,
      note: purchases.note,
      totalAmount: purchases.totalAmount,
      productName: purchaseItems.productName,
      quantity: purchaseItems.quantity,
      unitPrice: purchaseItems.unitPrice,
      subtotal: purchaseItems.subtotal,
    })
    .from(purchases)
    .innerJoin(members, eq(purchases.memberId, members.id))
    .leftJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
    .orderBy(asc(purchases.id), asc(purchaseItems.id));

  return csvResponse(`pembelian-${csvDate(new Date())}.csv`, [
    [
      "ID Transaksi",
      "Tanggal",
      "Member",
      "No HP",
      "Barang",
      "Qty",
      "Harga Satuan",
      "Subtotal",
      "Total Transaksi",
      "Hitung Bonus",
      "Status",
      "Catatan",
    ],
    ...rows.map((row) => [
      row.purchaseId,
      csvDateTime(row.occurredAt),
      row.memberName,
      row.phone,
      row.productName ?? "",
      row.quantity ?? "",
      row.unitPrice ?? "",
      row.subtotal ?? "",
      row.totalAmount,
      row.countsTowardBonus ? "ya" : "tidak",
      row.status === "void" ? "dibatalkan" : "aktif",
      row.note ?? "",
    ]),
  ]);
}

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { csvDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireSession();

  const rows = await db.select().from(members).orderBy(asc(members.id));

  return csvResponse(`member-${csvDate(new Date())}.csv`, [
    [
      "ID",
      "Nama",
      "No HP",
      "Status",
      "Progress Bonus",
      "Total Pembelian",
      "Total Bonus",
      "Tanggal Daftar",
      "Catatan",
    ],
    ...rows.map((member) => [
      member.id,
      member.name,
      member.phone,
      member.isActive ? "aktif" : "nonaktif",
      member.bonusProgress,
      member.totalPurchases,
      member.totalBonuses,
      csvDate(member.joinedAt),
      member.notes ?? "",
    ]),
  ]);
}

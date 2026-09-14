import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bonusEvents, members } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { csvDate, csvDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireSession();

  const rows = await db
    .select({
      id: bonusEvents.id,
      memberName: members.name,
      phone: members.phone,
      rewardProductName: bonusEvents.rewardProductName,
      rewardQty: bonusEvents.rewardQty,
      status: bonusEvents.status,
      earnedAt: bonusEvents.earnedAt,
      redeemedAt: bonusEvents.redeemedAt,
    })
    .from(bonusEvents)
    .innerJoin(members, eq(bonusEvents.memberId, members.id))
    .orderBy(asc(bonusEvents.id));

  return csvResponse(`bonus-${csvDate(new Date())}.csv`, [
    [
      "ID",
      "Member",
      "No HP",
      "Hadiah",
      "Qty",
      "Status",
      "Tanggal Dapat",
      "Tanggal Diberikan",
    ],
    ...rows.map((row) => [
      row.id,
      row.memberName,
      row.phone,
      row.rewardProductName,
      row.rewardQty,
      row.status === "redeemed" ? "sudah diberikan" : "belum diberikan",
      csvDateTime(row.earnedAt),
      csvDateTime(row.redeemedAt),
    ]),
  ]);
}

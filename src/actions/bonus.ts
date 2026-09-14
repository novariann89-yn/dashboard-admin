"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bonusEvents } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { toInt } from "@/lib/utils";

export async function redeemBonusAction(formData: FormData): Promise<void> {
  await requireSession();

  const eventId = toInt(formData.get("eventId"));
  const back = String(formData.get("back") ?? "/") || "/";

  if (eventId) {
    await db
      .update(bonusEvents)
      .set({ status: "redeemed", redeemedAt: new Date() })
      .where(and(eq(bonusEvents.id, eventId), eq(bonusEvents.status, "earned")));
  }

  revalidatePath("/");
  revalidatePath("/member");
  redirect(back);
}

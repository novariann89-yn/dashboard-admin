"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { parseWibDateTimeLocal } from "@/lib/format";
import { recordPurchase, voidPurchase } from "@/lib/purchase-service";
import { toInt } from "@/lib/utils";

function errorRedirect(path: string, message: string, phone?: string): never {
  const params = new URLSearchParams({ error: message });
  if (phone) params.set("phone", phone);
  redirect(`${path}?${params.toString()}`);
}

export async function recordPurchaseAction(formData: FormData): Promise<void> {
  await requireSession();

  const rawPhone = String(formData.get("phone") ?? "").trim();
  const occurredRaw = String(formData.get("occurredAt") ?? "").trim();
  const occurredAt = occurredRaw ? parseWibDateTimeLocal(occurredRaw) : null;

  if (occurredRaw && !occurredAt) {
    errorRedirect("/pembelian", "Tanggal pembelian tidak valid", rawPhone);
  }

  const activeProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.sortOrder);

  const result = await recordPurchase({
    phone: rawPhone,
    name: String(formData.get("name") ?? ""),
    note: String(formData.get("note") ?? ""),
    countsTowardBonus: formData.get("counts") === "on",
    occurredAt,
    items: activeProducts.map((product) => ({
      productId: product.id,
      quantity: toInt(formData.get(`qty_${product.id}`)),
    })),
  });

  if (!result.ok) {
    errorRedirect("/pembelian", result.error, rawPhone);
  }

  revalidatePath("/");
  revalidatePath("/member");
  revalidatePath("/riwayat");

  const params = new URLSearchParams({
    ok: "1",
    member: result.memberName,
    phone: result.phone,
  });
  if (result.threshold > 0) {
    params.set("progress", `${result.progress}/${result.threshold}`);
  }
  if (result.bonus) {
    params.set("bonus", `${result.bonus.qty} ${result.bonus.name}`);
  }
  redirect(`/pembelian?${params.toString()}`);
}

export async function voidPurchaseAction(formData: FormData): Promise<void> {
  await requireSession();

  const id = toInt(formData.get("purchaseId"));
  if (!id) redirect("/riwayat");

  const result = await voidPurchase(id);

  revalidatePath("/");
  revalidatePath("/member");
  revalidatePath("/riwayat");
  revalidatePath(`/riwayat/${id}`);

  if (!result.ok) {
    redirect(`/riwayat/${id}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/riwayat/${id}?ok=1`);
}

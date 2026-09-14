"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bonusRules, products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { toInt } from "@/lib/utils";

function refresh() {
  revalidatePath("/pengaturan");
  revalidatePath("/pembelian");
  revalidatePath("/");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  await requireSession();

  const id = toInt(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const price = Math.max(0, toInt(formData.get("price")));

  if (!id || !name) redirect("/pengaturan?error=Data+produk+tidak+valid");

  await db.update(products).set({ name, price }).where(eq(products.id, id));
  refresh();
  redirect("/pengaturan?ok=Produk+disimpan");
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  await requireSession();

  const id = toInt(formData.get("id"));
  if (!id) redirect("/pengaturan?error=Produk+tidak+valid");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) redirect("/pengaturan?error=Produk+tidak+ditemukan");

  await db
    .update(products)
    .set({ isActive: !product.isActive })
    .where(eq(products.id, id));

  refresh();
  redirect("/pengaturan?ok=Status+produk+diubah");
}

export async function updateBonusRuleAction(formData: FormData): Promise<void> {
  await requireSession();

  const ruleId = toInt(formData.get("ruleId"));
  const threshold = Math.max(1, toInt(formData.get("threshold")));
  const rewardProductId = toInt(formData.get("rewardProductId"));
  const rewardQty = Math.max(1, toInt(formData.get("rewardQty")));

  if (!rewardProductId) {
    redirect("/pengaturan?error=Pilih+produk+hadiah");
  }

  await db.transaction(async (tx) => {
    await tx.update(bonusRules).set({ isActive: false });

    if (ruleId) {
      await tx
        .update(bonusRules)
        .set({ threshold, rewardProductId, rewardQty, isActive: true })
        .where(eq(bonusRules.id, ruleId));
    } else {
      await tx
        .insert(bonusRules)
        .values({ threshold, rewardProductId, rewardQty, isActive: true });
    }
  });

  refresh();
  redirect("/pengaturan?ok=Aturan+bonus+disimpan");
}

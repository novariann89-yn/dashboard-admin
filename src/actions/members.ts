"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { toInt } from "@/lib/utils";

export async function createMemberAction(formData: FormData): Promise<void> {
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());

  if (!name) redirect("/member?error=Nama+wajib+diisi");
  if (!phone) redirect("/member?error=Nomor+HP+tidak+valid");

  const [existing] = await db
    .select()
    .from(members)
    .where(eq(members.phone, phone))
    .limit(1);

  if (existing) {
    redirect(`/member/${existing.id}?error=Nomor+sudah+terdaftar`);
  }

  const [created] = await db
    .insert(members)
    .values({ name, phone, notes: notes || null })
    .returning();

  if (!created) redirect("/member?error=Gagal+membuat+member");

  revalidatePath("/member");
  revalidatePath("/");
  redirect(`/member/${created.id}?ok=Member+dibuat`);
}

export async function updateMemberAction(formData: FormData): Promise<void> {
  await requireSession();

  const id = toInt(formData.get("id"));
  if (!id) redirect("/member?error=ID+tidak+valid");

  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
  const isActive = formData.get("isActive") === "on";
  const bonusProgress = Math.max(0, toInt(formData.get("bonusProgress")));

  if (!name) redirect(`/member/${id}?error=Nama+wajib+diisi`);
  if (!phone) redirect(`/member/${id}?error=Nomor+HP+tidak+valid`);

  const [duplicate] = await db
    .select()
    .from(members)
    .where(and(eq(members.phone, phone), ne(members.id, id)))
    .limit(1);

  if (duplicate) {
    redirect(`/member/${id}?error=Nomor+sudah+dipakai+member+lain`);
  }

  await db
    .update(members)
    .set({ name, phone, notes: notes || null, isActive, bonusProgress })
    .where(eq(members.id, id));

  revalidatePath("/member");
  revalidatePath(`/member/${id}`);
  revalidatePath("/");
  redirect(`/member/${id}?ok=Perubahan+disimpan`);
}

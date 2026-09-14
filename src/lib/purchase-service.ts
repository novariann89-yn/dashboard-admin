import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bonusEvents,
  bonusRules,
  members,
  products,
  purchaseItems,
  purchases,
} from "@/db/schema";
import { applyPurchase } from "./bonus";
import { normalizePhone } from "./phone";

export type PurchaseInput = {
  phone: string;
  name?: string;
  note?: string;
  countsTowardBonus: boolean;
  items: { productId: number; quantity: number }[];
  occurredAt?: Date | null;
};

export type PurchaseResult =
  | { ok: false; error: string }
  | {
      ok: true;
      memberId: number;
      memberName: string;
      phone: string;
      purchaseId: number;
      progress: number;
      threshold: number;
      totalAmount: number;
      bonus: { name: string; qty: number } | null;
    };

export type VoidResult = { ok: true } | { ok: false; error: string };

export async function recordPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Nomor HP tidak valid" };

  const name = (input.name ?? "").trim();
  const note = (input.note ?? "").trim();

  let occurredAt: Date | undefined;
  if (input.occurredAt) {
    const time = input.occurredAt.getTime();
    if (!Number.isFinite(time)) {
      return { ok: false, error: "Tanggal pembelian tidak valid" };
    }
    if (time > Date.now() + 60_000) {
      return { ok: false, error: "Tanggal pembelian tidak boleh di masa depan" };
    }
    occurredAt = input.occurredAt;
  }

  const wanted = input.items.filter((item) => item.quantity > 0);
  if (wanted.length === 0) return { ok: false, error: "Pilih minimal satu barang" };

  const catalog = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true));
  const byId = new Map(catalog.map((product) => [product.id, product]));

  const lineItems = wanted.flatMap((item) => {
    const product = byId.get(item.productId);
    if (!product) return [];
    return [
      {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      },
    ];
  });

  if (lineItems.length === 0) return { ok: false, error: "Barang tidak valid" };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.subtotal, 0);

  return db.transaction(async (tx): Promise<PurchaseResult> => {
    let member = (
      await tx.select().from(members).where(eq(members.phone, phone)).limit(1)
    )[0];

    if (!member) {
      if (!name) return { ok: false, error: "Member baru: isi nama" };
      member = (await tx.insert(members).values({ name, phone }).returning())[0];
      if (!member) return { ok: false, error: "Gagal membuat member" };
    }
    const currentMember = member;

    const [purchase] = await tx
      .insert(purchases)
      .values({
        memberId: currentMember.id,
        totalAmount,
        note: note || null,
        countsTowardBonus: input.countsTowardBonus,
        ...(occurredAt ? { occurredAt } : {}),
      })
      .returning();

    await tx
      .insert(purchaseItems)
      .values(lineItems.map((item) => ({ ...item, purchaseId: purchase.id })));

    const [rule] = await tx
      .select()
      .from(bonusRules)
      .where(eq(bonusRules.isActive, true))
      .limit(1);

    let progress = currentMember.bonusProgress;
    let totalPurchases = currentMember.totalPurchases;
    let totalBonuses = currentMember.totalBonuses;
    let bonus: { name: string; qty: number } | null = null;

    if (input.countsTowardBonus) {
      totalPurchases += 1;
      if (rule) {
        const result = applyPurchase(progress, rule.threshold);
        progress = result.progress;
        if (result.bonusEarned) {
          const [reward] = await tx
            .select()
            .from(products)
            .where(eq(products.id, rule.rewardProductId))
            .limit(1);
          const rewardName = reward?.name ?? "Hadiah";
          const rewardQty = rule.rewardQty * result.bonusesEarned;
          await tx.insert(bonusEvents).values({
            memberId: currentMember.id,
            ruleId: rule.id,
            purchaseId: purchase.id,
            rewardProductId: rule.rewardProductId,
            rewardProductName: rewardName,
            rewardQty,
          });
          totalBonuses += result.bonusesEarned;
          bonus = { name: rewardName, qty: rewardQty };
        }
      }
    }

    await tx
      .update(members)
      .set({ bonusProgress: progress, totalPurchases, totalBonuses })
      .where(eq(members.id, currentMember.id));

    return {
      ok: true,
      memberId: currentMember.id,
      memberName: currentMember.name,
      phone,
      purchaseId: purchase.id,
      progress,
      threshold: rule?.threshold ?? 0,
      totalAmount,
      bonus,
    };
  });
}

export async function voidPurchase(purchaseId: number): Promise<VoidResult> {
  if (!purchaseId) return { ok: false, error: "ID tidak valid" };

  return db.transaction(async (tx): Promise<VoidResult> => {
    const [purchase] = await tx
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) return { ok: false, error: "Pembelian tidak ditemukan" };
    if (purchase.status === "void") {
      return { ok: false, error: "Pembelian sudah dibatalkan" };
    }

    const [event] = await tx
      .select()
      .from(bonusEvents)
      .where(eq(bonusEvents.purchaseId, purchaseId))
      .limit(1);

    if (event) {
      return { ok: false, error: "Pembelian ini memicu bonus dan tidak bisa dibatalkan" };
    }

    await tx
      .update(purchases)
      .set({ status: "void" })
      .where(eq(purchases.id, purchaseId));

    if (purchase.countsTowardBonus) {
      const [member] = await tx
        .select()
        .from(members)
        .where(eq(members.id, purchase.memberId))
        .limit(1);

      if (member) {
        await tx
          .update(members)
          .set({
            totalPurchases: Math.max(0, member.totalPurchases - 1),
            bonusProgress: Math.max(0, member.bonusProgress - 1),
          })
          .where(eq(members.id, member.id));
      }
    }

    return { ok: true };
  });
}

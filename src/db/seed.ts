import { eq } from "drizzle-orm";
import { db } from "./index";
import { bonusRules, products } from "./schema";

async function main() {
  const existingProducts = await db.select().from(products);

  if (existingProducts.length === 0) {
    await db.insert(products).values([
      { name: "Botol Kecil", price: 5000, sortOrder: 1 },
      { name: "Botol Besar", price: 10000, sortOrder: 2 },
    ]);
    console.log("Produk awal dibuat: Botol Kecil (Rp 5.000), Botol Besar (Rp 10.000)");
  } else {
    console.log("Produk sudah ada, lewati.");
  }

  const existingRules = await db.select().from(bonusRules);
  if (existingRules.length === 0) {
    const [small] = await db
      .select()
      .from(products)
      .where(eq(products.name, "Botol Kecil"))
      .limit(1);
    if (!small) throw new Error("Produk Botol Kecil tidak ditemukan");
    await db.insert(bonusRules).values({
      threshold: 10,
      rewardProductId: small.id,
      rewardQty: 1,
    });
    console.log("Aturan bonus dibuat: 10x pembelian -> 1 Botol Kecil gratis");
  } else {
    console.log("Aturan bonus sudah ada, lewati.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
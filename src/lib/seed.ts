import { getDb } from "./db";
import { randomSalt, hashPin } from "./pin";
import { createProduct, createVariant } from "./repos/products";
import { ensureExpensePresetsSeeded } from "./repos/expense-presets";
import { updateSettings } from "./settings";
import { newId } from "./id";

export const DEFAULT_OWNER_USERNAME = "owner";
export const DEFAULT_OWNER_PASSWORD = "1234";

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  await ensureExpensePresetsSeeded();
  if ((await db.products.count()) > 0) return;

  // Hash outside the transaction: Dexie cannot track Web Crypto's native promise.
  const salt = randomSalt();
  const passwordHash = await hashPin(DEFAULT_OWNER_PASSWORD, salt);

  // Serialized (and re-checked) inside one transaction so a double-invoked
  // effect (React StrictMode) or a second tab can't seed twice.
  await db.transaction(
    "rw",
    [db.products, db.productVariants, db.users, db.settings],
    async () => {
      if ((await db.products.count()) > 0) return;

      const product = await createProduct({
        name: "Sari Kedelai",
        emoji: "🥛",
        sortOrder: 1,
      });

      await createVariant({
        productId: product.id,
        sizeName: "Kecil 250ml",
        sellPrice: 5000,
        costPrice: 3000,
        netProfitPerUnit: 2000,
        sortOrder: 1,
      });

      await createVariant({
        productId: product.id,
        sizeName: "Besar 500ml",
        sellPrice: 10000,
        costPrice: 6000,
        netProfitPerUnit: 4000,
        sortOrder: 2,
      });

      await db.users.add({
        id: newId(),
        username: DEFAULT_OWNER_USERNAME,
        passwordHash,
        passwordSalt: salt,
        role: "owner" as const,
        permissions: ["beranda", "pelanggan", "stok", "dompet", "historis", "setting"],
        active: true,
        createdAt: Date.now(),
      });

      await updateSettings({
        pinSalt: salt,
        pinHash: passwordHash,
        pinIsDefault: true,
        storeName: "Toko Mas Andik",
      });
    },
  );
}
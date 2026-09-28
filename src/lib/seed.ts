import { getDb } from "./db";
import { randomSalt, hashPin } from "./pin";
import { createProduct, createVariant } from "./repos/products";
import { updateSettings } from "./settings";
import { newId } from "./id";

export const DEFAULT_OWNER_USERNAME = "owner";
export const DEFAULT_OWNER_PASSWORD = "1234";

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const productCount = await db.products.count();
  if (productCount > 0) return;

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

  const salt = randomSalt();
  const passwordHash = await hashPin(DEFAULT_OWNER_PASSWORD, salt);

  const ownerUser = {
    id: newId(),
    username: DEFAULT_OWNER_USERNAME,
    passwordHash,
    passwordSalt: salt,
    role: "owner" as const,
    permissions: ["beranda", "pelanggan", "stok", "dompet", "historis", "setting"],
    active: true,
    createdAt: Date.now(),
  };

  await db.users.add(ownerUser);

  await updateSettings({ 
    pinSalt: salt, 
    pinHash: passwordHash, 
    pinIsDefault: true,
    storeName: "Toko Mas Andik"
  });
}
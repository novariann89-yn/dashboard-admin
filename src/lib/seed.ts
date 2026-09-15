import { getDb } from "./db";
import { randomSalt, hashPin } from "./pin";
import { createProduct, createVariant } from "./repos/products";
import { updateSettings } from "./settings";

export const DEFAULT_PIN = "1234";

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const productCount = await db.products.count();
  if (productCount > 0) return;

  const product = await createProduct({
    name: "Sari Kedelai",
    category: "Minuman",
    sortOrder: 1,
  });

  await createVariant({
    productId: product.id,
    sizeName: "Botol Kecil 250ml",
    sellPrice: 5000,
    resellerPrice: 4200,
    costPrice: 3000,
    sortOrder: 1,
  });

  await createVariant({
    productId: product.id,
    sizeName: "Botol Besar 1L",
    sellPrice: 10000,
    resellerPrice: 8500,
    costPrice: 6000,
    sortOrder: 2,
  });

  const salt = randomSalt();
  const pinHash = await hashPin(DEFAULT_PIN, salt);
  await updateSettings({ pinSalt: salt, pinHash, pinIsDefault: true });
}
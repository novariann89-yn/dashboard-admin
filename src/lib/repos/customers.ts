import { getDb } from "../db";
import { newId } from "../id";
import { normalizeName, normalizePhone, searchCustomers } from "../search";
import type { Customer, BuyerType } from "../types";
import { listVariantsWithProduct } from "./products";

export async function createCustomer(input: {
  name: string;
  phone: string;
}): Promise<Customer> {
  const db = getDb();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const phoneNormal = normalizePhone(phone);

  if (!name) throw new Error("Nama wajib diisi");
  if (!phoneNormal) throw new Error("Nomor HP tidak valid");

  const duplicate = await db.customers
    .where("phoneNormal")
    .equals(phoneNormal)
    .first();

  if (duplicate) {
    throw new Error(`${duplicate.name} sudah terdaftar dengan nomor ini`);
  }

  const customer: Customer = {
    id: newId(),
    name,
    nameNormal: normalizeName(name),
    phoneNormal,
    active: true,
  };

  await db.customers.add(customer);
  return customer;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "phoneNormal" | "active">>,
): Promise<void> {
  const db = getDb();
  const current = await db.customers.get(id);
  if (!current) return;

  const next: Partial<Customer> = { ...patch };

  if (patch.name !== undefined) {
    next.name = patch.name.trim();
    next.nameNormal = normalizeName(patch.name);
  }

  if (patch.phoneNormal !== undefined) {
    const phoneNormal = normalizePhone(patch.phoneNormal);
    if (!phoneNormal) throw new Error("Nomor HP tidak valid");
    next.phoneNormal = phoneNormal;
  }

  await db.customers.update(id, next);
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return getDb().customers.get(id);
}

export async function listCustomers(type?: BuyerType): Promise<Customer[]> {
  const db = getDb();
  const rows = await db.customers.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchCustomerRows(
  query: string,
  limit = 5,
): Promise<Customer[]> {
  const rows = await listCustomers();
  return searchCustomers(query, rows, limit).map((entry) => entry.customer);
}

export interface CustomerStats {
  transactionCount: number;
  totalSpend: number;
  totalBottles: number;
  bottlesByVariant: { variantId: string; productName: string; sizeName: string; qty: number }[];
  lastTransactionAt: number | null;
}

export async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  const db = getDb();
  const transactions = (
    await db.transactions.where("customerId").equals(customerId).toArray()
  ).filter((transaction) => !transaction.cancelled);

  const transactionIds = new Set(transactions.map((transaction) => transaction.id));
  const allItems = await db.transactionItems.toArray();
  const items = allItems.filter((item) => transactionIds.has(item.transactionId));
  const variants = await listVariantsWithProduct(false);
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  const byVariant = new Map<string, number>();
  for (const item of items) {
    byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.qty);
  }

  const totalSpend = transactions.reduce(
    (sum, transaction) => sum + transaction.finalTotal,
    0,
  );
  const totalBottles = items.reduce((sum, item) => sum + item.qty, 0);
  const lastTransactionAt =
    transactions.length > 0
      ? Math.max(...transactions.map((transaction) => transaction.occurredAt))
      : null;

  const bottlesByVariant = Array.from(byVariant.entries()).map(([variantId, qty]) => {
    const variant = variantById.get(variantId);
    return {
      variantId,
      productName: variant?.productName ?? "?",
      sizeName: variant?.sizeName ?? "?",
      qty,
    };
  });

  return {
    transactionCount: transactions.length,
    totalSpend,
    totalBottles,
    bottlesByVariant,
    lastTransactionAt,
  };
}
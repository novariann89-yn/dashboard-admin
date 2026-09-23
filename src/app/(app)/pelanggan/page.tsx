"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatDate, rupiah } from "@/lib/format";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
} from "@/lib/repos/customers";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { formatPhone, searchCustomers } from "@/lib/search";
import { useDebouncedValue } from "@/lib/use-debounced";
import type { BuyerType, Customer, Transaction } from "@/lib/types";

export default function PelangganPage() {
  const toast = useToast();
  const customers = useLiveQuery(() => listCustomers(), [], []);
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);

  const [tab, setTab] = useState<BuyerType>("member");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 150);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const statsByCustomer = useMemo(() => {
    const map = new Map<
      string,
      { bottles: number; spend: number; count: number; last: number | null }
    >();
    const activeTransactions = transactions.filter(
      (transaction) => !transaction.cancelled,
    );
    const transactionById = new Map(
      activeTransactions.map((transaction) => [transaction.id, transaction]),
    );

    for (const transaction of activeTransactions) {
      if (!transaction.customerId) continue;
      const stats = map.get(transaction.customerId) ?? {
        bottles: 0,
        spend: 0,
        count: 0,
        last: null,
      };
      stats.spend += transaction.finalTotal;
      stats.count += 1;
      stats.last = Math.max(stats.last ?? 0, transaction.occurredAt);
      map.set(transaction.customerId, stats);
    }

    for (const item of items) {
      const transaction = transactionById.get(item.transactionId);
      if (!transaction?.customerId) continue;
      const stats = map.get(transaction.customerId);
      if (stats) stats.bottles += item.qty;
    }

    return map;
  }, [transactions, items]);

  const rows = useMemo(() => {
    const candidates = customers.filter((customer) => customer.active);
    if (!debouncedQuery.trim()) return candidates;
    return searchCustomers(debouncedQuery, candidates, 50).map(
      (entry) => entry.customer,
    );
  }, [customers, debouncedQuery]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  async function handleAdd() {
    try {
      const created = await createCustomer({
        name: newName,
        phone: newPhone,
      });
      setNewName("");
      setNewPhone("");
      setShowAdd(false);
      setSelectedId(created.id);
      toast(`${created.name} terdaftar`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mendaftar", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Pelanggan</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["member", "umum"] as BuyerType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setTab(type);
              setSelectedId(null);
              setQuery("");
            }}
            className={`rounded-control border-2 py-2 text-sm font-bold ${
              tab === type
                ? "border-ink bg-soy"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            {type === "member" ? "Member" : "Umum"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama / nomor HP"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className={buttonClass}
        >
          + Baru
        </button>
      </div>

      {showAdd && (
        <section className={cardClass}>
          <h2 className={sectionLabelClass}>
            Daftar {tab === "member" ? "Member" : "Umum"} Baru
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nama"
              className={inputClass}
            />
            <input
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              className={inputClass}
            />
            <button type="button" onClick={handleAdd} className={buttonClass}>
              Simpan
            </button>
          </div>
        </section>
      )}

      <section className={cardClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Belum ada {tab === "member" ? "member" : "umum"}.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((customer) => {
              const stats = statsByCustomer.get(customer.id);
              return (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selectedId === customer.id ? null : customer.id)
                    }
                    className="flex w-full items-center justify-between gap-2 py-3 text-left"
                  >
                    <span className="text-sm">
                      <span className="font-bold">{customer.name}</span>
                      {!customer.active && (
                        <span className="ml-1 text-xs text-ink-soft">
                          (nonaktif)
                        </span>
                      )}
                      <span className="block text-xs tabular-nums text-ink-soft">
                        {formatPhone(customer.phoneNormal)}
                      </span>
                    </span>
                    <span className="text-right text-xs text-ink-soft">
                      <span className={badgeClass}>
                        {stats?.bottles ?? 0} botol
                      </span>
                      <span className="mt-1 block tabular-nums">
                        {rupiah(stats?.spend ?? 0)} · {stats?.count ?? 0}x
                      </span>
                    </span>
                  </button>

                  {selected?.id === customer.id && (
                    <CustomerDetail
                      customer={customer}
                      transactions={transactions}
                      items={items}
                      variants={variants}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

type ItemRow = {
  transactionId: string;
  variantId: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
};

function CustomerDetail({
  customer,
  transactions,
  items,
  variants,
}: {
  customer: Customer;
  transactions: Transaction[];
  items: ItemRow[];
  variants: { id: string; productName: string; sizeName: string; sellPrice: number }[];
}) {
  const toast = useToast();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phoneNormal);
  const [active, setActive] = useState(customer.active);

  const own = transactions.filter(
    (transaction) =>
      transaction.customerId === customer.id && !transaction.cancelled,
  );
  const ownIds = new Set(own.map((transaction) => transaction.id));
  const ownItems = items.filter((item) => ownIds.has(item.transactionId));

  const byVariant = new Map<string, number>();
  for (const item of ownItems) {
    byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.qty);
  }
  const totalBottles = ownItems.reduce((sum, item) => sum + item.qty, 0);
  const totalSpend = own.reduce((sum, transaction) => sum + transaction.finalTotal, 0);
  const totalProfit = ownItems.reduce(
    (sum, item) => sum + (item.unitPrice - item.unitCost) * item.qty,
    0,
  );

  async function handleSave() {
    try {
      await updateCustomer(customer.id, {
        name,
        phoneNormal: phone,
        active,
      });
      toast("Pelanggan disimpan");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    }
  }

  return (
    <div className="mb-3 rounded-card border-2 border-line bg-canvas p-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Botol
          </p>
          <p className="text-lg font-extrabold tabular-nums">{totalBottles}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Belanja
          </p>
          <p className="text-lg font-extrabold tabular-nums">{rupiah(totalSpend)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Laba
          </p>
          <p className="text-lg font-extrabold tabular-nums">
            {rupiah(totalProfit)}
          </p>
        </div>
      </div>

      {byVariant.size > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {Array.from(byVariant.entries()).map(([variantId, qty]) => {
            const variant = variants.find((item) => item.id === variantId);
            return (
              <li key={variantId} className="text-xs text-ink-soft">
                {variant ? `${variant.productName} ${variant.sizeName}` : "?"}:{" "}
                <span className="font-bold tabular-nums">{qty} botol</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          className={inputClass}
        />
        <label className="flex items-center gap-3 rounded-control border-2 border-line bg-white p-2.5 text-sm font-bold">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-5 w-5 accent-soy-dark"
          />
          Pelanggan aktif
        </label>
        <button type="button" onClick={handleSave} className={buttonClass}>
          Simpan perubahan
        </button>
      </div>
    </div>
  );
}
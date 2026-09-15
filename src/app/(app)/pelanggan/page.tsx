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
  statusVoidClass,
} from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatDate, rupiah } from "@/lib/format";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
} from "@/lib/repos/customers";
import { listVariantsWithProduct } from "@/lib/repos/products";
import { recordReturn } from "@/lib/repos/returns";
import { recordPayment } from "@/lib/repos/transactions";
import { formatPhone, searchCustomers } from "@/lib/search";
import type { Customer, CustomerType, Transaction } from "@/lib/types";

export default function PelangganPage() {
  const toast = useToast();
  const customers = useLiveQuery(() => listCustomers(), [], []);
  const transactions = useLiveQuery(() => getDb().transactions.toArray(), [], []);
  const items = useLiveQuery(() => getDb().transactionItems.toArray(), [], []);
  const variants = useLiveQuery(() => listVariantsWithProduct(false), [], []);

  const [tab, setTab] = useState<CustomerType>("member");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");

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
    const candidates = customers.filter((customer) => customer.type === tab);
    if (!query.trim()) return candidates;
    return searchCustomers(query, candidates, 50).map((entry) => entry.customer);
  }, [customers, tab, query]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  async function handleAdd() {
    try {
      const created = await createCustomer({
        type: tab,
        name: newName,
        phone: newPhone,
        note: newNote || null,
      });
      setNewName("");
      setNewPhone("");
      setNewNote("");
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
        <Link href="/piutang" className="text-xs font-bold text-ink-soft underline">
          Piutang →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["member", "reseller"] as CustomerType[]).map((type) => (
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
            {type === "member" ? "Member" : "Reseller"}
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
            Daftar {tab === "member" ? "Member" : "Reseller"} Baru
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
            <input
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="Catatan (opsional)"
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
            Belum ada {tab === "member" ? "member" : "reseller"}.
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
                        {formatPhone(customer.phone)}
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
  const [phone, setPhone] = useState(customer.phone);
  const [note, setNote] = useState(customer.note ?? "");
  const [active, setActive] = useState(customer.active);
  const [suggestedPrice, setSuggestedPrice] = useState(
    customer.suggestedPrice ?? 0,
  );

  const [returnVariantId, setReturnVariantId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnSellable, setReturnSellable] = useState(true);
  const [returnRefund, setReturnRefund] = useState("");
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

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

  const receivables = own.filter(
    (transaction) => transaction.paymentStatus !== "paid",
  );

  async function handleSave() {
    try {
      await updateCustomer(customer.id, {
        name,
        phone,
        note: note || null,
        active,
        suggestedPrice: suggestedPrice > 0 ? suggestedPrice : null,
      });
      toast("Pelanggan disimpan");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    }
  }

  async function handleReturn() {
    if (!returnVariantId || !returnQty) {
      toast("Pilih produk dan isi jumlah", "error");
      return;
    }
    const variant = variants.find((item) => item.id === returnVariantId);
    const lastPrice =
      [...ownItems]
        .reverse()
        .find((item) => item.variantId === returnVariantId && item.unitPrice > 0)
        ?.unitPrice ?? variant?.sellPrice ?? 0;
    const refund =
      returnRefund === ""
        ? lastPrice * (Number(returnQty) || 0)
        : Number(returnRefund) || 0;

    try {
      await recordReturn({
        customerId: customer.id,
        variantId: returnVariantId,
        qty: Number(returnQty),
        sellable: returnSellable,
        refundValue: refund,
      });
      setReturnQty("");
      setReturnRefund("");
      toast("Retur dicatat");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mencatat", "error");
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

      <p className="mt-1 text-xs text-ink-soft">
        Bergabung {formatDate(customer.joinedAt)} · {own.length} transaksi
      </p>

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

      {receivables.length > 0 && (
        <div className="mt-3 rounded-control border-2 border-brick/40 bg-brick/5 p-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brick">
            Piutang
          </p>
          {receivables.map((transaction) => (
            <div key={transaction.id} className="mt-1 flex items-center gap-2">
              <span className="flex-1 text-xs tabular-nums">
                {formatDate(transaction.occurredAt)} ·{" "}
                <span className="font-bold">
                  {rupiah(transaction.finalTotal - transaction.paidAmount)}
                </span>
              </span>
              <input
                value={payAmounts[transaction.id] ?? ""}
                onChange={(event) =>
                  setPayAmounts((current) => ({
                    ...current,
                    [transaction.id]: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="penuh"
                className="w-20 rounded border border-line bg-white px-2 py-1 text-right text-xs font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={async () => {
                  const remaining = transaction.finalTotal - transaction.paidAmount;
                  const raw = payAmounts[transaction.id];
                  await recordPayment(
                    transaction.id,
                    raw === undefined || raw === "" ? remaining : Number(raw),
                  );
                  toast("Pembayaran dicatat");
                  setPayAmounts((current) => ({
                    ...current,
                    [transaction.id]: "",
                  }));
                }}
                className="rounded-control border-2 border-ink bg-soy px-2 py-1 text-[11px] font-bold"
              >
                Terima
              </button>
            </div>
          ))}
        </div>
      )}

      {customer.type === "reseller" && (
        <div className="mt-3 rounded-control border border-line bg-white p-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Catat retur
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <select
              value={returnVariantId}
              onChange={(event) => {
                setReturnVariantId(event.target.value);
                setReturnRefund("");
              }}
              className={`${inputClass} text-xs`}
            >
              <option value="">Pilih produk</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.productName} {variant.sizeName}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={returnQty}
                onChange={(event) => setReturnQty(event.target.value)}
                inputMode="numeric"
                placeholder="Jumlah"
                className={`${inputClass} text-right text-xs tabular-nums`}
              />
              <input
                value={returnRefund}
                onChange={(event) => setReturnRefund(event.target.value)}
                inputMode="numeric"
                placeholder="Nilai retur (otomatis)"
                className={`${inputClass} text-right text-xs tabular-nums`}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={returnSellable}
                onChange={(event) => setReturnSellable(event.target.checked)}
                className="h-4 w-4 accent-soy-dark"
              />
              Masih layak jual (stok bertambah)
            </label>
            <button
              type="button"
              onClick={handleReturn}
              className="rounded-control border-2 border-ink bg-soy py-1.5 text-xs font-bold"
            >
              Simpan retur
            </button>
          </div>
        </div>
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
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Catatan"
          className={inputClass}
        />
        {customer.type === "reseller" && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Harga jual anjuran (HJA)
            </span>
            <input
              value={suggestedPrice || ""}
              onChange={(event) => setSuggestedPrice(Number(event.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${inputClass} text-right tabular-nums`}
            />
          </label>
        )}
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
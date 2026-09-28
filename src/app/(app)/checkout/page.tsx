"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { IconReceipt } from "@/components/icons";
import { useToast } from "@/components/toast";
import { cardClass, inputClass } from "@/components/ui";
import { getDb } from "@/lib/db";
import { listCustomers } from "@/lib/repos/customers";
import { searchCustomers } from "@/lib/search";
import { rupiah } from "@/lib/format";
import { createTransaction, getTransactionItems } from "@/lib/repos/transactions";
import type { TransactionItem } from "@/lib/types";
import { buildReceiptText, whatsappUrl } from "@/lib/receipt";
import { useCart } from "@/components/cart-context";
import { useDebouncedValue } from "@/lib/use-debounced";

export default function CheckoutPage() {
  const toast = useToast();
  const { items, clearCart, subtotal, totalItems, setIsOpen } = useCart();
  const customers = useLiveQuery(() => listCustomers(), [], []);

  const [buyerType, setBuyerType] = useState<"umum" | "member">("umum");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [lastTransactionItems, setLastTransactionItems] = useState<TransactionItem[]>([]);

  const debouncedQuery = useDebouncedValue(searchQuery, 150);

  const filteredCustomers = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchCustomers(debouncedQuery, customers, 10).map((entry) => entry.customer);
  }, [customers, debouncedQuery]);

  const changeAmount = useMemo(() => {
    const received = parseInt(receivedAmount.replace(/\D/g, "")) || 0;
    return Math.max(0, received - subtotal);
  }, [receivedAmount, subtotal]);

  const quickAmounts = useMemo(() => [subtotal, 20000, 50000, 100000], [subtotal]);

  if (items.length === 0 && !showReceipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-ink-soft">
        <span className="text-6xl mb-4">🛒</span>
        <h2 className="text-xl font-extrabold mb-2">Keranjang Kosong</h2>
        <p className="mb-6 text-ink-soft">Tambah produk di Beranda untuk memulai belanja</p>
        <Link href="/" className="rounded-control bg-primary text-white px-6 py-3 font-extrabold shadow-card">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  async function handleCheckout() {
    if (items.length === 0) return;

    const transactionItems = items.map((item) => ({
      variantId: item.variantId,
      qty: item.qty,
    }));

    try {
      const result = await createTransaction({
        buyerType,
        customerId: selectedCustomer,
        items: transactionItems,
        paymentMethod: "cash",
        note: "",
      });

      const savedItems = await getTransactionItems(result.transaction.id);
      clearCart();
      setIsOpen(false);
      setLastTransaction(result.transaction);
      setLastTransactionItems(savedItems);
      setShowReceipt(true);
      toast("Transaksi berhasil disimpan!");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan transaksi", "error");
    }
  }

  async function handleWhatsapp() {
    if (!lastTransaction) return;
    const transaction = lastTransaction;
    const transactionItems = await getDb().transactionItems.where("transactionId").equals(transaction.id).toArray();
    let phone = "";
    if (transaction.customerId) {
      const customer = customers.find((c) => c.id === transaction.customerId);
      phone = customer?.phoneNormal ?? "";
    }
    if (!phone) {
      phone = window.prompt("Nomor HP tujuan (08xxx)") ?? "";
      if (!phone.trim()) return;
    }
    window.open(whatsappUrl(phone, buildReceiptText(transaction, transactionItems)), "_blank");
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-extrabold text-ink">Checkout</h1>
          <Link href="/" className="text-ink-soft" onClick={() => setIsOpen(false)}>
            <span className="text-2xl">×</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        <section className={cardClass}>
          <h2 className="text-sm font-bold text-ink-soft mb-3">Keranjang ({totalItems} item)</h2>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center gap-3 p-2 bg-surface rounded-card border border-line">
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink truncate">{item.productName} {item.sizeName}</p>
                  <p className="text-xs text-ink-soft">{rupiah(item.unitPrice)} × {item.qty}</p>
                </div>
                <span className="font-bold text-primary tabular-nums">{rupiah(item.unitPrice * item.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-line flex justify-between font-bold text-lg">
            <span>Subtotal</span>
            <span className="text-primary">{rupiah(subtotal)}</span>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-bold text-ink-soft mb-3">Pembeli</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => { setBuyerType("umum"); setSelectedCustomer(null); }}
              className={`rounded-control border-2 py-2 font-bold ${buyerType === "umum" ? "bg-primary text-white" : "border-line bg-surface text-ink"}`}
            >
              Umum
            </button>
            <button
              type="button"
              onClick={() => setBuyerType("member")}
              className={`rounded-control border-2 py-2 font-bold ${buyerType === "member" ? "bg-primary text-white" : "border-line bg-surface text-ink"}`}
            >
              Member
            </button>
          </div>

          {buyerType === "member" && (
            <div className="flex flex-col gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama / nomor HP"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1.5">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedCustomer(selectedCustomer === customer.id ? null : customer.id)}
                    className={`rounded-control border-2 px-2 py-1.5 text-xs font-bold ${
                      selectedCustomer === customer.id
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-surface text-ink"
                    }`}
                  >
                    {customer.name}
                  </button>
                ))}
              </div>
              {selectedCustomer && (
                <p className="text-xs text-primary font-bold">
                  Terpilih: {customers.find((c) => c.id === selectedCustomer)?.name}
                </p>
              )}
              {!selectedCustomer && filteredCustomers.length === 0 && searchQuery && (
                <p className="text-xs text-ink-soft">Tidak ditemukan. <span className="underline">Tambah member baru di halaman Pelanggan</span>.</p>
              )}
            </div>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-bold text-ink-soft mb-3">Pembayaran</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Total Bayar</label>
              <div className="text-2xl font-extrabold text-primary tabular-nums">{rupiah(subtotal)}</div>
            </div>
            <div>
              <label htmlFor="received" className="block text-sm font-bold text-ink-soft mb-1">Uang Diterima</label>
              <input
                id="received"
                type="tel"
                inputMode="numeric"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                placeholder="Contoh: 50.000"
                className={`${inputClass} text-right text-xl font-bold tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Kembalian</label>
              <div className="text-2xl font-extrabold text-success tabular-nums">{rupiah(changeAmount)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setReceivedAmount(amt.toLocaleString("id-ID"))}
                  className="flex-1 min-w-[80px] rounded-control border-2 py-2 text-sm font-bold border-line bg-surface text-ink"
                >
                  {rupiah(amt)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={parseInt(receivedAmount.replace(/\D/g, "")) < subtotal}
          className="w-full rounded-control bg-primary py-3.5 font-extrabold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.99] disabled:opacity-40"
        >
          Bayar & Simpan Transaksi
        </button>
      </main>

      {showReceipt && lastTransaction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-card max-w-md w-full max-h-[80vh] overflow-y-auto p-4 shadow-elevated animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-ink">Struk Transaksi</h2>
              <button onClick={() => setShowReceipt(false)} className="p-2 rounded-control text-ink-soft hover:text-ink">
                <span className="text-2xl">×</span>
              </button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-ink">{buildReceiptText(lastTransaction, lastTransactionItems)}</pre>
            <div className="mt-4 flex gap-2">
              <button onClick={handleWhatsapp} className="flex-1 rounded-control bg-green-600 text-white py-2 font-bold">
                <IconReceipt className="inline h-4 w-4 mr-1" />
                Kirim WA
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 rounded-control border-2 border-line text-ink py-2 font-bold">
                Selesai
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
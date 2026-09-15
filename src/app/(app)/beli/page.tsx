"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconMinus, IconX } from "@/components/icons";
import { useToast } from "@/components/toast";
import { cardClass, inputClass, sectionLabelClass } from "@/components/ui";
import { computeDiscount } from "@/lib/discounts";
import { changeDue, computeTotals } from "@/lib/pricing";
import { rupiah } from "@/lib/format";
import { resolveResellerPrice } from "@/lib/reseller";
import { createCustomer, getCustomer, listCustomers } from "@/lib/repos/customers";
import { listResellerLevels, listDiscountRules } from "@/lib/repos/discounts";
import { listVariantsWithProduct } from "@/lib/repos/products";
import {
  createTransaction,
  listRecentTransactions,
} from "@/lib/repos/transactions";
import { searchCustomers } from "@/lib/search";
import { getSettings } from "@/lib/settings";
import type { BuyerType, Customer, PaymentMethod } from "@/lib/types";

const buyerOptions: { value: BuyerType; label: string }[] = [
  { value: "umum", label: "Umum" },
  { value: "member", label: "Member" },
  { value: "reseller", label: "Reseller" },
];

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer" },
];

const quickAmounts = [20000, 50000, 100000];

export default function BeliPage() {
  const toast = useToast();

  const variants = useLiveQuery(() => listVariantsWithProduct(true), [], []);
  const customers = useLiveQuery(() => listCustomers(), [], []);
  const settings = useLiveQuery(() => getSettings(), [], null);
  const levels = useLiveQuery(() => listResellerLevels(), [], []);
  const rules = useLiveQuery(() => listDiscountRules(), [], []);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyerType, setBuyerType] = useState<BuyerType>("umum");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidInput, setPaidInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [keypadVariantId, setKeypadVariantId] = useState<string | null>(null);
  const [keypadQty, setKeypadQty] = useState("");
  const [recentVersion, setRecentVersion] = useState(0);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);

  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const transactions = await listRecentTransactions(20);
      const ids: string[] = [];
      for (const transaction of transactions) {
        if (transaction.customerId && !ids.includes(transaction.customerId)) {
          ids.push(transaction.customerId);
        }
      }
      const list: Customer[] = [];
      for (const id of ids.slice(0, 3)) {
        const found = await getCustomer(id);
        if (found) list.push(found);
      }
      if (!cancelled) setRecentCustomers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [recentVersion]);

  const totalBottles = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const pricedLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .flatMap(([variantId, qty]) => {
        const variant = variants.find((item) => item.id === variantId);
        if (!variant) return [];

        let unitPrice = variant.sellPrice;
        let levelName: string | null = null;

        if (buyerType === "reseller") {
          const tier = resolveResellerPrice({
            totalBottles,
            moq: settings?.resellerMoq ?? 24,
            levels: levels.map((level) => ({
              id: level.id,
              name: level.name,
              minBottles: level.minBottles,
              active: level.active,
              prices: level.prices,
            })),
            lockedLevelId: customer?.resellerLevelId ?? null,
            variantId,
            fallbackPrice: variant.resellerPrice,
          });
          if (tier.eligible) {
            unitPrice = tier.price;
            levelName = tier.levelName;
          }
        }

        return [
          {
            variantId,
            qty,
            unitPrice,
            levelName,
            productId: variant.productId,
            category: variant.category,
            costPrice: variant.costPrice,
            name: `${variant.productName} ${variant.sizeName}`,
            subtotal: unitPrice * qty,
          },
        ];
      });
  }, [cart, variants, buyerType, totalBottles, settings, levels, customer]);

  const subtotal = pricedLines.reduce((sum, line) => sum + line.subtotal, 0);

  const discount = useMemo(
    () =>
      computeDiscount({
        buyerType,
        lines: pricedLines.map((line) => ({
          variantId: line.variantId,
          productId: line.productId,
          category: line.category,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
        rules,
        variantSellPrices: Object.fromEntries(
          variants.map((variant) => [variant.id, variant.sellPrice]),
        ),
      }),
    [pricedLines, rules, variants, buyerType],
  );

  const totals = computeTotals({
    subtotal,
    discountTotal: discount.discountTotal,
    roundingEnabled: settings?.roundingEnabled ?? true,
    roundingStep: settings?.roundingStep ?? 500,
  });

  const bonusLines = discount.bonusItems.flatMap((bonus) => {
    const variant = variants.find((item) => item.id === bonus.variantId);
    if (!variant) return [];
    return [
      {
        variantId: bonus.variantId,
        qty: bonus.qty,
        costPrice: variant.costPrice,
        name: `${variant.productName} ${variant.sizeName}`,
      },
    ];
  });

  const totalCost =
    pricedLines.reduce((sum, line) => sum + line.costPrice * line.qty, 0) +
    bonusLines.reduce((sum, line) => sum + line.costPrice * line.qty, 0);
  const marginWarning =
    totals.finalTotal < Math.round(totalCost * 1.1) && totalCost > 0;

  const paid = paidInput === "" ? totals.finalTotal : Number(paidInput) || 0;
  const change = changeDue(totals.finalTotal, paid);

  const resellerLevelName = pricedLines.find((line) => line.levelName)?.levelName ?? null;
  const moq = settings?.resellerMoq ?? 24;
  const resellerBelowMoq =
    buyerType === "reseller" &&
    !customer?.resellerLevelId &&
    totalBottles > 0 &&
    totalBottles < moq;

  const results = useMemo(() => {
    if (buyerType === "umum" || !query.trim()) return [];
    const candidates = customers.filter(
      (item) => item.type === buyerType && item.active,
    );
    return searchCustomers(query, candidates, 5).map((entry) => entry.customer);
  }, [query, customers, buyerType]);

  function addToCart(variantId: string, delta: number) {
    setCart((current) => ({
      ...current,
      [variantId]: Math.max(0, (current[variantId] ?? 0) + delta),
    }));
  }

  function startPress(variantId: string) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setKeypadVariantId(variantId);
      setKeypadQty("");
    }, 450);
  }

  function endPress(variantId: string) {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!longPressed.current) addToCart(variantId, 1);
  }

  function cancelPress() {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function changeBuyerType(type: BuyerType) {
    setBuyerType(type);
    setCustomer(null);
    setQuery("");
    setShowAddForm(false);
  }

  async function handleAddCustomer() {
    try {
      const created = await createCustomer({
        type: buyerType === "reseller" ? "reseller" : "member",
        name: newName,
        phone: newPhone,
      });
      setCustomer(created);
      setNewName("");
      setNewPhone("");
      setShowAddForm(false);
      toast(`${created.name} terdaftar`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal mendaftar", "error");
    }
  }

  function applyKeypad() {
    const qty = Math.floor(Number(keypadQty));
    if (keypadVariantId && Number.isFinite(qty) && qty >= 0) {
      setCart((current) => ({ ...current, [keypadVariantId]: qty }));
    }
    setKeypadVariantId(null);
    setKeypadQty("");
  }

  async function handleSave() {
    if (pricedLines.length === 0) {
      toast("Keranjang masih kosong", "error");
      return;
    }

    if (
      marginWarning &&
      !window.confirm(
        `Margin di bawah 10% (modal ${rupiah(totalCost)}). Lanjutkan transaksi?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const result = await createTransaction({
        buyerType,
        customerId: customer?.id ?? null,
        items: pricedLines.map((line) => ({
          variantId: line.variantId,
          qty: line.qty,
        })),
        paymentMethod,
        paidAmount: paid,
      });

      const changeText =
        paymentMethod === "cash" && change > 0
          ? ` Kembali ${rupiah(change)}.`
          : "";
      toast(`Tersimpan ${rupiah(result.transaction.finalTotal)}.${changeText}`);

      setCart({});
      setCustomer(null);
      setQuery("");
      setPaidInput("");
      setBuyerType("umum");
      setPaymentMethod("cash");
      setShowAddForm(false);
      setRecentVersion((version) => version + 1);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }

  const keypadVariant = variants.find((variant) => variant.id === keypadVariantId);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className={sectionLabelClass}>Produk</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {variants.map((variant) => {
            const price =
              buyerType === "reseller" ? variant.resellerPrice : variant.sellPrice;
            const stockClass =
              variant.stock <= 0
                ? "border-brick/50 bg-brick/5"
                : variant.stock <= 20
                  ? "border-soy-dark/50 bg-cream"
                  : "border-ink bg-surface";
            return (
              <button
                key={variant.id}
                type="button"
                onPointerDown={() => startPress(variant.id)}
                onPointerUp={() => endPress(variant.id)}
                onPointerLeave={cancelPress}
                onContextMenu={(event) => event.preventDefault()}
                className={`select-none rounded-control border-2 p-2 text-left transition active:translate-y-[1px] ${stockClass}`}
              >
                <span className="block text-[11px] font-bold leading-tight">
                  {variant.productName}
                </span>
                <span className="block text-[10px] leading-tight text-ink-soft">
                  {variant.sizeName}
                </span>
                <span className="mt-1 block text-sm font-extrabold tabular-nums">
                  {rupiah(price)}
                </span>
                <span className="mt-1 block text-[10px] font-bold tabular-nums text-ink-soft">
                  Stok {variant.stock}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">
          Ketuk untuk tambah. Tekan lama untuk isi jumlah banyak.
        </p>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Keranjang</h2>
        {pricedLines.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada barang.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {pricedLines.map((line) => (
              <li
                key={line.variantId}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <span className="text-sm">
                  <span className="font-bold">{line.name}</span>
                  <span className="block text-xs tabular-nums text-ink-soft">
                    {rupiah(line.unitPrice)} × {line.qty}
                    {line.levelName ? ` · ${line.levelName}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tabular-nums">
                    {rupiah(line.subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => addToCart(line.variantId, -1)}
                    aria-label={`Kurangi ${line.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-control border-2 border-ink bg-surface active:translate-y-[1px]"
                  >
                    <IconMinus className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {bonusLines.length > 0 && (
          <div className="mt-3 rounded-control border-2 border-soy-dark/50 bg-cream p-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-soy-dark">
              Bonus
            </p>
            {bonusLines.map((line) => (
              <p key={line.variantId} className="text-sm font-bold">
                {line.qty} {line.name} gratis
              </p>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t-2 border-dashed border-ink/30 pt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Subtotal
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            {rupiah(subtotal)}
          </span>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Pembeli</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {buyerOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeBuyerType(option.value)}
              className={`rounded-control border-2 py-2 text-xs font-bold ${
                buyerType === option.value
                  ? "border-ink bg-soy"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {resellerLevelName && (
          <p className="mt-2 rounded-control border-2 border-pandan/40 bg-pandan/10 p-2 text-xs font-bold text-pandan">
            Harga grosir aktif: {resellerLevelName}
          </p>
        )}
        {resellerBelowMoq && (
          <p className="mt-2 rounded-control border-2 border-soy-dark/40 bg-cream p-2 text-xs font-bold text-soy-dark">
            Minimal {moq} botol untuk harga reseller (sekarang {totalBottles}).
          </p>
        )}
        {customer?.type === "reseller" && customer.suggestedPrice ? (
          <p className="mt-2 text-xs font-bold text-ink-soft">
            HJA: {rupiah(customer.suggestedPrice)}
          </p>
        ) : null}

        {customer && (
          <div className="mt-3 flex items-center justify-between rounded-control border-2 border-ink bg-cream p-2.5">
            <span className="text-sm font-bold">{customer.name}</span>
            <button
              type="button"
              onClick={() => setCustomer(null)}
              aria-label="Hapus pelanggan"
              className="flex h-7 w-7 items-center justify-center rounded-control border-2 border-ink bg-surface"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {buyerType !== "umum" && !customer && (
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                buyerType === "member"
                  ? "Cari member (nama / nomor)"
                  : "Cari reseller (nama / nomor)"
              }
              inputMode="text"
              className={inputClass}
            />

            {recentCustomers.filter((item) => item.type === buyerType).length > 0 &&
              !query.trim() && (
                <div className="flex flex-wrap gap-2">
                  {recentCustomers
                    .filter((item) => item.type === buyerType)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCustomer(item)}
                        className="rounded-control border border-line bg-canvas px-2 py-1 text-xs font-semibold"
                      >
                        {item.name}
                      </button>
                    ))}
                </div>
              )}

            {query.trim() && (
              <ul className="flex flex-col gap-1">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer(item);
                        setQuery("");
                      }}
                      className="flex w-full items-center justify-between rounded-control border-2 border-line bg-white px-3 py-2 text-left text-sm"
                    >
                      <span className="font-bold">{item.name}</span>
                      <span className="text-xs tabular-nums text-ink-soft">
                        ·{item.phoneNormal.slice(-4)}
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="text-xs text-ink-soft">Tidak ditemukan.</li>
                )}
              </ul>
            )}

            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="rounded-control border-2 border-dashed border-ink/40 py-2 text-xs font-bold text-ink-soft"
              >
                + Daftar {buyerType === "member" ? "Member" : "Reseller"} Baru
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-control border-2 border-line bg-white p-3">
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    className="flex-1 rounded-control border-2 border-ink bg-soy py-2 text-xs font-bold"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-control border-2 border-line px-3 text-xs font-bold text-ink-soft"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={cardClass}>
        {discount.ruleName && (
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-pandan">
              {discount.ruleName}
            </span>
            <span className="font-bold tabular-nums text-pandan">
              −{rupiah(discount.discountTotal)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Pembulatan
          </span>
          <span className="text-sm font-bold tabular-nums">
            {totals.roundingAdjust === 0
              ? "-"
              : `${totals.roundingAdjust > 0 ? "+" : ""}${rupiah(totals.roundingAdjust)}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t-2 border-ink pt-3">
          <span className="text-sm font-extrabold uppercase tracking-wider">
            Total
          </span>
          <span className="text-2xl font-extrabold tabular-nums">
            {rupiah(totals.finalTotal)}
          </span>
        </div>
        {marginWarning && (
          <p className="mt-2 rounded-control border-2 border-brick/40 bg-brick/10 p-2 text-xs font-bold text-brick">
            Margin di bawah 10% (modal {rupiah(totalCost)}).
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Bayar</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {methodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPaymentMethod(option.value)}
              className={`rounded-control border-2 py-2 text-xs font-bold ${
                paymentMethod === option.value
                  ? "border-ink bg-soy"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Uang diterima
            </span>
            <input
              value={paidInput}
              onChange={(event) => setPaidInput(event.target.value)}
              placeholder={`Pas ${rupiah(totals.finalTotal)}`}
              inputMode="numeric"
              className={`${inputClass} text-right text-lg font-bold tabular-nums`}
            />
          </label>
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => setPaidInput("")}
              className="rounded-control border-2 border-line py-1.5 text-[11px] font-bold text-ink-soft"
            >
              Pas
            </button>
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setPaidInput(String(amount))}
                className="rounded-control border-2 border-line py-1.5 text-[11px] font-bold text-ink-soft"
              >
                {amount / 1000}rb
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPaidInput("0")}
              className="rounded-control border-2 border-line py-1.5 text-[11px] font-bold text-brick"
            >
              Tempo
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t-2 border-dashed border-ink/30 pt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Kembalian
          </span>
          <span className="text-lg font-extrabold tabular-nums text-pandan">
            {rupiah(change)}
          </span>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || pricedLines.length === 0}
        className="rounded-card border-2 border-ink bg-soy py-4 text-base font-extrabold shadow-hard transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
      >
        {saving ? "Menyimpan..." : "SIMPAN TRANSAKSI"}
      </button>

      {keypadVariant && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4">
          <div className="w-full max-w-md rounded-card border-2 border-ink bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">
                  {keypadVariant.productName} {keypadVariant.sizeName}
                </p>
                <p className="text-xs text-ink-soft">Isi jumlah lalu simpan</p>
              </div>
              <button
                type="button"
                onClick={() => setKeypadVariantId(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-control border-2 border-ink bg-surface"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                autoFocus
                value={keypadQty}
                onChange={(event) => setKeypadQty(event.target.value)}
                inputMode="numeric"
                placeholder="0"
                className={`${inputClass} text-right text-xl font-extrabold tabular-nums`}
              />
              <button
                type="button"
                onClick={applyKeypad}
                className="rounded-control border-2 border-ink bg-soy px-4 text-sm font-extrabold"
              >
                Set
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[10, 24, 48, 100].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setKeypadQty(String(amount))}
                  className="rounded-control border-2 border-line py-2 text-xs font-bold text-ink-soft"
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
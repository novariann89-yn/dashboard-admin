"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  statusActiveClass,
} from "@/components/ui";
import { computeDiscount } from "@/lib/discounts";
import { rupiah } from "@/lib/format";
import {
  createDiscountRule,
  listDiscountRules,
  updateDiscountRule,
} from "@/lib/repos/discounts";
import { listProducts, listVariants } from "@/lib/repos/products";
import type {
  BuyerType,
  DiscountConditionType,
  DiscountEffectType,
  DiscountRule,
} from "@/lib/types";

interface RuleForm {
  name: string;
  appliesTo: BuyerType;
  targetType: "all" | "product" | "variant" | "category";
  targetId: string;
  conditionType: DiscountConditionType;
  conditionValue: string;
  effectType: DiscountEffectType;
  effectValue: string;
  bonusVariantId: string;
  bonusQty: string;
  priority: string;
}

const EMPTY_FORM: RuleForm = {
  name: "",
  appliesTo: "member",
  targetType: "all",
  targetId: "",
  conditionType: "none",
  conditionValue: "",
  effectType: "percent",
  effectValue: "",
  bonusVariantId: "",
  bonusQty: "1",
  priority: "10",
};

export function DiscountRulesSection() {
  const toast = useToast();
  const rules = useLiveQuery(() => listDiscountRules(), [], []);
  const products = useLiveQuery(() => listProducts(), [], []);
  const variants = useLiveQuery(() => listVariants(true), [], []);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const variantNames = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant.id,
          `${variant.sizeName}`,
        ]),
      ),
    [variants],
  );

  function set<K extends keyof RuleForm>(key: K, value: RuleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast("Nama aturan wajib diisi", "error");
      return;
    }
    if (form.effectType === "bonus_product" && !form.bonusVariantId) {
      toast("Pilih produk bonus", "error");
      return;
    }
    try {
      await createDiscountRule({
        name: form.name.trim(),
        appliesTo: form.appliesTo,
        targetType: form.targetType,
        targetId:
          form.targetType === "all" ? null : form.targetId || null,
        conditionType: form.conditionType,
        conditionValue: Number(form.conditionValue) || 0,
        effectType: form.effectType,
        effectValue: Number(form.effectValue) || 0,
        bonusVariantId:
          form.effectType === "bonus_product" ? form.bonusVariantId : null,
        bonusQty:
          form.effectType === "bonus_product" ? Number(form.bonusQty) || 1 : 0,
        priority: Number(form.priority) || 10,
        startsAt: null,
        endsAt: null,
        active: true,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast("Aturan dibuat");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    }
  }

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between">
        <h2 className={sectionLabelClass}>Aturan diskon</h2>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="text-xs font-bold text-ink-soft underline"
        >
          {showForm ? "Tutup" : "+ Aturan"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Sistem menghitung semua aturan yang cocok lalu memakai yang paling
        menguntungkan pembeli (tidak menumpuk). Nama aturan tampil di kasir.
      </p>

      {showForm && (
        <div className="mt-3 flex flex-col gap-2 rounded-control border-2 border-dashed border-ink/30 p-3">
          <input
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Nama aturan (mis. Diskon Member 10%)"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Berlaku untuk
              </span>
              <select
                value={form.appliesTo}
                onChange={(event) =>
                  set("appliesTo", event.target.value as BuyerType)
                }
                className={inputClass}
              >
                <option value="umum">Umum</option>
                <option value="member">Member</option>
                <option value="reseller">Reseller</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Target
              </span>
              <select
                value={form.targetType}
                onChange={(event) =>
                  set(
                    "targetType",
                    event.target.value as RuleForm["targetType"],
                  )
                }
                className={inputClass}
              >
                <option value="all">Semua produk</option>
                <option value="product">Produk tertentu</option>
                <option value="variant">Varian tertentu</option>
                <option value="category">Kategori</option>
              </select>
            </label>
          </div>

          {form.targetType === "product" && (
            <select
              value={form.targetId}
              onChange={(event) => set("targetId", event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          )}

          {form.targetType === "variant" && (
            <select
              value={form.targetId}
              onChange={(event) => set("targetId", event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih varian</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sizeName}
                </option>
              ))}
            </select>
          )}

          {form.targetType === "category" && (
            <input
              value={form.targetId}
              onChange={(event) => set("targetId", event.target.value)}
              placeholder="Nama kategori"
              className={inputClass}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Syarat
              </span>
              <select
                value={form.conditionType}
                onChange={(event) =>
                  set(
                    "conditionType",
                    event.target.value as DiscountConditionType,
                  )
                }
                className={inputClass}
              >
                <option value="none">Tanpa syarat</option>
                <option value="min_bottles">Min botol</option>
                <option value="min_amount">Min rupiah</option>
                <option value="multiple_bottles">Kelipatan botol</option>
              </select>
            </label>
            {form.conditionType !== "none" && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Nilai syarat
                </span>
                <input
                  value={form.conditionValue}
                  onChange={(event) => set("conditionValue", event.target.value)}
                  inputMode="numeric"
                  className={`${inputClass} text-right tabular-nums`}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Efek
              </span>
              <select
                value={form.effectType}
                onChange={(event) =>
                  set("effectType", event.target.value as DiscountEffectType)
                }
                className={inputClass}
              >
                <option value="percent">Diskon persen (%)</option>
                <option value="amount">Potongan rupiah</option>
                <option value="special_price">Harga khusus</option>
                <option value="bonus_product">Bonus produk</option>
              </select>
            </label>
            {form.effectType !== "bonus_product" ? (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {form.effectType === "percent"
                    ? "Persen (%)"
                    : "Nilai (Rp)"}
                </span>
                <input
                  value={form.effectValue}
                  onChange={(event) => set("effectValue", event.target.value)}
                  inputMode="numeric"
                  className={`${inputClass} text-right tabular-nums`}
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Qty bonus
                </span>
                <input
                  value={form.bonusQty}
                  onChange={(event) => set("bonusQty", event.target.value)}
                  inputMode="numeric"
                  className={`${inputClass} text-right tabular-nums`}
                />
              </label>
            )}
          </div>

          {form.effectType === "bonus_product" && (
            <select
              value={form.bonusVariantId}
              onChange={(event) => set("bonusVariantId", event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih produk bonus</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sizeName}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Prioritas (tie-break)
            </span>
            <input
              value={form.priority}
              onChange={(event) => set("priority", event.target.value)}
              inputMode="numeric"
              className="w-20 rounded-control border-2 border-line bg-white px-2 py-1.5 text-right text-sm tabular-nums"
            />
          </label>

          <button type="button" onClick={save} className={buttonClass}>
            Simpan aturan
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {rules.length === 0 && (
          <p className="text-xs text-ink-soft">Belum ada aturan diskon.</p>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-start justify-between gap-2 rounded-control border border-line bg-white p-2.5"
          >
            <div className="text-xs">
              <p className="font-bold">{rule.name}</p>
              <p className="text-[11px] text-ink-soft">
                {ruleSummary(rule, productNames, variantNames)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={rule.active ? statusActiveClass : badgeClass}>
                {rule.active ? "aktif" : "nonaktif"}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await updateDiscountRule(rule.id, { active: !rule.active });
                  toast("Aturan diperbarui");
                }}
                className="text-[10px] font-bold text-ink-soft underline"
              >
                {rule.active ? "Matikan" : "Nyalakan"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Simulator
        rules={rules}
        variants={variants.map((variant) => ({
          id: variant.id,
          productId: variant.productId,
          category: "",
          label: variant.sizeName,
          sellPrice: variant.sellPrice,
          costPrice: variant.costPrice,
        }))}
      />
    </section>
  );
}

function ruleSummary(
  rule: DiscountRule,
  productNames: Map<string, string>,
  variantNames: Map<string, string>,
): string {
  const who =
    rule.appliesTo === "umum"
      ? "Umum"
      : rule.appliesTo === "member"
        ? "Member"
        : "Reseller";

  const target =
    rule.targetType === "all"
      ? "semua produk"
      : rule.targetType === "product"
        ? (productNames.get(rule.targetId ?? "") ?? "produk")
        : rule.targetType === "variant"
          ? (variantNames.get(rule.targetId ?? "") ?? "varian")
          : `kategori ${rule.targetId ?? ""}`;

  const condition =
    rule.conditionType === "min_bottles"
      ? `min ${rule.conditionValue} botol`
      : rule.conditionType === "min_amount"
        ? `min ${rupiah(rule.conditionValue)}`
        : rule.conditionType === "multiple_bottles"
          ? `tiap ${rule.conditionValue} botol`
          : "";

  const effect =
    rule.effectType === "percent"
      ? `diskon ${rule.effectValue}%`
      : rule.effectType === "amount"
        ? `potong ${rupiah(rule.effectValue)}`
        : rule.effectType === "special_price"
          ? `harga jadi ${rupiah(rule.effectValue)}`
          : `bonus ${rule.bonusQty} produk`;

  return [who, target, condition, effect].filter(Boolean).join(" · ");
}

interface SimVariant {
  id: string;
  productId: string;
  category: string;
  label: string;
  sellPrice: number;
  costPrice: number;
}

function Simulator({
  rules,
  variants,
}: {
  rules: DiscountRule[];
  variants: SimVariant[];
}) {
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [buyer, setBuyer] = useState<BuyerType>("member");

  const variant = variants.find((item) => item.id === variantId);
  const quantity = Math.max(1, Number(qty) || 1);

  const result = useMemo(() => {
    if (!variant) return null;
    const outcome = computeDiscount({
      buyerType: buyer,
      lines: [
        {
          variantId: variant.id,
          productId: variant.productId,
          category: variant.category,
          qty: quantity,
          unitPrice: variant.sellPrice,
        },
      ],
      rules,
      variantSellPrices: Object.fromEntries(
        variants.map((item) => [item.id, item.sellPrice]),
      ),
    });
    const subtotal = variant.sellPrice * quantity;
    const bonusCost = outcome.bonusItems.reduce((sum, bonus) => {
      const bonusVariant = variants.find((item) => item.id === bonus.variantId);
      return sum + (bonusVariant?.costPrice ?? 0) * bonus.qty;
    }, 0);
    const finalTotal = subtotal - outcome.discountTotal;
    const totalCost = variant.costPrice * quantity + bonusCost;
    return {
      outcome,
      subtotal,
      finalTotal,
      marginWarning: finalTotal < Math.round(totalCost * 1.1),
    };
  }, [variant, quantity, buyer, rules, variants]);

  return (
    <div className="mt-4 rounded-control border-2 border-line bg-canvas p-3">
      <h3 className={sectionLabelClass}>Simulator diskon</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <select
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
          className={`${inputClass} col-span-2 text-xs`}
        >
          <option value="">Pilih varian</option>
          {variants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          inputMode="numeric"
          className={`${inputClass} text-right text-xs tabular-nums`}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {(["umum", "member", "reseller"] as BuyerType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setBuyer(type)}
            className={`rounded-control border-2 py-1.5 text-[11px] font-bold ${
              buyer === type
                ? "border-ink bg-soy"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            {type === "umum" ? "Umum" : type === "member" ? "Member" : "Reseller"}
          </button>
        ))}
      </div>

      {result && variant && (
        <div className="mt-3 rounded-control border border-line bg-white p-2.5 text-xs">
          <p className="flex justify-between">
            <span>Harga normal</span>
            <span className="font-bold tabular-nums">
              {rupiah(result.subtotal)}
            </span>
          </p>
          <p className="mt-1 flex justify-between">
            <span>Aturan menang</span>
            <span className="font-bold text-pandan">
              {result.outcome.ruleName ?? "tidak ada"}
            </span>
          </p>
          <p className="mt-1 flex justify-between">
            <span>Diskon</span>
            <span className="font-bold tabular-nums text-pandan">
              −{rupiah(result.outcome.discountTotal)}
            </span>
          </p>
          {result.outcome.bonusItems.length > 0 && (
            <p className="mt-1 flex justify-between">
              <span>Bonus</span>
              <span className="font-bold">
                {result.outcome.bonusItems
                  .map((bonus) => {
                    const bonusVariant = variants.find(
                      (item) => item.id === bonus.variantId,
                    );
                    return `${bonus.qty} ${bonusVariant?.label ?? ""}`;
                  })
                  .join(", ")}
              </span>
            </p>
          )}
          <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
            <span className="font-bold">Total bayar</span>
            <span className="font-extrabold tabular-nums">
              {rupiah(result.finalTotal)}
            </span>
          </p>
          {result.marginWarning && (
            <p className="mt-1 text-[11px] font-bold text-brick">
              Margin di bawah 10%.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
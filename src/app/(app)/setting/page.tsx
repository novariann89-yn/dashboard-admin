"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type FormEvent } from "react";
import { IconDownload } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
  secondaryButtonClass,
  statusActiveClass,
} from "@/components/ui";
import { listAudit } from "@/lib/repos/audit";
import { downloadBackup, importBackup } from "@/lib/backup";
import { DiscountRulesSection } from "@/components/discount-rules";
import { ResellerSection } from "@/components/reseller-levels";
import { marginPercent } from "@/lib/pricing";
import { formatDateTime } from "@/lib/format";
import { hashPin, isValidPin, randomSalt, verifyPin } from "@/lib/pin";
import {
  createProduct,
  createVariant,
  listProducts,
  listVariants,
  updateProduct,
  updateVariant,
} from "@/lib/repos/products";
import { getSettings, updateSettings } from "@/lib/settings";
import type { Product, ProductVariant } from "@/lib/types";

export default function SettingPage() {
  const toast = useToast();
  const products = useLiveQuery(() => listProducts(), [], []);
  const variants = useLiveQuery(() => listVariants(false), [], []);
  const settings = useLiveQuery(() => getSettings(), [], null);

  const [showProductForm, setShowProductForm] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-extrabold tracking-tight">Setting</h1>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className={sectionLabelClass}>Produk & Varian</h2>
          <button
            type="button"
            onClick={() => setShowProductForm((value) => !value)}
            className="text-xs font-bold text-ink-soft underline"
          >
            {showProductForm ? "Tutup" : "+ Produk"}
          </button>
        </div>

        {showProductForm && <AddProductForm onDone={() => setShowProductForm(false)} />}

        <div className="mt-3 flex flex-col gap-4">
          {products.length === 0 && (
            <p className="text-sm text-ink-soft">Belum ada produk.</p>
          )}
          {products.map((product) => (
            <ProductBlock
              key={product.id}
              product={product}
              variants={variants.filter((variant) => variant.productId === product.id)}
            />
          ))}
        </div>
      </section>

      <RoundingSection
        enabled={settings?.roundingEnabled ?? true}
        step={settings?.roundingStep ?? 500}
        loaded={settings !== null}
      />

      <ResellerSection />

      <DiscountRulesSection />

      <AuditSection />

      <PinSection />

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Backup data</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Data hanya tersimpan di HP ini. Unduh backup secara berkala, dan
          simpan filenya di tempat aman (Google Drive / komputer). Kalau PIN
          lupa: hapus data situs di browser, buka aplikasi, lalu pulihkan dari
          backup (PIN akan diatur ulang).
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              await downloadBackup();
              toast("Backup diunduh");
            }}
            className={secondaryButtonClass}
          >
            <IconDownload className="h-4 w-4" />
            Unduh backup (.json)
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-control border-2 border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink">
            Pulihkan dari backup
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const text = await file.text();
                if (
                  !window.confirm(
                    "Ganti SEMUA data di HP ini dengan isi file backup?",
                  )
                ) {
                  return;
                }
                try {
                  await importBackup(text);
                  toast("Data dipulihkan. Atur PIN baru...");
                  setTimeout(() => window.location.reload(), 800);
                } catch (error) {
                  toast(
                    error instanceof Error ? error.message : "Gagal memulihkan",
                    "error",
                  );
                }
              }}
            />
          </label>
        </div>
        {settings && settings.lastBackupAt > 0 && (
          <p className="mt-2 text-[11px] text-ink-soft">
            Backup terakhir:{" "}
            {new Date(settings.lastBackupAt).toLocaleDateString("id-ID")}
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className={sectionLabelClass}>Tentang</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Dashboard Admin v0.5.0 (Fase 4). Semua data tersimpan lokal di HP
          (offline). PIN hanya mengunci tampilan aplikasi. Instal offline penuh
          perlu HTTPS (lihat DEPLOY.md).
        </p>
      </section>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  cancel_transaction: "Batalkan transaksi",
  attach_customer: "Tempel member",
  price_change: "Ubah harga / modal",
  stock_opening: "Stok awal",
  stock_addition: "Tambah stok",
  stock_damage: "Catat produk rusak",
  create_expense: "Pengeluaran baru",
  delete_expense: "Hapus pengeluaran",
  record_payment: "Terima pembayaran",
};

function AuditSection() {
  const entries = useLiveQuery(() => listAudit(30), [], []);

  return (
    <details className={cardClass}>
      <summary className="cursor-pointer text-sm font-extrabold">
        Riwayat aktivitas ({entries.length})
      </summary>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Belum ada aktivitas tercatat.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="py-2 text-xs">
              <span className="font-bold">
                {AUDIT_LABELS[entry.action] ?? entry.action}
              </span>
              <span className="block tabular-nums text-ink-soft">
                {formatDateTime(entry.at)} · {entry.table}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function AddProductForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await createProduct({ name, category: category || "Umum" });
    setName("");
    setCategory("");
    toast("Produk ditambah");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nama produk (mis. Sari Kedelai)"
        className={inputClass}
      />
      <input
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        placeholder="Kategori (opsional)"
        className={inputClass}
      />
      <button className={buttonClass}>Tambah produk</button>
    </form>
  );
}

function ProductBlock({
  product,
  variants,
}: {
  product: Product;
  variants: ProductVariant[];
}) {
  const toast = useToast();
  const [showVariantForm, setShowVariantForm] = useState(false);

  return (
    <div className="rounded-control border-2 border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold">{product.name}</p>
          <p className="text-[11px] text-ink-soft">{product.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={product.active ? statusActiveClass : badgeClass}>
            {product.active ? "aktif" : "nonaktif"}
          </span>
          <button
            type="button"
            onClick={async () => {
              await updateProduct(product.id, { active: !product.active });
              toast("Produk diperbarui");
            }}
            className="text-[11px] font-bold text-ink-soft underline"
          >
            {product.active ? "Nonaktifkan" : "Aktifkan"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {variants.map((variant) => (
          <VariantEditor key={variant.id} variant={variant} />
        ))}
      </div>

      {showVariantForm ? (
        <AddVariantForm
          productId={product.id}
          onDone={() => setShowVariantForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowVariantForm(true)}
          className="mt-2 w-full rounded-control border-2 border-dashed border-ink/40 py-2 text-xs font-bold text-ink-soft"
        >
          + Varian ukuran
        </button>
      )}
    </div>
  );
}

function AddVariantForm({
  productId,
  onDone,
}: {
  productId: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [sizeName, setSizeName] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [resellerPrice, setResellerPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sizeName.trim()) return;
    await createVariant({
      productId,
      sizeName,
      sellPrice,
      resellerPrice,
      costPrice,
    });
    toast("Varian ditambah");
    onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex flex-col gap-2 rounded-control border-2 border-dashed border-ink/30 p-2"
    >
      <input
        value={sizeName}
        onChange={(event) => setSizeName(event.target.value)}
        placeholder="Nama ukuran (mis. Botol Kecil 250ml)"
        className={inputClass}
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Harga jual" value={sellPrice} onChange={setSellPrice} />
        <NumberField
          label="Harga reseller"
          value={resellerPrice}
          onChange={setResellerPrice}
        />
        <NumberField label="Modal" value={costPrice} onChange={setCostPrice} />
      </div>
      <button className={buttonClass}>Tambah varian</button>
    </form>
  );
}

function VariantEditor({ variant }: { variant: ProductVariant }) {
  const toast = useToast();
  const [sizeName, setSizeName] = useState(variant.sizeName);
  const [sellPrice, setSellPrice] = useState(variant.sellPrice);
  const [resellerPrice, setResellerPrice] = useState(variant.resellerPrice);
  const [costPrice, setCostPrice] = useState(variant.costPrice);

  const margin = marginPercent(sellPrice, costPrice);
  const marginWarning = costPrice <= 0 || (margin !== null && margin < 20);

  async function save() {
    await updateVariant(variant.id, {
      sizeName,
      sellPrice,
      resellerPrice,
      costPrice,
    });
    toast("Varian disimpan");
  }

  return (
    <div className="rounded-control border border-line bg-canvas p-2">
      <div className="flex items-center justify-between gap-2">
        <input
          value={sizeName}
          onChange={(event) => setSizeName(event.target.value)}
          className="w-full rounded-control border border-line bg-white px-2 py-1.5 text-xs font-bold"
        />
        <button
          type="button"
          onClick={async () => {
            await updateVariant(variant.id, { active: !variant.active });
            toast("Varian diperbarui");
          }}
          className="shrink-0 text-[11px] font-bold text-ink-soft underline"
        >
          {variant.active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumberField label="Jual" value={sellPrice} onChange={setSellPrice} small />
        <NumberField
          label="Reseller"
          value={resellerPrice}
          onChange={setResellerPrice}
          small
        />
        <NumberField label="Modal" value={costPrice} onChange={setCostPrice} small />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-[11px] font-bold tabular-nums ${
            marginWarning ? "text-brick" : "text-pandan"
          }`}
        >
          {costPrice <= 0
            ? "Modal belum diisi"
            : `Margin ${margin?.toFixed(0) ?? "-"}%${marginWarning ? " (rendah)" : ""}`}
        </span>
        <button
          type="button"
          onClick={save}
          className="rounded-control border-2 border-ink bg-soy px-3 py-1 text-[11px] font-bold"
        >
          Simpan varian
        </button>
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-ink-soft">
        Stok saat ini: {variant.stock}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  small = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  small?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span
        className={`font-bold uppercase tracking-wider text-ink-soft ${
          small ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </span>
      <input
        value={value || ""}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        inputMode="numeric"
        placeholder="0"
        className={`w-full rounded-control border-2 border-line bg-white px-2 py-1.5 text-right tabular-nums ${
          small ? "text-xs" : "text-sm"
        }`}
      />
    </label>
  );
}

function RoundingSection({
  enabled,
  step,
  loaded,
}: {
  enabled: boolean;
  step: number;
  loaded: boolean;
}) {
  const toast = useToast();
  const [roundingEnabled, setRoundingEnabled] = useState(enabled);
  const [roundingStep, setRoundingStep] = useState(step);

  useEffect(() => {
    if (!loaded) return;
    setRoundingEnabled(enabled);
    setRoundingStep(step);
  }, [loaded, enabled, step]);

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Pembulatan harga</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Total akhir dibulatkan ke atas/bawah terdekat supaya tidak ada uang
        receh.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-control border-2 border-line bg-white p-2.5 text-sm font-bold">
          <input
            type="checkbox"
            checked={roundingEnabled}
            onChange={(event) => setRoundingEnabled(event.target.checked)}
            className="h-5 w-5 accent-soy-dark"
          />
          Aktifkan pembulatan
        </label>
        <NumberField
          label="Pembulatan ke (Rp)"
          value={roundingStep}
          onChange={setRoundingStep}
        />
        <button
          type="button"
          onClick={async () => {
            await updateSettings({
              roundingEnabled,
              roundingStep: Math.max(1, roundingStep),
            });
            toast("Pembulatan disimpan");
          }}
          className={buttonClass}
        >
          Simpan pembulatan
        </button>
      </div>
    </section>
  );
}

function PinSection() {
  const toast = useToast();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const current = await getSettings();
    if (
      !current.pinHash ||
      !current.pinSalt ||
      !(await verifyPin(oldPin, current.pinSalt, current.pinHash))
    ) {
      toast("PIN lama salah", "error");
      return;
    }
    if (!isValidPin(newPin)) {
      toast("PIN baru harus 4 angka", "error");
      return;
    }
    if (newPin !== confirmPin) {
      toast("Ulangi PIN tidak sama", "error");
      return;
    }
    const salt = randomSalt();
    const hash = await hashPin(newPin, salt);
    await updateSettings({ pinSalt: salt, pinHash: hash, pinIsDefault: false });
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
    toast("PIN diganti");
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Ganti PIN</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <input
          value={oldPin}
          onChange={(event) => setOldPin(event.target.value)}
          placeholder="PIN lama"
          inputMode="numeric"
          maxLength={4}
          className={inputClass}
        />
        <input
          value={newPin}
          onChange={(event) => setNewPin(event.target.value)}
          placeholder="PIN baru (4 angka)"
          inputMode="numeric"
          maxLength={4}
          className={inputClass}
        />
        <input
          value={confirmPin}
          onChange={(event) => setConfirmPin(event.target.value)}
          placeholder="Ulangi PIN baru"
          inputMode="numeric"
          maxLength={4}
          className={inputClass}
        />
        <button className={buttonClass}>Simpan PIN</button>
      </form>
    </section>
  );
}
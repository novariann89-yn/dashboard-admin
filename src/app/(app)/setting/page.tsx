"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { IconDownload } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  badgeClass,
  buttonClass,
  cardClass,
  dangerButtonClass,
  inputClass,
  sectionLabelClass,
  secondaryButtonClass,
  statusActiveClass,
} from "@/components/ui";
import { listAudit } from "@/lib/repos/audit";
import { getDb } from "@/lib/db";
import {
  createExpensePreset,
  deleteExpensePreset,
  listExpensePresets,
  updateExpensePreset,
} from "@/lib/repos/expense-presets";
import { createUser, deleteUser, getSession, updateUser } from "@/lib/auth";
import { downloadBackup, importBackup } from "@/lib/backup";
import { marginPercent } from "@/lib/pricing";
import { formatDateTime } from "@/lib/format";
import { hashPin, isValidPin, randomSalt, verifyPin } from "@/lib/pin";
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  listProducts,
  listVariants,
  updateProduct,
  updateVariant,
} from "@/lib/repos/products";
import { getSettings, updateSettings, type ThemeMode } from "@/lib/settings";
import { applyTheme, readCachedTheme, syncThemeClass } from "@/lib/theme";
import { DELETE_HISTORY } from "@/lib/permissions";
import { resetData } from "@/lib/repos/reset";
import {
  DEFAULT_BACKGROUND,
  applyBackground,
  clampDim,
  clearBackground,
  compressImage,
  getBackground,
  setBackground,
} from "@/lib/background";
import type { Product, ProductVariant, User } from "@/lib/types";

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

      <StoreSection
        storeName={settings?.storeName ?? ""}
        loaded={settings !== null}
      />

      <AppNameSection
        appName={settings?.appName ?? "SuperSoy"}
        loaded={settings !== null}
      />

      <AppearanceSection
        theme={settings?.theme ?? "system"}
        loaded={settings !== null}
      />

      <RoundingSection
        enabled={settings?.roundingEnabled ?? true}
        step={settings?.roundingStep ?? 500}
        loaded={settings !== null}
      />

      <ExpensePresetSection />

      <AuditSection />

      <PinSection />

      <AccountsSection />

      <ResetSection />

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
          {settings?.appName ?? "SuperSoy"} v0.5.0 (Fase 4). Semua data tersimpan
          lokal di HP (offline). PIN hanya mengunci tampilan aplikasi. Instal
          offline penuh perlu HTTPS (lihat DEPLOY.md).
        </p>
      </section>
    </div>
  );
}

function StoreSection({
  storeName,
  loaded,
}: {
  storeName: string;
  loaded: boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState(storeName);

  useEffect(() => {
    if (!loaded) return;
    setName(storeName);
  }, [loaded, storeName]);

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Nama Toko</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Nama ini dipakai di struk WhatsApp.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) {
            toast("Nama toko wajib diisi", "error");
            return;
          }
          await updateSettings({ storeName: name.trim() });
          toast("Nama toko disimpan");
        }}
        className="mt-3 flex flex-col gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="mis. Toko Mas Andik"
          className={inputClass}
        />
        <button className={buttonClass}>Simpan nama toko</button>
      </form>
    </section>
  );
}

function AppNameSection({
  appName,
  loaded,
}: {
  appName: string;
  loaded: boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState(appName);

  useEffect(() => {
    if (!loaded) return;
    setName(appName);
  }, [loaded, appName]);

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Nama Aplikasi</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Nama yang tampil di header dan halaman login. Nama ikon saat dipasang di
        HP tetap SuperSoy.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) {
            toast("Nama aplikasi wajib diisi", "error");
            return;
          }
          await updateSettings({ appName: name.trim() });
          toast("Nama aplikasi disimpan");
        }}
        className="mt-3 flex flex-col gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="mis. SuperSoy"
          className={inputClass}
        />
        <button className={buttonClass}>Simpan nama aplikasi</button>
      </form>
    </section>
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
  delete_transactions: "Hapus riwayat",
  delete_customers: "Hapus pelanggan",
  delete_product: "Hapus produk",
  delete_variant: "Hapus varian",
  claim_reward: "Klaim hadiah",
  delete_claims: "Hapus riwayat klaim",
  reset_data: "Reset data",
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
  const [emoji, setEmoji] = useState("🥛");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await createProduct({ name, emoji: emoji || "🥛" });
    setName("");
    setEmoji("🥛");
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
        value={emoji}
        onChange={(event) => setEmoji(event.target.value)}
        placeholder="Emoji (mis. 🥛)"
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
  const [name, setName] = useState(product.name);
  const [emoji, setEmoji] = useState(product.emoji);

  return (
    <div className="rounded-control border-2 border-line bg-surface p-3">
      <div className="flex items-center gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nama produk"
          className="w-full rounded-control border border-line bg-surface px-2 py-1 text-sm font-extrabold"
        />
        <input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          className="w-11 shrink-0 rounded-control border border-line bg-surface px-1 py-1 text-center text-base"
        />
        <button
          type="button"
          onClick={async () => {
            if (!name.trim()) {
              toast("Nama produk wajib diisi", "error");
              return;
            }
            await updateProduct(product.id, {
              name: name.trim(),
              emoji: emoji || "🥛",
            });
            toast("Produk disimpan");
          }}
          className="shrink-0 text-[11px] font-bold text-ink-soft underline"
        >
          Simpan
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={async () => {
            if (
              !window.confirm(
                `Hapus produk "${product.name}" beserta ${variants.length} varian? Tindakan ini permanen.`,
              )
            )
              return;
            await deleteProduct(product.id);
            toast("Produk dihapus");
          }}
          className="text-[11px] font-bold text-error underline"
        >
          Hapus
        </button>
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
  const [costPrice, setCostPrice] = useState(0);
  const [netProfitPerUnit, setNetProfitPerUnit] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sizeName.trim()) return;
    await createVariant({
      productId,
      sizeName,
      sellPrice,
      costPrice,
      netProfitPerUnit,
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
        placeholder="Nama ukuran (mis. Kecil 250ml)"
        className={inputClass}
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Harga jual" value={sellPrice} onChange={setSellPrice} />
        <NumberField label="Modal" value={costPrice} onChange={setCostPrice} />
        <NumberField
          label="Profit/unit (0=auto)"
          value={netProfitPerUnit}
          onChange={setNetProfitPerUnit}
        />
      </div>
      <button className={buttonClass}>Tambah varian</button>
    </form>
  );
}

function VariantEditor({ variant }: { variant: ProductVariant }) {
  const toast = useToast();
  const [sizeName, setSizeName] = useState(variant.sizeName);
  const [sellPrice, setSellPrice] = useState(variant.sellPrice);
  const [costPrice, setCostPrice] = useState(variant.costPrice);
  const [netProfitPerUnit, setNetProfitPerUnit] = useState(
    variant.netProfitPerUnit,
  );

  const margin = marginPercent(sellPrice, costPrice);
  const marginWarning = costPrice <= 0 || (margin !== null && margin < 20);

  async function save() {
    await updateVariant(variant.id, {
      sizeName,
      sellPrice,
      costPrice,
      netProfitPerUnit,
    });
    toast("Varian disimpan");
  }

  return (
    <div className="rounded-control border border-line bg-canvas p-2">
      <div className="flex items-center justify-between gap-2">
        <input
          value={sizeName}
          onChange={(event) => setSizeName(event.target.value)}
          className="w-full rounded-control border border-line bg-surface px-2 py-1.5 text-xs font-bold"
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
        <button
          type="button"
          onClick={async () => {
            if (
              !window.confirm(
                `Hapus varian "${variant.sizeName}"? Tindakan ini permanen.`,
              )
            )
              return;
            await deleteVariant(variant.id);
            toast("Varian dihapus");
          }}
          className="shrink-0 text-[11px] font-bold text-error underline"
        >
          Hapus
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumberField label="Jual" value={sellPrice} onChange={setSellPrice} small />
        <NumberField label="Modal" value={costPrice} onChange={setCostPrice} small />
        <NumberField
          label="Profit (0=auto)"
          value={netProfitPerUnit}
          onChange={setNetProfitPerUnit}
          small
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-[11px] font-bold tabular-nums ${
            marginWarning ? "text-error" : "text-success"
          }`}
        >
          {costPrice <= 0
            ? "Modal belum diisi"
            : `Margin ${margin?.toFixed(0) ?? "-"}%${marginWarning ? " (rendah)" : ""}`}
        </span>
        <button
          type="button"
          onClick={save}
          className="rounded-control border-2 border-ink bg-primary px-3 py-1 text-[11px] font-bold text-white"
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
        className={`w-full rounded-control border-2 border-line bg-surface px-2 py-1.5 text-right tabular-nums ${
          small ? "text-xs" : "text-sm"
        }`}
      />
    </label>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Sistem" },
];

function AppearanceSection({
  theme,
  loaded,
}: {
  theme: ThemeMode;
  loaded: boolean;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<ThemeMode>(theme);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [bgPosition, setBgPosition] = useState(DEFAULT_BACKGROUND.position);
  const [bgDim, setBgDim] = useState(DEFAULT_BACKGROUND.dim);
  const [bgBusy, setBgBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setSelected(theme);
    syncThemeClass(theme);
  }, [loaded, theme]);

  useEffect(() => {
    setSelected(readCachedTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readCachedTheme() === "system") syncThemeClass("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    getBackground().then((config) => {
      setBgDataUrl(config.dataUrl);
      setBgPosition(config.position);
      setBgDim(config.dim);
    });
  }, []);

  async function choose(next: ThemeMode) {
    setSelected(next);
    applyTheme(next);
    await updateSettings({ theme: next });
    toast("Tampilan diperbarui");
  }

  async function handlePickImage(file: File) {
    setBgBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setBgDataUrl(dataUrl);
      toast("Gambar siap. Atur posisi lalu simpan.");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal memuat gambar",
        "error",
      );
    } finally {
      setBgBusy(false);
    }
  }

  async function handleSaveBackground() {
    if (!bgDataUrl) return;
    await setBackground(bgDataUrl, bgPosition, bgDim);
    applyBackground({ dataUrl: bgDataUrl, position: bgPosition, dim: bgDim });
    toast("Background disimpan");
  }

  async function handleClearBackground() {
    await clearBackground();
    applyBackground(DEFAULT_BACKGROUND);
    setBgDataUrl(null);
    setBgPosition(DEFAULT_BACKGROUND.position);
    setBgDim(DEFAULT_BACKGROUND.dim);
    toast("Background dihapus");
  }

  function handlePreviewPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    setBgPosition(
      `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`,
    );
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Tampilan</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Pilih mode warna. &quot;Sistem&quot; mengikuti pengaturan HP.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            className={`rounded-control border-2 py-2 text-sm font-bold transition ${
              selected === option.value
                ? "border-ink bg-primary text-white shadow-card"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
          Background
        </h3>
        <p className="mt-1 text-[11px] text-ink-soft">
          Ganti latar aplikasi dengan foto dari galeri. Warna kartu dan tema
          tetap sama.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className={`${secondaryButtonClass} cursor-pointer`}>
            {bgBusy ? "Memuat..." : bgDataUrl ? "Ganti gambar" : "Pilih gambar"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) handlePickImage(file);
              }}
            />
          </label>
          {bgDataUrl && (
            <button
              type="button"
              onClick={handleClearBackground}
              className="text-[11px] font-bold text-error underline"
            >
              Hapus background
            </button>
          )}
        </div>

        {bgDataUrl && (
          <div className="mt-3 flex flex-col gap-2">
            <div
              ref={previewRef}
              onPointerDown={handlePreviewPointer}
              onPointerMove={handlePreviewPointer}
              className="h-40 w-full cursor-move touch-none rounded-control border border-line"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,${clampDim(bgDim)}), rgba(0,0,0,${clampDim(bgDim)})), url("${bgDataUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: bgPosition,
                backgroundRepeat: "no-repeat",
              }}
            />
            <p className="text-[10px] text-ink-soft">
              Geser gambar untuk mengatur posisi.
            </p>
            <label className="flex items-center gap-3 text-xs font-bold text-ink-soft">
              Gelapkan
              <input
                type="range"
                min={0}
                max={70}
                value={Math.round(bgDim * 100)}
                onChange={(event) => setBgDim(Number(event.target.value) / 100)}
                className="flex-1 accent-primary"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveBackground}
              className={buttonClass}
            >
              Simpan background
            </button>
          </div>
        )}
      </div>
    </section>
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
        <label className="flex items-center gap-3 rounded-control border-2 border-line bg-surface p-2.5 text-sm font-bold">
          <input
            type="checkbox"
            checked={roundingEnabled}
            onChange={(event) => setRoundingEnabled(event.target.checked)}
            className="h-5 w-5 accent-primary"
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

function ExpensePresetSection() {
  const toast = useToast();
  const presets = useLiveQuery(() => listExpensePresets(false), [], []);
  const [name, setName] = useState("");

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast(success);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Kategori Pengeluaran</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Tombol cepat saat mencatat pengeluaran di halaman Dompet.
      </p>

      {presets.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Belum ada kategori.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-2 py-2">
              <input
                defaultValue={preset.name}
                onBlur={async (event) => {
                  const value = event.target.value.trim();
                  if (!value || value === preset.name) return;
                  await run(
                    () => updateExpensePreset(preset.id, { name: value }),
                    "Kategori diperbarui",
                  );
                }}
                className="w-full rounded-control border border-line bg-surface px-2 py-1.5 text-xs font-bold"
              />
              <button
                type="button"
                onClick={() =>
                  run(
                    () =>
                      updateExpensePreset(preset.id, {
                        active: !preset.active,
                      }),
                    "Kategori diperbarui",
                  )
                }
                className="shrink-0 text-[11px] font-bold text-ink-soft underline"
              >
                {preset.active ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Hapus kategori ${preset.name}?`)) return;
                  await run(
                    () => deleteExpensePreset(preset.id),
                    "Kategori dihapus",
                  );
                }}
                className="shrink-0 text-[11px] font-bold text-error underline"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          await run(async () => {
            await createExpensePreset(name);
            setName("");
          }, "Kategori ditambah");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Kategori baru"
          className={inputClass}
        />
        <button className={`${buttonClass} shrink-0`}>Tambah</button>
      </form>
    </section>
  );
}

const PERMISSION_OPTIONS = [
  { value: "beranda", label: "Beranda" },
  { value: "pelanggan", label: "Pelanggan" },
  { value: "stok", label: "Stok" },
  { value: "historis", label: "Histori" },
];

function ResetSection() {
  const toast = useToast();
  const txCount = useLiveQuery(() => getDb().transactions.count(), [], 0);
  const expenseCount = useLiveQuery(() => getDb().expenses.count(), [], 0);
  const auditCount = useLiveQuery(() => getDb().auditLog.count(), [], 0);
  const customerCount = useLiveQuery(() => getDb().customers.count(), [], 0);
  const claimCount = useLiveQuery(() => getDb().loyaltyClaims.count(), [], 0);

  const [scope, setScope] = useState({
    transactions: false,
    expenses: false,
    auditLog: false,
    customers: false,
    loyaltyClaims: false,
    resetStock: false,
  });
  const [busy, setBusy] = useState(false);

  const options: { key: keyof typeof scope; label: string; hint: string }[] = [
    { key: "transactions", label: "Transaksi & item", hint: `${txCount} transaksi` },
    { key: "expenses", label: "Pengeluaran", hint: `${expenseCount} catatan` },
    { key: "auditLog", label: "Riwayat aktivitas", hint: `${auditCount} entri` },
    { key: "customers", label: "Pelanggan", hint: `${customerCount} pelanggan` },
    { key: "loyaltyClaims", label: "Riwayat klaim", hint: `${claimCount} klaim` },
    { key: "resetStock", label: "Reset stok ke 0", hint: "semua varian" },
  ];
  const nothingSelected = !Object.values(scope).some(Boolean);

  async function handleReset() {
    if (nothingSelected) {
      toast("Pilih minimal satu data", "error");
      return;
    }
    const answer = window.prompt(
      "Ketik HAPUS untuk menghapus data terpilih secara permanen:",
    );
    if (answer !== "HAPUS") return;
    setBusy(true);
    try {
      await resetData(scope);
      setScope({
        transactions: false,
        expenses: false,
        auditLog: false,
        customers: false,
        loyaltyClaims: false,
        resetStock: false,
      });
      toast("Data terpilih dihapus");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menghapus", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Reset Data</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Hapus riwayat untuk mulai bersih. Produk, pengaturan, dan akun tetap
        aman. Tindakan ini permanen.
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {options.map((option) => (
          <li
            key={option.key}
            className="flex items-center justify-between gap-2 py-2"
          >
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={scope[option.key]}
                onChange={(event) =>
                  setScope((prev) => ({
                    ...prev,
                    [option.key]: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-error"
              />
              <span>
                <span className="font-bold">{option.label}</span>
                <span className="block text-[11px] text-ink-soft">
                  {option.hint}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={busy || nothingSelected}
          className={dangerButtonClass}
        >
          Hapus data terpilih
        </button>
        <button
          type="button"
          onClick={async () => {
            await downloadBackup();
            toast("Backup diunduh");
          }}
          className={secondaryButtonClass}
        >
          Unduh backup dulu
        </button>
      </div>
    </section>
  );
}

function AccountsSection() {
  const toast = useToast();
  const users = useLiveQuery(() => getDb().users.toArray(), [], []);
  const [isOwner, setIsOwner] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "admin">("admin");
  const [grantFor, setGrantFor] = useState<User | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startHold(user: User) {
    if (user.role !== "admin") return;
    holdTimer.current = setTimeout(() => setGrantFor(user), 600);
  }

  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function toggleDeleteHistory(user: User) {
    const has = user.permissions.includes(DELETE_HISTORY);
    const next = has
      ? user.permissions.filter((permission) => permission !== DELETE_HISTORY)
      : [...user.permissions, DELETE_HISTORY];
    run(
      () => updateUser(user.id, { permissions: next }),
      has ? "Akses hapus riwayat dicabut" : "Akses hapus riwayat diberikan",
    );
    setGrantFor(null);
  }

  useEffect(() => {
    const session = getSession();
    setIsOwner(session?.role === "owner");
    setCurrentId(session?.userId ?? null);
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast(success);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal menyimpan", "error");
    }
  }

  if (!isOwner) return null;

  const activeOwners = users.filter(
    (user) => user.role === "owner" && user.active,
  ).length;

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between">
        <h2 className={sectionLabelClass}>Akun Pengguna</h2>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="text-xs font-bold text-ink-soft underline"
        >
          {showForm ? "Tutup" : "+ Akun"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Owner bisa akses semua halaman. Admin hanya halaman yang dicentang.
        Minimal satu owner aktif harus tetap ada. Tahan nama admin untuk memberi
        akses hapus riwayat.
      </p>

      {showForm && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!username.trim() || !password.trim()) {
              toast("ID dan sandi wajib diisi", "error");
              return;
            }
            await run(async () => {
              await createUser({
                username: username.trim(),
                password,
                role,
              });
              setUsername("");
              setPassword("");
              setRole("admin");
              setShowForm(false);
            }, "Akun ditambah");
          }}
          className="mt-3 flex flex-col gap-2 rounded-control border-2 border-dashed border-ink/30 p-2"
        >
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ID (username)"
            className={inputClass}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sandi"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            {(["admin", "owner"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-control border-2 py-2 text-sm font-bold ${
                  role === option
                    ? "border-ink bg-primary text-white"
                    : "border-line bg-surface text-ink-soft"
                }`}
              >
                {option === "owner" ? "Owner" : "Admin"}
              </button>
            ))}
          </div>
          <button className={buttonClass}>Simpan akun</button>
        </form>
      )}

      <ul className="mt-3 flex flex-col divide-y divide-line">
        {users.map((user) => {
          const self = currentId === user.id;
          const lastOwner =
            user.role === "owner" && user.active && activeOwners <= 1;
          const demoteBlocked =
            user.role === "owner" && (self || activeOwners <= 1);
          const deactivateBlocked = user.active && (self || lastOwner);
          return (
            <li key={user.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm"
                  onPointerDown={() => startHold(user)}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className="select-none font-bold">
                    {user.username}
                    {self ? " (kamu)" : ""}
                  </span>
                  <span className="block text-[11px] text-ink-soft">
                    {user.role === "owner" ? "Owner" : "Admin"}
                    {user.active ? "" : " · nonaktif"}
                    {user.permissions.includes(DELETE_HISTORY)
                      ? " · bisa hapus riwayat"
                      : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={demoteBlocked}
                    onClick={() =>
                      run(
                        () =>
                          updateUser(user.id, {
                            role: user.role === "owner" ? "admin" : "owner",
                          }),
                        "Akun diperbarui",
                      )
                    }
                    className="text-[11px] font-bold text-ink-soft underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {user.role === "owner" ? "Jadikan admin" : "Jadikan owner"}
                  </button>
                  <button
                    type="button"
                    disabled={deactivateBlocked}
                    onClick={() =>
                      run(
                        () => updateUser(user.id, { active: !user.active }),
                        "Akun diperbarui",
                      )
                    }
                    className="text-[11px] font-bold text-ink-soft underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {user.active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  {!self && (
                    <button
                      type="button"
                      disabled={lastOwner}
                      onClick={async () => {
                        if (!window.confirm(`Hapus akun ${user.username}?`)) return;
                        await run(() => deleteUser(user.id), "Akun dihapus");
                      }}
                      className="text-[11px] font-bold text-error underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  )}
                </span>
              </div>

              {user.role === "admin" && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PERMISSION_OPTIONS.map((option) => {
                    const checked = user.permissions.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? user.permissions.filter((p) => p !== option.value)
                            : [...user.permissions, option.value];
                          run(
                            () => updateUser(user.id, { permissions: next }),
                            "Hak akses diperbarui",
                          );
                        }}
                        className={`rounded-control border-2 px-2 py-1 text-[11px] font-bold ${
                          checked
                            ? "border-ink bg-primary text-white"
                            : "border-line bg-surface text-ink-soft"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {grantFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setGrantFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-card border-2 border-ink bg-surface p-4 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-extrabold">{grantFor.username}</p>
            <p className="mt-1 text-xs text-ink-soft">
              Izinkan akun ini menghapus riwayat transaksi?
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleDeleteHistory(grantFor)}
                className={buttonClass}
              >
                {grantFor.permissions.includes(DELETE_HISTORY)
                  ? "Cabut akses hapus riwayat"
                  : "Beri akses hapus riwayat"}
              </button>
              <button
                type="button"
                onClick={() => setGrantFor(null)}
                className={secondaryButtonClass}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
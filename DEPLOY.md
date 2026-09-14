# Deploy: Vercel + Turso

Panduan langkah demi langkah untuk menaruh aplikasi ini online (diakses dari HP Mas Andik).

## Sementara: jalan di WiFi lokal (tanpa akun)
Kalau belum mau bikin akun Turso/Vercel, aplikasi bisa dijalankan dari komputer ini dan diakses HP yang tersambung ke WiFi yang sama:

1. `npm run build`
2. `npm run lan` — server jalan di port 3000 (cookie tidak Secure supaya bisa lewat http)
3. Cek IP komputer: `hostname -I` (pakai yang seperti 172.x / 192.168.x, bukan docker0)
4. Buka di HP: `http://<IP-komputer>:3000`
5. Kalau dari HP tidak bisa kebuka, izinkan port-nya: `sudo ufw allow 3000/tcp`

Catatan: komputer harus tetap menyala dan HP harus satu WiFi. Data tersimpan di `local.db` pada folder ini — tetap unduh backup CSV berkala dari Pengaturan. Ganti PIN default (1234) sebelum dipakai serius: `npm run hash-pin -- <pin-baru>` lalu update `ADMIN_PIN_HASH` di `.env.local` dan restart.

## Yang dibutuhkan
- Akun Turso Cloud (gratis) — https://turso.tech
- Akun Vercel (gratis) — https://vercel.com
- Akun GitHub (kalau deploy lewat import repo; opsional kalau pakai Vercel CLI)
- Node.js 20.9+ (di komputer ini sudah ada: Node 22)

## 1. Siapkan database Turso

Install Turso CLI (Linux):

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Login dan buat database. **Penting: jangan tambahkan flag `--tursodb`** — aplikasi ini memakai driver libSQL:

```bash
turso auth login
turso db create tokomas
```

Ambil URL dan buat token. Simpan keduanya:

```bash
turso db show tokomas --url
turso db tokens create tokomas
```

## 2. Migrasi dan isi data awal ke Turso

Jalankan dari folder project, dengan URL dan token dari langkah 1:

```bash
export DATABASE_URL="libsql://...hasil-db-show..."
export DATABASE_AUTH_TOKEN="...hasil-tokens-create..."
export SESSION_SECRET="$(openssl rand -hex 32)"

npx drizzle-kit migrate
npx tsx src/db/seed.ts
```

Cek hasilnya:

```bash
turso db shell tokomas "select name, price from products;"
turso db shell tokomas "select threshold, reward_product_id from bonus_rules;"
```

## 3. Siapkan PIN admin (hash)

Jangan simpan PIN sebagai teks biasa. Buat hash-nya:

```bash
npm run hash-pin -- 123456
```

Ganti `123456` dengan PIN pilihan. Simpan hasilnya (format `salt:hash`) untuk dipasang sebagai `ADMIN_PIN_HASH`.

## 4. Deploy ke Vercel

### Cara A — lewat GitHub (disarankan)
1. Buat repo kosong di https://github.com/new (jangan tambah README).
2. Dari folder project:

```bash
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

3. Di Vercel: **Add New > Project > Import Git Repository** → pilih repo.
4. Framework terdeteksi otomatis (Next.js). Build command biarkan default.
5. Tambahkan Environment Variables (Production **dan** Preview):

| Nama | Nilai |
| --- | --- |
| `DATABASE_URL` | `libsql://...` dari Turso |
| `DATABASE_AUTH_TOKEN` | token dari Turso |
| `SESSION_SECRET` | hasil `openssl rand -hex 32` |
| `ADMIN_PIN_HASH` | hasil `npm run hash-pin -- <pin>` |

6. Klik **Deploy**.

### Cara B — lewat Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add DATABASE_AUTH_TOKEN production
vercel env add SESSION_SECRET production
vercel env add ADMIN_PIN_HASH production
vercel --prod
```

Ulangi `vercel env add ... preview` juga kalau ingin preview deployment ikut jalan.

## 5. Setelah deploy (checklist)

- [ ] Buka URL Vercel → login dengan PIN.
- [ ] Pengaturan → cek harga produk (default: Botol Kecil Rp 5.000, Botol Besar Rp 10.000).
- [ ] Pengaturan → cek aturan bonus (default: 10x pembelian → 1 Botol Kecil).
- [ ] Catat satu pembelian uji coba, cek muncul di Beranda.
- [ ] Di HP: buka menu browser → **Tambahkan ke layar utama** (aplikasi jadi seperti app).
- [ ] Unduh CSV backup pertama dari Pengaturan.

## 6. Kalau skema database berubah nanti

```bash
# di komputer (lokal)
npm run db:generate

# apply ke Turso
export DATABASE_URL="libsql://..."
export DATABASE_AUTH_TOKEN="..."
npm run db:migrate

# commit + push, Vercel auto-deploy
git add -A && git commit -m "update skema" && git push
```

## Catatan penting
- `.env.local`, `local.db`, `node_modules`, dan `.next` sudah di-`.gitignore` — jangan pernah di-commit.
- Ganti PIN: hash ulang (`npm run hash-pin -- <pin-baru>`), update `ADMIN_PIN_HASH` di Vercel, lalu redeploy.
- Ganti `SESSION_SECRET` = semua sesi login lama otomatis logout (harus login ulang).
- Data lokal (`local.db`) dan data produksi (Turso) terpisah. Main-main di lokal tidak mempengaruhi data asli toko.
- Backup berkala: Pengaturan → Unduh data member / pembelian / bonus.

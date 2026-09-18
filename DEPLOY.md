# Menjalankan & Deploy — Dashboard Admin

## Arsitektur (v2 — offline-first)

- **Semua data tersimpan di HP** (IndexedDB via Dexie). Aplikasi jalan penuh tanpa internet di pasar.
- Build berupa **file statis** (folder `out/`) — tidak ada server database, tidak ada akun cloud wajib.
- Server di komputer hanya bertugas **menyajikan file statis** untuk update / cek di HP.
- Kunci aplikasi = PIN lokal (gate tampilan), diatur di Setting.
- Backup = file JSON dari Setting, disimpan manual (Google Drive / komputer).

## Deploy ke Vercel (produksi — direkomendasikan)

Kenapa: HTTPS gratis + auto-redeploy per `git push`. HTTPS mengaktifkan
service worker → **bisa diinstal offline** dan bisa diakses dari mana saja.

1. Pastikan kode terpush ke GitHub (repo `novariann89-yn/dashboard-admin` — sudah).
2. Buka https://vercel.com → sign up/login gratis (boleh pakai GitHub).
3. **Add New → Project** → Import repo `dashboard-admin`. Kalau GitHub belum
   tersambung: klik **Connect to GitHub** lalu authorize.
4. Framework terdeteksi Next.js. `vercel.json` sudah mengatur build/output
   (`out/`). Tidak perlu menambah environment variable.
5. Klik **Deploy**. Selesai dalam ~1 menit. Alamatnya:
   `https://<nama-project>.vercel.app`. Nama bisa diganti di Settings → Domains.
6. Di HP: buka URL itu saat online → menu browser → **Tambahkan ke layar
   utama** → aplikasi kini offline-first di HP tersebut.
7. Update berikutnya: cukup `git push`, Vercel redeploy otomatis. Di HP, buka
   sekali saat online supaya versi terbaru ter-cache.

> [!penting] Data per perangkat
> Data tetap di tiap HP (offline-first). Mengakses URL yang sama dari HP lain
> = mulai dengan data kosong, sampai Anda restore backup JSON dari HP yang lama.
> Alur pindah HP: Setting → Unduh backup (di HP lama) → buka HP baru →
> Setting → Pulihkan dari backup.

## Menjalankan di WiFi lokal (untuk update & cek)

```bash
npm run restart      # build ulang + serve di port 3000 + print alamat HP
npm run stop         # matikan server
npm run lan          # foreground (lihat log)
```

1. Buka alamat yang dicetak (`http://<IP-komputer>:3000`) di HP, satu WiFi.
2. Kalau tidak bisa dibuka: `sudo ufw allow 3000/tcp` (sekali saja).
3. Di HP: menu browser → **Tambahkan ke layar utama** (shortcut).

> [!penting] Data tidak hilang saat update
> Data ada di IndexedDB HP, bukan di folder build. `npm run restart` tidak menyentuh data.
> Tapi data terikat pada **alamat/origin**. Kalau IP komputer berubah, origin ikut berubah
> dan data lama tidak terlihat. Set **DHCP static lease** di router supaya IP tetap.
> Perubahan origin (contoh http → https) juga dianggap data baru.

## HTTPS lokal (LAN, tanpa akun)

Jalankan `npm run cert` untuk menghasilkan sertifikat lokal di `certs/`
(CA + server untuk IP saat ini). Setelah itu `npm run restart` otomatis serve
HTTPS. Di HP, install `certs/ca.crt` sekali saja: pindahkan file ke HP
(Bluetooth/kabel), lalu Pengaturan → Keamanan → Install certificate → CA.

Catatan: cert berisi IP saat ini. Jika IP berubah, jalankan `npm run cert` lagi.
`certs/ca.key` & `certs/server.key` tidak pernah di-commit (`.gitignore`).

## Update aplikasi

```bash
npm run restart      # setelah ubah kode
```

Di HP: tutup lalu buka lagi (atau tarik-refresh). Tidak perlu install ulang.

## Instal sebagai aplikasi offline (butuh HTTPS)

Service worker sudah terpasang (`public/sw.js`) dan otomatis aktif **hanya di secure
context** (HTTPS atau localhost). Kalau deploy pakai Vercel, ini otomatis terpenuhi.

Setelah HTTPS: buka sekali saat online supaya app-shell ter-cache, lalu aplikasi bisa
dibuka tanpa jaringan sama sekali (data sudah lokal). Perbarui aplikasi dengan membuka
sekali saat online (service worker memakai network-first untuk halaman).

## Reset / ganti perangkat

- HP baru: install, lalu **Pulihkan dari backup** (Setting → file JSON).
- Jangan hapus data browser untuk origin ini, kecuali sudah backup.

## Backup

- Otomatis diingatkan di Beranda kalau belum backup > 24 jam.
- Backup manual: Setting → "Unduh backup (.json)".
- Restore: Setting → "Pulihkan dari backup" (mengganti SEMUA data).

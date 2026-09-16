# Menjalankan & Deploy — Dashboard Admin

## Arsitektur (v2 — offline-first)

- **Semua data tersimpan di HP** (IndexedDB via Dexie). Aplikasi jalan penuh tanpa internet di pasar.
- Build berupa **file statis** (folder `out/`) — tidak ada server database, tidak ada akun cloud.
- Server di komputer hanya bertugas **menyajikan file statis** untuk update / cek di HP.
- Kunci aplikasi = PIN lokal (gate tampilan), diatur di Setting.
- Backup = file JSON dari Setting, disimpan manual (Google Drive / komputer).

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

## Update aplikasi

```bash
npm run restart      # setelah ubah kode
```

Di HP: tutup lalu buka lagi (atau tarik-refresh). Tidak perlu install ulang.

## Instal sebagai aplikasi offline (butuh HTTPS)

Service worker sudah terpasang (`public/sw.js`) dan otomatis aktif **hanya di secure
context** (HTTPS atau localhost). Di LAN `http://IP:3000` aplikasi tetap jalan normal,
tapi belum bisa diinstal offline. Pilihan agar bisa instal di HP:

1. **GitHub Pages** — gratis + HTTPS (repo harus publik). Deploy folder `out/`.
2. **Cloudflare Pages / Netlify** — akun gratis, HTTPS otomatis.
3. **HTTPS lokal dengan mkcert** — install CA di HP sekali, origin stabil.

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
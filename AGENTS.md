# AGENTS.md — Dashboard Admin (v2, offline-first)

Admin/POS dashboard for a bottled soy milk stall. **All data lives on the phone**
(IndexedDB via Dexie); the app is a static export (folder `out/`) and must run
fully offline at the market. UI is in Indonesian. A 4-digit local PIN gates the UI.

Remote: `git@github.com:novariann89-yn/dashboard-admin.git` (SSH auth as `novariann89-yn`).

## Commands

| Task | Command |
| --- | --- |
| Dev server (hot reload) | `npm run dev` (use `-- -p 3001` if the LAN server is running on 3000) |
| Tests | `npm test` (node:test + tsx, fake-indexeddb for Dexie tests) |
| Type check | `npm run typecheck` |
| Static build (→ `out/`) | `npm run build` |
| Rebuild + serve on LAN + print phone URL | `npm run restart` |
| Stop the static server | `npm run stop` |
| Foreground static server (logs) | `npm run lan` |

Before declaring work done: `npm test`, `npm run typecheck`, `npm run build`.
After code changes, run `npm run restart` so the phone gets the update.

## Architecture

- Next.js 16 App Router with `output: "export"` (static HTML/JS). No server actions,
  no API routes, no database server.
- `src/lib/db.ts` — Dexie schema (version 1) for all tables. `getDb()` is lazy so
  nothing touches IndexedDB during SSR/prerender. `resetDbInstance()` exists for tests.
- `src/lib/repos/*` — data access (`products`, `customers`, `transactions`, `stock`).
  Transaction creation is atomic and writes snapshots + stock movements.
- `src/lib/pricing.ts` — pure math: rounding (default Rp 500), margins, change,
  payment status. `src/lib/search.ts` — phone/name normalization + basic ranking.
  `src/lib/backup.ts` — JSON export/import of every table. `src/lib/pin.ts` — PIN hash
  (Web Crypto). `src/lib/seed.ts` — first-run starter data (default PIN `1234`).
- `src/app/(app)/*` — pages: `/` Beranda, `/beli` POS, `/pelanggan`, `/stok`, `/setting`.
  `src/app/(app)/layout.tsx` is the client shell: ToastProvider → PinGate → header + nav.
- Styling: all colors/fonts/radii/shadows live in `src/app/globals.css` (`@theme`
  tokens: `bg-canvas`, `text-ink`, `bg-soy`, `border-line`, …). Shared class
  primitives in `src/components/ui.ts`; inline SVG icons in `src/components/icons.tsx`.
- Tests use `fake-indexeddb/auto` (import it before any repo/db import) and
  `resetDbInstance()` between tests.

## Business rules (from the revision spec — do not change without sign-off)

- Snapshot `unitPrice` and `unitCost` on every transaction item. Changing prices
  today must never alter past reports.
- Every v1 transaction = 1 bonus point is **obsolete**. Accumulation bonuses are not
  active; per-transaction discounts come later via the discount engine (Fase 2).
- **No manual date inputs anywhere.** Transaction/expense dates are automatic.
- Rounding: final total rounds to the nearest `roundingStep` (default 500), toggle in Setting.
- Stock may go negative (selling when stock is 0 is allowed, with a warning badge).
- Selling decrements stock immediately and writes a `stockMovements` row.
- Reseller pricing is a flat per-bottle price (not a percentage); tiering comes in Fase 2.
- CSV exports were replaced by the JSON backup; reports (CSV + print PDF) come in Fase 3.
- PIN is a local UI gate only — it is not server security.

## Safety rules

- NEVER commit `.env.local`, `local.db` (unused legacy), or any secret.
  Verify with `git status --short` before committing.
- Data recovery: backup/restore JSON in Setting (`src/lib/backup.ts`).
- Only commit/push when the user explicitly asks.

## Roadmap (per revision doc)

- **Fase 1 (done):** schema, products/variants/costs, POS Beli, basic customers, PIN, backup.
- **Fase 2:** stock days (opening/damage/addition/closing), discount engine + simulator +
  margin guard, reseller tiers/MOQ/receivables/returns.
- **Fase 3:** expenses, daily cash close, full financial Beranda + charts, reports.
- **Fase 4:** fuzzy search, service worker/offline install (needs HTTPS), cancel last
  transaction, attach member, audit log, WhatsApp receipt, Excel/PDF exports.
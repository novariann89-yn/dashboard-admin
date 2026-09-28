Before any coding task, load the `lean-coding` skill. Keep answers terse.

# AGENTS.md — Dashboard Toko (offline-first, revisi 2)

Admin/POS dashboard for a soy-milk snack stall (owner: Mas Andik). **All data
lives on the phone** (IndexedDB via Dexie); the app is a static export (folder
`out/`) and must run fully offline at the market. UI is in Indonesian. Access is
gated by a local login (Owner/Admin roles).

- Requirements source of truth: Obsidian `00 - Inbox/revisi mas andik 2 (ver revisi dari gpt).md`.
- Beranda UI blueprint: Obsidian `Excalidraw/Drawing 2026-09-19 01.50.04.excalidraw.md`.

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
  Tables: `products`, `productVariants`, `customers`, `transactions`,
  `transactionItems`, `expenses`, `expensePresets`, `users`, `auditLog`, `settings`.
- `src/lib/repos/*` — data access:
  - `products` — products + variants (`sellPrice`, `costPrice`, `netProfitPerUnit`, `stock`).
  - `transactions` — atomic sale: snapshots price/cost/profit, decrements stock.
  - `stock` — `listStock`, `stockLevel`, `addStock` (increment), `setStock` (physical count), all audited.
  - `customers`, `expenses`, `audit`.
- `src/lib/auth.ts` — `login`/`logout`, session in `sessionStorage`, `hasPermission`,
  `createUser`/`updateUser`/`deleteUser`/`changePassword`.
  `src/lib/permissions.ts` — single source of truth: `PAGES`, `permissionForPath`,
  `canAccess`, `visiblePages`.
  `components/login-gate.tsx` gates the whole UI; `components/permission-gate.tsx`
  guards each route (renders an "Akses ditolak" screen).
- Sales flow (Beranda): `app/(app)/page.tsx` product grid → `components/product-detail-sheet.tsx`
  (variant/size + qty, capped to stock) → `components/cart-context.tsx` (persists to
  `localStorage`) → `components/cart-sheet.tsx` → `/checkout` → `createTransaction`.
  A single `CartProvider` lives in `src/app/(app)/layout.tsx`.
- Pages `src/app/(app)/*`: `/` Beranda, `/checkout`, `/pelanggan`, `/stok`,
  `/dompet` (owner-only), `/laporan` (= Histori, owner-only via menu), `/setting` (owner-only).
- Styling: colors/fonts/radii/shadows in `src/app/globals.css` (`@theme` tokens, minimal
  blue, subtle dot/blob background, dark mode via `.dark`). Shared class primitives in
  `src/components/ui.ts`; inline SVG icons in `src/components/icons.tsx`; theme helper
  `src/lib/theme.ts`.
- Offline/PWA: `public/sw.js` (app-shell cache `dashboard-admin-v2`, network-first
  navigation) registered by `src/components/pwa-register.tsx` **only in secure contexts**
  (HTTPS/localhost), so LAN HTTP keeps working. `src/app/manifest.ts` provides the manifest.
- `src/lib/backup.ts` — JSON export/import across **all** Dexie tables; restore clears the
  legacy PIN keys. `src/lib/format.ts`, `src/lib/id.ts`, `src/lib/csv.ts`, `src/lib/receipt.ts`,
  `src/lib/pricing.ts` (rounding/margin/change) are pure helpers.
- Tests use `fake-indexeddb/auto` (import it before any repo/db import) and
  `resetDbInstance()` between tests.

## Roles & permissions

- Owner: every page, including Dompet and Setting. Admin default: `beranda`, `pelanggan`, `stok`.
- Permission keys: `beranda`, `pelanggan`, `stok`, `dompet`, `historis`, `setting`.
  `dompet` and `setting` are `ownerOnly` in `permissions.ts`.
- First-run seed (`src/lib/seed.ts`): product "Sari Kedelai", owner ID `owner`, sandi `1234`.
  `ensureSeeded()` runs before the login screen.
- `src/lib/pin.ts` (Web Crypto hash) is reused as the password hasher. `settings.pinHash`
  and the Setting "Ganti PIN" section are legacy remnants of the old PIN gate.

## Business rules (from the revision spec — do not change without sign-off)

- Payment method: **CASH only**. No QRIS/transfer, no payment gateway.
- **No** reseller pricing, price levels/tiers, discount engine, bonus products, or "tutup buku".
- Snapshot `unitPrice`, `unitCost`, and `netProfitSnapshot` on every transaction item;
  changing prices today must never alter past reports.
- Cart quantity is capped at available stock; out-of-stock variants are shown greyed/disabled.
  A completed sale decrements stock (floor 0; no negative stock).
- Owner sets net profit per variant (`netProfitPerUnit`); Dompet computes today's product
  profit from that snapshot. Daily result = total product profit − total expenses.
- Expenses: presets (`expensePresets`) plus manual entries. No closing; each day is a new
  period automatically and past data stays in Histori.
- Histori (`/laporan`) persists across days and can be filtered by period, exported to CSV,
  and printed to PDF.
- No manual date inputs for transactions/expenses (dates are automatic). The report period
  picker is a filter, not data entry.

## Safety rules

- NEVER commit `.env.local`, `local.db` (unused legacy), `certs/`, or any secret.
  Verify with `git status --short` before committing.
- Data recovery: backup/restore JSON in Setting (`src/lib/backup.ts`).
- Only commit/push when the user explicitly asks.

## Parallel work (multi-agent)

- Parallel agents use isolated Git worktrees under `.slim/worktrees/` (gitignored). Lane and
  file ownership is tracked in `.slim/worktrees.json`. Never edit files owned by another lane;
  honor each lane's `areas` / `forbiddenAreas`.

## Status & known gaps

- Implemented: login + roles + permission enforcement/nav guard, Beranda product-selection
  cart flow, minimal blue theme, Dompet, Histori, Stok (restock + set exact), PWA/offline
  app-shell, backup/restore.
- In progress (revision-2 Settings): store name editing, owner ID/sandi change, admin
  account + permission management, per-variant profit UI, expense presets UI.
- Full offline install requires HTTPS (Vercel or local certs); LAN HTTP works but is not
  installable.
- `vercel.json` sets `outputDirectory: ".next"` while the build also emits `out/` — verify
  actual Vercel output when deploying.

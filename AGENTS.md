# AGENTS.md — dashboard-admin (Toko Mas Andik)

Admin dashboard for a bottled soy milk stall (Toko Mas Andik): member registry by
phone number, purchase recording, automatic free-product bonus, daily sales stats,
and CSV export. UI is in Indonesian, mobile-first. Production runs on the LAN
(`npm run lan`, port 3000) from this machine; deployment to Vercel + Turso is
documented in `DEPLOY.md`.

Remote: `git@github.com:novariann89-yn/dashboard-admin.git` (SSH auth as `novariann89-yn`).

## Commands

| Task | Command |
| --- | --- |
| Dev server (hot reload) | `npm run dev -- -p 3001` — use 3001; 3000 is used by the LAN server |
| Tests | `npm test` (node:test + tsx, 38 tests) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |
| Rebuild + restart LAN server | `npm run restart` |
| Stop LAN server | `npm run stop` |
| Foreground server (watch logs) | `npm run lan` |
| Preview data | `npm run db:studio` |
| Schema change flow | edit `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate` |
| Seed products + bonus rule | `npm run db:seed` (idempotent) |
| Hash a new admin PIN | `npm run hash-pin -- <pin>` |

Before declaring any task done: `npm test`, `npm run typecheck`, `npm run build`.
After code changes, run `npm run restart` so the phone gets the update.

## Architecture

- Next.js 16 App Router, React 19, Tailwind v4 (CSS-first `@theme` tokens),
  Drizzle ORM + libSQL (local `file:./local.db`, Turso in production).
- `src/lib/purchase-service.ts` — core business logic (`recordPurchase`,
  `voidPurchase`). The integration tests in `purchase-service.test.ts` create a
  temp SQLite DB and apply the SQL files in `drizzle/` themselves.
- `src/lib/bonus.ts` (pure bonus math), `src/lib/phone.ts` (normalization),
  `src/lib/csv.ts` (CSV), `src/lib/auth.ts` + `src/lib/pin.ts` (PIN session),
  `src/lib/format.ts` (WIB dates, rupiah).
- `src/actions/*.ts` — server actions, thin wrappers; every one calls
  `requireSession()` first. Business logic belongs in `src/lib`, not actions.
- `src/app/(admin)/*` — pages: Beranda, Pembelian, Member, Riwayat, Pengaturan.
  `src/app/export/*` — authenticated CSV download endpoints. `src/app/login` — PIN.
- `src/db/schema.ts` — tables: products, members, purchases, purchase_items,
  bonus_rules, bonus_events.
- Styling: all colors/fonts/radii/shadows live in `src/app/globals.css`. Use the
  tokens (`bg-canvas`, `text-ink`, `bg-soy`, `border-line`, …). Do not introduce
  hardcoded Tailwind grays or new palettes. Shared class primitives in
  `src/components/ui.ts`; icons in `src/components/icons.tsx` (inline SVG, no deps).
  Interactive bits: `src/components/purchase-items.tsx` (qty steppers),
  `src/components/bottom-nav.tsx`.

## Business rules (do not change without user sign-off)

- 1 transaction = 1 bonus progress point, regardless of bottle quantity.
- Reaching the threshold creates a bonus event and resets progress by subtracting
  the threshold (remainder preserved).
- Void is blocked when the purchase produced a bonus event; otherwise member
  counters are rolled back.
- Times are stored UTC and displayed/entered as WIB (Asia/Jakarta). Backdated
  purchases are allowed; future dates are rejected.
- CSV exports use `;` as delimiter plus a UTF-8 BOM (Indonesian Excel).
- Phone numbers are canonicalized to `08xxxxxxxxxx`; `+62`/`62`/`8…` all normalize
  to the same value.

## Safety rules

- NEVER read, modify, or commit `.env.local`, `local.db`, or any secret. Both are
  gitignored; verify with `git status --short` before committing.
- Schema changes always go through `db:generate` + `db:migrate`, and migration
  files under `drizzle/` must be committed.
- LAN mode serves a production build with `COOKIE_SECURE=false` (see
  `scripts/restart-lan.sh`). Do not remove that, or phone login breaks over HTTP.
- Only commit/push when the user explicitly asks.

## Deployment

See `DEPLOY.md`. Create the Turso database **without** `--tursodb` (this app uses
the libSQL driver). Required env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
`SESSION_SECRET`, `ADMIN_PIN_HASH`.

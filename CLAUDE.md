# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant booking/POS system for PlayStation gaming clubs (игровые клубы) — **not** a traditional sales CRM despite the repo name. The domain is: clubs → rooms → consoles (stations) → timed play sessions → cash-register shifts. There are no leads, deals, or pipelines. UI is bilingual Russian/English (Russian is the default locale).

## Commands

```bash
npm run dev              # dev server (Next.js, Turbopack) — http://localhost:3000
npm run build             # production build
npm run lint               # eslint .
npm run test                # vitest run (single pass)
npm run test:watch          # vitest watch mode
npx vitest run path/to/file.test.ts   # run a single test file
npx tsc --noEmit             # typecheck (no dedicated npm script)

npm run db:push            # prisma db push (sync schema, no migration files)
npm run db:seed             # prisma db seed (prisma/seed.ts)
npm run db:reset            # force-reset db + reseed
```

There is no `prisma/migrations` directory — schema changes go through `prisma db push`, not `prisma migrate`. `postinstall` runs `prisma generate` automatically, but it requires `DATABASE_URL` to be set (even to a dummy value) or it fails.

For local dev without Supabase, swap `provider = "postgresql"` to `"sqlite"` in `prisma/schema.prisma` and set `DATABASE_URL="file:./dev.db"`, per the README.

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Prisma 7 on PostgreSQL/Supabase via `@prisma/adapter-pg` (driver adapter, not the default engine — client is generated to `src/generated/prisma`, not `node_modules`), Supabase Auth, TanStack Query for all client-side fetching, Tailwind + shadcn/ui-style components on Radix primitives, Vitest + Testing Library.

### Multi-tenancy & auth (the part that spans the most files)

- **Tenant** = a club. Every domain model (`Room`, `Station`, `Customer`, `Session`, `Reservation`, `Shift`) carries a direct `tenantId` column.
- Access is granted via `Membership { userId, tenantId, role }`. `role` exists in the schema but is currently unused — there's only one flat access level today, plus a single hardcoded super-admin identified by the `ADMIN_EMAIL` env var (checked via `isAdminUser()` in `src/lib/auth/impersonation.ts`).
- **Every route handler that reads/writes tenant-scoped data must call `requireMembership(tenantId)`** (`src/lib/auth/requireMembership.ts`) before touching Prisma. It returns 401 if unauthenticated, or **404 (not 403)** if the user isn't a member — deliberately avoiding confirming a tenant ID exists to someone who isn't in it. The pure authorization decision lives in `src/lib/auth/membership.ts` (`resolveMembershipAccess`) so it's testable without I/O.
- Callers must resolve `tenantId` themselves first: for `/api/clubs/[clubId]/...` routes it's in the URL; for routes shaped around a room/station/session, look up that resource's own `tenantId` column instead of trying to derive it from a relation.
- **Impersonation:** the admin can browse as any user. `src/lib/auth/impersonation.ts` stores the choice in an httpOnly cookie, but the cookie is only honored when the *real* Supabase session is `ADMIN_EMAIL` — a forged cookie on a non-admin session is ignored. `requireMembership` (via `getEffectiveUserId()`) checks membership against the effective (possibly impersonated) user, so an impersonating admin gets exactly the target user's access, no more.
- `middleware.ts` enforces auth on every route except `/login`, `/auth`, `/set-password` (these must stay public: invite/magic-link emails use Supabase's implicit flow, delivering tokens in the URL fragment, which never reaches the server — the client-side Supabase lib on `/set-password` turns that fragment into a real session).
- No self-signup: users are invited by the admin via `supabase.auth.admin.inviteUserByEmail` (`src/app/(dashboard)/admin/actions.ts`), which also creates their `Membership` row.

### Data model (`prisma/schema.prisma`)

```
Tenant (club)
 ├── Room         (name + price1h / price3h / price5h / openHourlyRate)
 │    └── Station (console: type, status FREE|BUSY|MAINTENANCE, posX/posY % on floor plan)
 ├── Customer     (name, phone, balance, bonusPoints)
 ├── Session      (booking: tariffKind, startedAt, plannedEndAt, cost, status, paymentMethod, shiftId)
 ├── Reservation  (future booking: tariffKind, startAt/endAt, status BOOKED|SEATED|CANCELLED)
 ├── Shift        (cash-register shift: openingCash, closingCash, status OPEN|CLOSED)
 └── Membership   (userId + role — grants a Supabase user access to this club)
```

`supabase-setup.sql` is a hand-maintained mirror of this schema for one-shot production setup via the Supabase SQL editor — **if you change `schema.prisma`, update this file too**, they aren't generated from each other.

### Tariffs & pricing (`src/lib/tariffs.ts`)

Tariffs are `HOUR_1 | HOUR_3 | HOUR_5 | OPEN`. Fixed tariffs charge the room's fixed price up front; `OPEN` is billed on stop from elapsed time × `openHourlyRate`. **Always compute cost through `fixedPrice()` / `openCost()` / `liveCost()` in `src/lib/tariffs.ts`** rather than re-deriving it — this logic used to be duplicated across the stop route, the floor-plan marker, and the stop dialog, and has since been consolidated specifically to avoid displayed/charged price drift in a cash-handling app.

### Reservations (`src/lib/reservations.ts`)

Only fixed tariffs can be reserved (duration must be known to detect overlaps); an `OPEN` walk-in session blocks/is-blocked-by reservations within a 60-minute window (`OPEN_SESSION_BLOCK_MIN`). Reservations can't be made more than `MAX_ADVANCE_DAYS` (30) ahead. Overlap detection (`intervalsOverlap`, `findConflict`) is pure and shared between the reservation-create route and walk-in booking.

### Shifts (`src/lib/shifts.ts`)

A shift is opened with a starting cash float; `expectedCash()` sums the opening float plus every `CASH`-paid session recorded while the shift was open (card payments never touch the drawer). `cashDifference()` is counted-minus-expected (positive = surplus, negative = shortage). Only one shift can be open per tenant at a time. A session's `shiftId` is set at stop-time to whatever shift is currently open for that tenant (or null if none).

### Time / timezones (`src/lib/time.ts`)

Reports/analytics day boundaries use **server-local time**, not a per-club timezone — this is a deliberate, documented simplification (see README "Known limitations"), not an oversight. Use `startOfLocalDay()`, `startOfLocalDayDaysAgo()`, `localDayKey()` rather than reimplementing date-boundary math inline.

### Frontend structure

- App Router with a `(dashboard)` route group wrapping all authenticated pages in a shared `Sidebar` + `ImpersonationBanner` layout.
- Nearly every page is a client component fetching via TanStack Query against the API routes under `src/app/api/`. `/admin` is the exception — a server component reading Prisma + the Supabase admin API directly.
- Route param handlers use the Next.js 15+/16 async-params convention: `{ params }: { params: Promise<{ id: string }> }`, always `await`ed.
- Domain components live under `src/components/room/` (`StationMarker`, `BookingModal`, `ReservationsPanel`) and `src/components/shift/`; generic shadcn-style primitives are under `src/components/ui/`.
- i18n is a custom lightweight dictionary system, not a library: add a key once in `src/lib/i18n/dictionaries.ts` (both `ru` and `en`) and reference it via `t("key")` from `useI18n()` — never hardcode user-facing strings.

## Testing conventions

Tests live next to the module they cover (`foo.ts` → `foo.test.ts`), using Vitest + Testing Library, `describe`/`it`/`expect` from `"vitest"`. Coverage today is concentrated in pure logic modules (`src/lib/**`) and a few small UI atoms/pages — there is essentially **no route-handler/API integration coverage**, which matters more than usual here since this app reconciles real cash (shift open/close, session cost finalization). When touching money-handling logic, prefer adding/extending a `src/lib/*.ts` pure function plus a test over embedding the logic directly in a route handler, so it stays testable.

## Known limitations (intentional, not bugs to silently "fix")

- `Membership.role` is unused — there's no owner/cashier permission tiering yet.
- Customer `balance`/`bonusPoints` are display-only; no API route mutates them, and booking a session doesn't deduct from a customer's balance.
- Reports/analytics assume a single server-local timezone (see `src/lib/time.ts`).

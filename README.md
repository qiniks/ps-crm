# PS Club CRM 🎮

Multi-tenant booking/POS system for PlayStation gaming clubs (игровые клубы).
Manage several clubs, lay out rooms with drag-and-drop console placement, book
consoles by tariff, take reservations, run cash-register shifts, and track
revenue — all with a bilingual **Russian / English** UI.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** — frontend **and** backend (API routes)
- **Prisma** ORM on **PostgreSQL** (Supabase), via the `@prisma/adapter-pg` driver adapter. Switch the provider to `sqlite` for local file dev.
- **Supabase Auth** (`@supabase/ssr`) — email/password login, admin-only invites (no self-signup)
- **TanStack Query** for client-side data fetching
- **Tailwind CSS** + shadcn/ui-style components (Radix primitives), light/dark theme
- Lightweight custom i18n (RU/EN)
- **Vitest** + Testing Library for tests

## Features

- **Multiple clubs (tenants)** — run more than one PlayStation club from one app, access scoped per user via memberships
- **Rooms** — create rooms per club, each with its **own pricing** (a cheap hall vs a VIP room)
- **Floor-plan editor** — add consoles and **drag them into place**, then **save the layout**
- **Booking** — a seller clicks a free console and books it with a tariff:
  - **1 hour / 3 hours / 5 hours** — fixed price taken from the room
  - **Open time** — plays until the client is done, billed by the room's hourly rate on stop
- **Live floor plan** — busy consoles show a countdown (fixed tariffs) or elapsed time + running cost (open)
- **Reservations** — book a station for a future time slot, with overlap detection; seat a guest to convert it into a live session
- **Cash-register shifts** — open a shift with a starting float, watch expected cash live, close it with the counted amount and see the over/short difference
- **Customers**, **daily reports**, and a **30-day analytics** dashboard (peak hours, revenue by tariff/room, top customers), scoped per club
- **Admin panel** — create clubs, invite users by email, and impersonate a user to see the app as they would (banner + one-click exit)
- **Team page** (per club) — a club `OWNER` can invite members with a role (`OWNER`/`CASHIER`), change a member's role, remove them, or revoke a pending invite; `CASHIER`s see a read-only member list

## Data model

```
Tenant (club)
 ├── Room         (name + price1h / price3h / price5h / openHourlyRate)
 │    └── Station (console: type, status, posX/posY on the floor plan)
 ├── Customer     (name, phone, balance, bonusPoints)
 ├── Session      (booking: tariffKind, startedAt, plannedEndAt, cost, status, paymentMethod, shiftId)
 ├── Reservation  (future booking: tariffKind, startAt/endAt, status)
 ├── Shift        (cash-register shift: openingCash, closingCash, status)
 └── Membership   (userId + role — grants a Supabase user access to this club)
```

## Getting started (local, SQLite)

```bash
npm install
# temporarily set provider = "sqlite" in prisma/schema.prisma and
# DATABASE_URL="file:./dev.db" in .env, then:
npm run db:push
npm run db:seed
npm run dev            # http://localhost:3000
```

## Production (Supabase + Vercel)

1. **Create the tables:** open Supabase → SQL Editor → run **`supabase-setup.sql`**
   (creates all tables + demo data; it drops any previous PS Club CRM tables first).
2. **Create the product-images Storage bucket:** Supabase Dashboard → Storage →
   New bucket → name `product-images`, "Public bucket" ON. This is a one-time
   manual step, not managed by `supabase-setup.sql` or `prisma db push` —
   Storage buckets aren't part of the Postgres schema.
3. **Deploy to Vercel:** import the repo, Root Directory `./`, and set the env var
   `DATABASE_URL` to your Supabase **pooler** connection string (IPv4 — the direct
   `db.*.supabase.co` host is IPv6-only and fails on Vercel).

## Project structure

```
prisma/
  schema.prisma        # Tenant, Room, Station, Customer, Session, Reservation, Shift, Membership
  seed.ts              # demo club, rooms, placed consoles, customers
supabase-setup.sql     # one-shot table creation + demo data for Supabase (kept in sync by hand)
src/
  app/
    login/  set-password/  auth/callback/    # Supabase auth (invite-only, no self-signup)
    admin/                                    # super-admin: create clubs, invite users, impersonate
    clubs/                                    # club list + create
      [clubId]/                               # rooms of a club + create room (pricing)
        rooms/[roomId]/                       # floor plan — booking + reservations view
          edit/                               # drag-and-drop layout editor
        customers/  reports/  analytics/      # scoped to the club
    api/
      clubs/ ...                              # clubs, rooms, customers, reports, analytics
      rooms/[roomId]/{stations,layout,reservations}/  # add console, save positions, reserve
      stations/[stationId]/                   # rename / retype / delete
      sessions/ + sessions/[id]/stop/         # book / stop a session
      reservations/[id]/                      # cancel / seat a reservation
      shifts/ + shifts/[id]/close/            # open / close a cash-register shift
    middleware.ts                             # enforces auth on every non-public route
  components/
    Sidebar, LanguageSwitcher, theme-toggle, ImpersonationBanner
    room/{StationMarker, BookingModal, ReservationsPanel}   # floor-plan pieces
    shift/ShiftCard
    analytics/charts.tsx                      # lightweight bar/column charts, no chart library
    ui/                                        # shadcn-style primitives (button, dialog, table, ...)
  lib/
    prisma.ts, format.ts, tariffs.ts, reservations.ts, shifts.ts, useNow.ts, room-types.ts
    auth/                                      # requireMembership, impersonation, membership helpers
    i18n/                                      # RU/EN dictionaries + provider
```

## Known limitations

- Report/analytics day boundaries use the server's local timezone, not a
  per-club timezone — fine for a single-region deployment, not yet safe for
  clubs in different timezones (see `src/lib/time.ts`).
- `Membership.role` has two values, `OWNER` and `CASHIER`. Today the only
  enforced difference is membership management (invite/remove/change-role) on
  a club's Team page — everything else (booking, shifts, reports, etc.) is
  still flat access for any member, and the hardcoded `ADMIN_EMAIL`
  super-admin remains the only cross-club role.
- Customer `balance` / `bonusPoints` are displayed but not yet editable from
  the app, and booking a session doesn't deduct from them.

## Roadmap

- Extend `Membership.role` tiering beyond membership management (e.g. gate
  shift close / pricing edits to `OWNER`)
- Assign a booking to a customer's prepaid balance / deduct automatically
- Bar / snacks POS
- Customer-facing mobile booking app (React Native) on the same backend

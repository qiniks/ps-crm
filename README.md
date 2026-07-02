# PS Club CRM 🎮

Multi-tenant CRM for PlayStation gaming clubs (игровые клубы). Manage several
clubs, lay out rooms with drag-and-drop console placement, and let sellers book
consoles by tariff — all with a bilingual **Russian / English** UI.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript** — frontend **and** backend (API routes)
- **Prisma** ORM on **PostgreSQL** (Supabase). Switch the provider to `sqlite` for local file dev.
- **Tailwind CSS** dark UI
- Lightweight custom i18n (RU/EN)

## Features

- **Multiple clubs (tenants)** — run more than one PlayStation club from one app
- **Rooms** — create rooms per club, each with its **own pricing** (a cheap hall vs a VIP room)
- **Floor-plan editor** — add consoles and **drag them into place**, then **save the layout**
- **Booking** — a seller clicks a free console and books it with a tariff:
  - **1 hour / 3 hours / 5 hours** — fixed price taken from the room
  - **Open time** — plays until the client is done, billed by the room's hourly rate on stop
- **Live floor plan** — busy consoles show a countdown (fixed tariffs) or elapsed time + running cost (open)
- **Customers** and **daily revenue reports**, scoped per club

## Data model

```
Tenant (club)
 ├── Room         (name + price1h / price3h / price5h / openHourlyRate)
 │    └── Station (console: type, status, posX/posY on the floor plan)
 ├── Customer
 └── Session      (booking: tariffKind, startedAt, plannedEndAt, cost, status)
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
2. **Deploy to Vercel:** import the repo, Root Directory `./`, and set the env var
   `DATABASE_URL` to your Supabase **pooler** connection string (IPv4 — the direct
   `db.*.supabase.co` host is IPv6-only and fails on Vercel).

## Project structure

```
prisma/
  schema.prisma        # Tenant, Room, Station, Customer, Session
  seed.ts              # demo club, rooms, placed consoles, customers
supabase-setup.sql     # one-shot table creation + demo data for Supabase
src/
  app/
    clubs/                                   # club list + create
      [clubId]/                              # rooms of a club + create room (pricing)
        rooms/[roomId]/                      # floor plan — booking view
          edit/                              # drag-and-drop layout editor
        customers/  reports/                 # scoped to the club
    api/
      clubs/ ...                             # clubs, rooms, customers, reports
      rooms/[roomId]/{stations,layout}/      # add console, save positions
      stations/[stationId]/                  # rename / retype / delete
      sessions/ + sessions/[id]/stop/        # book / stop a session
  components/
    Sidebar, LanguageSwitcher
    room/{StationMarker, BookingModal}       # floor-plan pieces
  lib/
    prisma.ts, format.ts, tariffs.ts, useNow.ts, room-types.ts
    i18n/                                     # RU/EN dictionaries + provider
```

## Roadmap

- Auth & roles (owner sees all clubs, cashier sees one)
- Assign a booking to a customer's prepaid balance / deduct automatically
- Bar / snacks POS, shift open-close
- Customer-facing mobile booking app (React Native) on the same backend

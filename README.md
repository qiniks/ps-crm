# PS Club CRM 🎮

CRM / management system for a PlayStation gaming club (игровой клуб).
Manage console stations, live play sessions, customers, tariffs and revenue reports.

Bilingual UI: **Russian / English** (switch in the sidebar).

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Prisma** ORM — SQLite for dev, swap to **PostgreSQL** for production
- **Tailwind CSS** for the UI
- Lightweight custom i18n (RU/EN)

## Features (MVP)

- **Stations dashboard** — live grid of consoles (PS4 / PS5 / VIP), free/busy status
- **Sessions** — start/stop with a live timer and automatic cost calculation by hourly rate
- **Customers** — base with phone, prepaid balance and bonus points
- **Tariffs** — price plans (day / night / happy hours)
- **Reports** — today's revenue, session count, average check and recent sessions

## Getting started

```bash
npm install            # installs deps + generates Prisma client
npm run db:push        # creates the SQLite schema (prisma/dev.db)
npm run db:seed        # seeds demo stations, tariffs and customers
npm run dev            # http://localhost:3000
```

Open <http://localhost:3000> — it redirects to the stations dashboard.

## Switching to PostgreSQL (production)

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` in `.env` to your Postgres connection string.
3. Run `npm run db:push` (or set up migrations with `prisma migrate`).

## Project structure

```
prisma/
  schema.prisma        # data model (User, Station, Tariff, Customer, Session, Shift)
  seed.ts              # demo data
src/
  app/
    dashboard/         # stations grid + live session timers
    customers/         # customer base
    tariffs/           # price plans
    reports/           # revenue reports
    api/               # REST endpoints (stations, sessions, customers, tariffs, reports)
  components/          # Sidebar, StationCard, LanguageSwitcher
  lib/
    prisma.ts          # Prisma client singleton
    format.ts          # money / duration / cost helpers
    i18n/              # bilingual dictionaries + LanguageProvider
```

## Roadmap ideas

- Staff auth & roles (admin / cashier), shift open/close
- Assign a customer to a session and deduct from balance
- Bar / snacks POS
- Bookings & reservations
- Customer-facing booking app (this is where React Native would fit, sharing this backend)

> Demo login seeded as `admin` / `admin` — replace with a hashed password before any real deployment.

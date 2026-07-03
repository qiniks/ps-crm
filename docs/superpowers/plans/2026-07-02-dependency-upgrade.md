# Dependency Upgrade (Next 16 / React 19 / Prisma 7 / TypeScript 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ps-crm from Next 14.2 / React 18.3 / Prisma 5.22 / TypeScript 5.6 to current latest (Next 16.2.10, React 19.2.7, Prisma 7.8.0, TypeScript 6.0.3) so the Supabase Auth and TanStack Query work that follows is written against final APIs instead of being migrated twice.

**Architecture:** This is a verification-driven workstream, not a TDD one — there's no new application behavior being specified, so "red/green" here means "does it typecheck, build, and does the existing Vitest suite (from the test-infrastructure plan) stay green," not new failing tests. Each task ends with a concrete verification command and expected output.

**Tech Stack:** next@16.2.10, react@19.2.7, react-dom@19.2.7, typescript@6.0.3, eslint@9.39.4, eslint-config-next@16.2.10, @prisma/client@7.8.0, prisma@7.8.0, @prisma/adapter-pg@7.8.0, pg@8.22.0, @types/pg@8.20.0, dotenv@17.4.2.

**Correction (found during Task 1 execution, not in the original plan):** this section originally targeted `eslint@10.6.0`. That version is not actually installable against `eslint-config-next@16.2.10` — its `typescript-eslint@^8.46.0` dependency has a peer range of `eslint: "^8.57.0 || ^9.0.0"`, which does not accept 10.x. Task 1's Next.js upgrade codemod independently discovered this and installed `eslint@9.39.4` instead, which is correct. Task 4 below is rewritten to match this reality — see its note.

**Prerequisites:**
- `2026-07-02-test-infrastructure.md` must be complete (`npm test` works) — Task 6 here relies on it.
- Node.js must be ≥20.9.0 (Next 16's hard minimum). Already confirmed: this machine runs Node v22.15.1, no action needed.
- **The Supabase DB credentials in `.env` are currently being rejected** (`Authentication failed against database server ... the provided database credentials for postgres are not valid`) — a pre-existing issue unrelated to this upgrade, found while fixing the original `/clubs` crash. Task 5 (Prisma migration) and Task 6 (verification) need a **working** `DATABASE_URL` to actually connect and confirm data loads. If credentials are still broken when you reach Task 5, stop and get a fresh connection string from Supabase → Project Settings → Database before continuing — schema/generator changes can be written and typechecked without a live DB, but they can't be verified end-to-end without one.

---

### Task 1: Run the official Next.js upgrade codemod

**Files:** touches `package.json`, `package-lock.json`, `next.config.mjs`, and potentially any of the 8 dynamic API route files listed in Task 2 (the codemod's async-params transform is best-effort — Task 2 verifies and hand-fixes whatever it missed).

- [ ] **Step 1: Run the codemod**

Run:
```bash
npx @next/codemod@canary upgrade latest
```

This is the officially recommended upgrade path (per the Next.js 16 upgrade guide) — it bumps `next`, `react`, and `react-dom` to latest, updates `next.config.mjs` for the new top-level `turbopack` key (if applicable), and attempts the async request APIs transform across `params`/`searchParams`/`cookies()`/`headers()` usage. Follow any interactive prompts it shows (accept the default "yes" for each transform it offers).

Expected: `package.json` now shows `"next": "^16.2.10"` (or exact `16.2.10`), `"react": "^19.2.7"`, `"react-dom": "^19.2.7"`.

- [ ] **Step 2: Bump the React type packages to match**

The codemod does not always update `@types/*` packages. Run:
```bash
npm install -D @types/react@19.2.17 @types/react-dom@19.2.3
```

- [ ] **Step 3: Migrate `next lint` away (the command is removed in Next 16)**

Run:
```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

This is a separate, smaller codemod specifically for the `next lint` → ESLint CLI migration (Next.js 16 removed `next lint` entirely). Note: this repo never had a working `next lint` setup to begin with (no `eslint` or `eslint-config-next` were installed — `"lint": "next lint"` in `package.json` would have failed if run). If the codemod reports nothing to migrate, that's expected — proceed to Task 4, which sets up ESLint from scratch.

- [ ] **Step 4: Confirm the version bump landed correctly**

Run: `npm ls next react react-dom`
Expected: `next@16.2.10`, `react@19.2.7`, `react-dom@19.2.7` (or newer patch versions within the same majors — the codemod tracks `latest` at run time).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Run Next.js 16 upgrade codemod (next/react/react-dom + next-lint migration)"
```

---

### Task 2: Verify and fix async `params` in every dynamic API route

**Context:** Next 16 fully removes synchronous access to `params` in Route Handlers (`route.ts`). This project's dynamic pages (`src/app/clubs/[clubId]/page.tsx` etc.) are all `"use client"` components using the `useParams()` hook from `next/navigation` — that hook is unaffected by this change, it's a client-side API, not one of the Async Request APIs. **Only Route Handlers that destructure `{ params }` from their second argument are affected.** There are exactly 8 in this codebase.

The codemod in Task 1 attempts this transform automatically. This task is the verification pass — run through each file below and confirm it matches the "After" shown; if the codemod already applied it correctly, these steps are a no-op confirmation, not a redundant edit.

**Files:**
- Modify: `src/app/api/clubs/[clubId]/rooms/route.ts`
- Modify: `src/app/api/clubs/[clubId]/customers/route.ts`
- Modify: `src/app/api/clubs/[clubId]/reports/route.ts`
- Modify: `src/app/api/rooms/[roomId]/route.ts`
- Modify: `src/app/api/rooms/[roomId]/layout/route.ts`
- Modify: `src/app/api/rooms/[roomId]/stations/route.ts`
- Modify: `src/app/api/sessions/[id]/stop/route.ts`
- Modify: `src/app/api/stations/[stationId]/route.ts`

- [ ] **Step 1: `src/app/api/clubs/[clubId]/rooms/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/rooms — rooms of a club with station counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const club = await prisma.tenant.findUnique({ where: { id: clubId } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const rooms = await prisma.room.findMany({
    where: { tenantId: clubId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stations: true } } },
  });

  return NextResponse.json({
    club: { id: club.id, name: club.name },
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      price1h: r.price1h,
      price3h: r.price3h,
      price5h: r.price5h,
      openHourlyRate: r.openHourlyRate,
      stationCount: r._count.stations,
    })),
  });
}

// POST /api/clubs/[clubId]/rooms — create a room with per-room pricing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const room = await prisma.room.create({
    data: {
      tenantId: clubId,
      name,
      price1h: num(body.price1h),
      price3h: num(body.price3h),
      price5h: num(body.price5h),
      openHourlyRate: num(body.openHourlyRate),
    },
  });
  return NextResponse.json(room, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/clubs/[clubId]/customers/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/customers — customers of a club.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const customers = await prisma.customer.findMany({
    where: { tenantId: clubId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers);
}

// POST /api/clubs/[clubId]/customers — add a customer. body: { name, phone? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const customer = await prisma.customer.create({
    data: {
      tenantId: clubId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
```

- [ ] **Step 3: `src/app/api/clubs/[clubId]/reports/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/reports — today's revenue summary + recent sessions.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todays = await prisma.session.findMany({
    where: {
      tenantId: clubId,
      status: "FINISHED",
      endedAt: { gte: startOfDay },
    },
  });

  const revenueToday = todays.reduce((sum, s) => sum + s.cost, 0);
  const sessionsToday = todays.length;
  const avgCheck = sessionsToday ? Math.round(revenueToday / sessionsToday) : 0;

  const recent = await prisma.session.findMany({
    where: { tenantId: clubId, status: "FINISHED" },
    include: { station: true, customer: true },
    orderBy: { endedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    revenueToday,
    sessionsToday,
    avgCheck,
    recent: recent.map((s) => ({
      id: s.id,
      station: s.station.name,
      tariffKind: s.tariffKind,
      customerName: s.customer?.name ?? null,
      endedAt: s.endedAt,
      cost: s.cost,
    })),
  });
}
```

- [ ] **Step 4: `src/app/api/rooms/[roomId]/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/rooms/[roomId] — room details, pricing, stations and their active session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      tenant: true,
      stations: {
        orderBy: { name: "asc" },
        include: {
          sessions: {
            where: { status: "ACTIVE" },
            include: { customer: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  return NextResponse.json({
    id: room.id,
    name: room.name,
    club: { id: room.tenant.id, name: room.tenant.name },
    price1h: room.price1h,
    price3h: room.price3h,
    price5h: room.price5h,
    openHourlyRate: room.openHourlyRate,
    stations: room.stations.map((s) => {
      const sess = s.sessions[0];
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        posX: s.posX,
        posY: s.posY,
        activeSession: sess
          ? {
              id: sess.id,
              tariffKind: sess.tariffKind,
              startedAt: sess.startedAt,
              plannedEndAt: sess.plannedEndAt,
              customerName: sess.customer?.name ?? null,
            }
          : null,
      };
    }),
  });
}
```

- [ ] **Step 5: `src/app/api/rooms/[roomId]/layout/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/rooms/[roomId]/layout — persist station positions after editing.
// body: { positions: { id: string, posX: number, posY: number }[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    positions?: { id: string; posX: number; posY: number }[];
  };
  const positions = body.positions ?? [];

  const clamp = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));

  // Only touch stations that actually belong to this room.
  await prisma.$transaction(
    positions.map((p) =>
      prisma.station.updateMany({
        where: { id: p.id, roomId },
        data: { posX: clamp(p.posX), posY: clamp(p.posY) },
      })
    )
  );

  return NextResponse.json({ ok: true, saved: positions.length });
}
```

- [ ] **Step 6: `src/app/api/rooms/[roomId]/stations/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/rooms/[roomId]/stations — add a console to the room.
// body: { name, type?, posX?, posY? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const clamp = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d;
  };

  const station = await prisma.station.create({
    data: {
      roomId: room.id,
      tenantId: room.tenantId,
      name,
      type: body.type === "PS4" ? "PS4" : "PS5",
      posX: clamp(body.posX, 50),
      posY: clamp(body.posY, 50),
    },
  });
  return NextResponse.json(station, { status: 201 });
}
```

- [ ] **Step 7: `src/app/api/sessions/[id]/stop/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCost } from "@/lib/tariffs";

// POST /api/sessions/[id]/stop — finish a session and finalize the bill.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { station: { include: { room: true } } },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Session already finished" }, { status: 409 });
  }

  const endedAt = new Date();
  // OPEN tariff is billed by elapsed time; fixed tariffs keep their up-front cost.
  const cost =
    session.tariffKind === "OPEN"
      ? openCost(session.startedAt, endedAt, session.station.room.openHourlyRate)
      : session.cost;

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt, cost, status: "FINISHED" },
  });

  await prisma.station.update({
    where: { id: session.stationId },
    data: { status: "FREE" },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 8: `src/app/api/stations/[stationId]/route.ts`**

Full file, after:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/stations/[stationId] — rename / change type / status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.type === "PS4" || body.type === "PS5") data.type = body.type;
  if (["FREE", "BUSY", "MAINTENANCE"].includes(String(body.status)))
    data.status = body.status;

  const station = await prisma.station.update({
    where: { id: stationId },
    data,
  });
  return NextResponse.json(station);
}

// DELETE /api/stations/[stationId] — remove a console.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  await prisma.station.delete({ where: { id: stationId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: Confirm the two non-dynamic API routes were untouched**

`src/app/api/clubs/route.ts` and `src/app/api/sessions/route.ts` take no `params` (no dynamic segment) — confirm neither the codemod nor this task modified them.

- [ ] **Step 10: Commit**

```bash
git add src/app/api
git commit -m "Migrate all dynamic API routes to async params (Next 16)"
```

---

### Task 3: Bump TypeScript and Node types

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run:
```bash
npm install -D typescript@6.0.3 @types/node@26.1.0
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to TypeScript itself. You will likely still see errors from the Prisma import (`@prisma/client` / generated client path) at this point — that's expected and gets resolved in Task 5. If you see *other* new type errors (e.g. from React 19's stricter JSX types), fix them now before moving on; don't carry unrelated type errors into the Prisma task.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Bump TypeScript to 6.0.3 and @types/node to 26.1.0"
```

---

### Task 4: Finish the ESLint setup Task 1's codemod already started

**Context (rewritten after Task 1 ran — see the tech-stack correction note above):** this task originally planned to set up ESLint from scratch, on the assumption Task 1's `next-lint-to-eslint-cli` codemod would find "nothing to migrate" (the repo never had a working `next lint` setup — no `eslint`/`eslint-config-next` were installed despite the script existing). In practice, that codemod *did* find something to do: it already created `eslint.config.mjs`, installed `eslint@9.39.4` and `eslint-config-next@16.2.10`, and changed the `"lint"` script to `"eslint ."`. Re-doing that work here would just be a no-op diff. This task is now: fix the one real gap in what the codemod produced, then run it.

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Confirm the codemod's output is what you expect**

Read `eslint.config.mjs` — it should already look like this:
```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
```
And `package.json`'s `"lint"` script should already be `"eslint ."`. If either doesn't match (i.e. this machine's state has diverged from what Task 1 produced), stop and report — don't silently redo Task 1's work.

- [ ] **Step 2: Add the one missing ignore entry**

The codemod's `ignores` list has no entry for Prisma's generated client output. Task 5 of this same plan (Prisma 7 migration) is about to start generating code into `src/generated/`, which ESLint should never lint. Modify `eslint.config.mjs`'s `ignores` array — add `"src/generated/**"`:
```js
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
```

- [ ] **Step 3: Run it**

Run: `npm run lint`
Expected: ESLint runs against the project. Fix any real errors it reports (e.g. unused variables, hook dependency warnings) — do not disable a rule just to silence a genuine issue it caught. If it reports zero errors, proceed directly.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "Add src/generated/** to ESLint ignores ahead of the Prisma 7 migration"
```

If Step 3 required fixing real lint errors elsewhere, stage those files too and describe them in the commit message instead of using the message above verbatim.

---

### Task 5: Migrate to Prisma 7

**Context:** Prisma 7 is an architectural change, not a patch bump: the datasource connection now requires an explicit driver adapter, client generation moves out of `node_modules` into a configured output path, and CLI env-var loading is no longer automatic.

**Files:**
- Create: `prisma.config.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/prisma.ts`
- Modify: `prisma/seed.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install the new packages**

Run:
```bash
npm install @prisma/client@7.8.0
npm install -D prisma@7.8.0 @prisma/adapter-pg@7.8.0 pg@8.22.0 @types/pg@8.20.0 dotenv@17.4.2
```

- [ ] **Step 2: Update the generator block in the schema**

Modify `prisma/schema.prisma` — change the generator block from:
```prisma
generator client {
  provider = "prisma-client-js"
}
```
to:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```
Leave the rest of `schema.prisma` (the `datasource db` block and every model) unchanged — this task only touches the generator block. `output` is relative to `prisma/schema.prisma`'s own directory, so this resolves to `src/generated/prisma/`, reachable from application code via the existing `@/*` path alias as `@/generated/prisma/...`.

- [ ] **Step 3: Create the Prisma config file**

Create `prisma.config.ts` at the project root (same level as `package.json`):

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

Prisma 7 no longer auto-loads `.env` for CLI commands (`prisma generate`, `prisma db push`, `prisma db seed`) — the `import "dotenv/config"` line at the top of this file is what makes `DATABASE_URL` visible to those commands now. The app itself (`next dev`/`next start`) is unaffected — Next.js has always loaded `.env` independently of Prisma.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: generates into `src/generated/prisma/` (new location — confirm the directory now exists with generated files inside).

- [ ] **Step 5: Rewrite the Prisma client singleton**

Modify `src/lib/prisma.ts` — full file, after:
```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Update the seed script**

Modify `prisma/seed.ts` — change only the import line and instantiation at the top from:
```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
```
to:
```ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```
Leave the rest of `prisma/seed.ts` (the `main()` function and everything below it) unchanged — this seed data isn't part of this upgrade's scope.

- [ ] **Step 7: Update package.json scripts and add `"type": "module"`**

Modify `package.json`:
- Add `"type": "module"` as a top-level key (Prisma 7 ships as ESM and its config/generator tooling expects this; verified safe for this repo — `tailwind.config.ts` and `postcss.config.mjs` are already module-system-agnostic/ESM, there are no plain `.js` CommonJS config files in the project that would break).
- Remove the top-level `"prisma": { "seed": "tsx prisma/seed.ts" }` key — this Prisma 5/6-era convention is replaced by the `migrations.seed` field in `prisma.config.ts` (Step 3).
- Change the `db:seed` and `db:reset` scripts to route through the Prisma CLI (so they inherit the `prisma.config.ts` env loading from Step 3) instead of calling `tsx` directly:
```json
"db:push": "prisma db push",
"db:seed": "prisma db seed",
"db:reset": "prisma db push --force-reset && prisma db seed",
```
`postinstall` (`"prisma generate"`) is unchanged — still correct in v7.

- [ ] **Step 8: Gitignore the generated client output**

Modify `.gitignore` — add under the existing `# database (SQLite dev)` section (or as its own section):
```
# Prisma-generated client (regenerated by `prisma generate` / postinstall)
/src/generated/
```

- [ ] **Step 9: Verify against the database**

This step requires a working `DATABASE_URL` — see the Prerequisites note at the top of this plan if credentials are still broken.

Run: `npx prisma db push`
Expected: connects successfully and reports the schema is already in sync (no changes, since only the generator block changed, not any model). If this fails with an authentication error, stop — that's the pre-existing credentials issue, not something this task caused; do not proceed to Step 10 until it's resolved.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. This is the point where any remaining `@prisma/client` import from the old location would surface as a type error — confirm none remain (`grep -r "@prisma/client" src/ prisma/` should now return nothing).

- [ ] **Step 11: Commit**

```bash
git add prisma.config.ts prisma/schema.prisma src/lib/prisma.ts prisma/seed.ts package.json package-lock.json .gitignore
git commit -m "Migrate to Prisma 7 (driver adapter, new config file, generated client path)"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: the 4 tests from the test-infrastructure plan still pass (this upgrade didn't touch `src/lib/format.ts`, so this is a regression check, not a new-behavior check).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exits 0, no build errors. This is the step most likely to surface anything the codemod or manual fixes missed (e.g. a stray sync `params` access) — Next's build-time type checking will catch it.

- [ ] **Step 5: Manual smoke test in the browser**

Start the dev server and load `/clubs` — confirm the page renders without the crash this whole initiative started from, and that creating a club and navigating into it (rooms → a room → booking a station → customers → reports) still works end to end. This exercises every one of the 8 migrated route handlers at least once.

- [ ] **Step 6: Commit (if Steps 1-5 required any fixes)**

```bash
git add -A
git commit -m "Fix issues found during full verification pass"
```

If no fixes were needed, skip this commit — Task 5's commit already represents the completed state.

---

## Definition of done

- `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` all exit 0.
- `/clubs` and every nested page (rooms, room detail/booking, room editor, customers, reports) work end-to-end against a real database connection.
- `package.json` shows `next@16.2.10`, `react@19.2.7`, `prisma@7.8.0`, `typescript@6.0.3` (or newer patch versions within the same majors).

# TanStack Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-rolled `fetch` + `useEffect` + `useState` data-fetching pattern in the app with TanStack Query, giving all 6 data-fetching pages consistent loading/error/caching behavior instead of each page reimplementing it slightly differently.

**Architecture:** This is a behavior-preserving refactor, not new functionality — there's no new user-facing behavior being specified, so verification is "does it build and does manual browser testing show the same behavior as before," not new unit tests (none of these 6 pages have existing component tests to preserve either — only the login form, from the Supabase Auth plan, has one). `staleTime` is deliberately left at TanStack Query's default of `0` (always refetch on mount) to match the original code's `cache: "no-store"` semantics as closely as possible — this migration isn't the place to introduce new caching behavior the user didn't ask for.

**Tech Stack:** @tanstack/react-query@5.101.2.

**Prerequisites:**
- `2026-07-02-test-infrastructure.md`, `2026-07-02-dependency-upgrade.md`, and `2026-07-02-supabase-auth.md` all complete. This plan is written against the post-auth state of `src/app/clubs/page.tsx` and `src/app/api/clubs/route.ts` (no create-club form, membership-scoped listing) — running this before the auth plan would mean re-doing those two files' data-fetching logic twice.

**Scope note:** the task list below says "6 pages" matching what was originally scoped, but `src/components/room/BookingModal.tsx` is folded into Task 6 (the room view page) rather than being a separate task — it's a sub-component of that page doing the exact same booking flow's data fetching (the customer list) and mutation (the booking POST), and leaving it on manual `fetch`/`useEffect` while its parent page uses `useQuery` would mean the same feature area has two different data-fetching patterns side by side.

---

### Task 1: Install TanStack Query and wrap the app

**Files:**
- Modify: `package.json`
- Create: `src/components/QueryProvider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install**

Run:
```bash
npm install @tanstack/react-query@5.101.2
```

- [ ] **Step 2: Create the provider**

Create `src/components/QueryProvider.tsx`:

```tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

The `useState(() => new QueryClient())` (rather than a module-level singleton) is the standard TanStack Query + Next.js App Router pattern — it guarantees one client per component tree instance, not one shared across concurrent requests on the server.

- [ ] **Step 3: Wrap the root layout**

Full file, after:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "@/components/Sidebar";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "PS Club CRM",
  description: "Gaming club management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>
          <LanguageProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: exits 0. (Nothing consumes `useQuery` yet — this step only proves the provider itself doesn't break anything.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/QueryProvider.tsx src/app/layout.tsx
git commit -m "Install TanStack Query and wrap the app in QueryClientProvider"
```

---

### Task 2: `/clubs` — GET only

**Files:**
- Modify: `src/app/clubs/page.tsx`

- [ ] **Step 1: Convert**

Full file, after:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type Club = { id: string; name: string; roomCount: number };

async function fetchClubs(): Promise<Club[]> {
  const res = await fetch("/api/clubs", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
  return res.json();
}

export default function ClubsPage() {
  const { t } = useI18n();
  const {
    data: clubs = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["clubs"], queryFn: fetchClubs });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("clubs.title")}</h1>
        <p className="text-sm text-slate-400">{t("clubs.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
          {t("common.error")}
        </div>
      ) : clubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
          {t("clubs.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link
              key={c.id}
              href={`/clubs/${c.id}`}
              className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-brand"
            >
              <div className="text-2xl">🎮</div>
              <div className="mt-2 font-semibold text-white group-hover:text-brand">
                {c.name}
              </div>
              <div className="text-sm text-slate-400">
                {c.roomCount} {t("clubs.roomsCount")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Start the dev server, sign in, visit `/clubs` — confirm the same list renders as before this change.

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/page.tsx
git commit -m "Migrate /clubs to TanStack Query"
```

---

### Task 3: `/clubs/[clubId]` — rooms list + create-room mutation

**Files:**
- Modify: `src/app/clubs/[clubId]/page.tsx`

- [ ] **Step 1: Convert**

Full file, after:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Room = {
  id: string;
  name: string;
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
  stationCount: number;
};

type RoomsResponse = { club: { name: string }; rooms: Room[] };

const EMPTY = { name: "", price1h: "", price3h: "", price5h: "", openHourlyRate: "" };

async function fetchRooms(clubId: string): Promise<RoomsResponse> {
  const res = await fetch(`/api/clubs/${clubId}/rooms`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET rooms failed: ${res.status}`);
  return res.json();
}

async function createRoom(clubId: string, values: typeof EMPTY) {
  const res = await fetch(`/api/clubs/${clubId}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST room failed: ${res.status}`);
  return res.json();
}

export default function ClubPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["rooms", clubId],
    queryFn: () => fetchRooms(clubId),
  });

  const createRoomMutation = useMutation({
    mutationFn: (values: typeof EMPTY) => createRoom(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", clubId] });
      setForm(EMPTY);
      setShowForm(false);
    },
  });

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createRoomMutation.mutate(form);
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const clubName = data?.club.name ?? "";
  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{clubName}</h1>
          <p className="text-sm text-slate-400">{t("club.rooms")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + {t("club.addRoom")}
        </button>
      </header>

      {showForm && (
        <form
          onSubmit={create}
          className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <input
            value={form.name}
            onChange={set("name")}
            placeholder={t("club.roomName")}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            {t("room.pricing")} ({t("common.currency")})
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PriceInput label={t("room.price1h")} value={form.price1h} onChange={set("price1h")} />
            <PriceInput label={t("room.price3h")} value={form.price3h} onChange={set("price3h")} />
            <PriceInput label={t("room.price5h")} value={form.price5h} onChange={set("price5h")} />
            <PriceInput
              label={t("room.priceOpen")}
              value={form.openHourlyRate}
              onChange={set("openHourlyRate")}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={createRoomMutation.isPending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {t("common.create")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
          {t("common.error")}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
          {t("club.noRooms")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">{r.name}</div>
                <div className="text-sm text-slate-400">
                  🎮 {r.stationCount} {t("club.stationsCount")}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>1h: {formatMoney(r.price1h)}</span>
                <span>3h: {formatMoney(r.price3h)}</span>
                <span>5h: {formatMoney(r.price5h)}</span>
                <span>
                  {t("station.openTariff")}: {formatMoney(r.openHourlyRate)}
                  {t("common.perHour")}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/clubs/${clubId}/rooms/${r.id}`}
                  className="flex-1 rounded-lg bg-brand py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  {t("room.view")}
                </Link>
                <Link
                  href={`/clubs/${clubId}/rooms/${r.id}/edit`}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-center text-sm text-slate-300 hover:bg-slate-800"
                >
                  {t("common.edit")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        placeholder="0"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
      />
    </label>
  );
}
```

- [ ] **Step 2: Manual verification**

Open a club, confirm the room list loads, create a new room, confirm it appears without a full page reload.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clubs/[clubId]/page.tsx"
git commit -m "Migrate club detail page to TanStack Query"
```

---

### Task 4: `/clubs/[clubId]/customers` — list + add-customer mutation

**Files:**
- Modify: `src/app/clubs/[clubId]/customers/page.tsx`

- [ ] **Step 1: Convert**

Full file, after:

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Customer = { id: string; name: string; phone: string | null; balance: number; bonusPoints: number };

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  return res.json();
}

async function createCustomer(clubId: string, values: { name: string; phone: string }) {
  const res = await fetch(`/api/clubs/${clubId}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST customer failed: ${res.status}`);
  return res.json();
}

export default function CustomersPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const {
    data: customers = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["customers", clubId], queryFn: () => fetchCustomers(clubId) });

  const addMutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) => createCustomer(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      setName("");
      setPhone("");
    },
  });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate({ name, phone });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-white">{t("customers.title")}</h1>

      <form onSubmit={add} className="mb-6 flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("customers.name")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("customers.phone")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button
          disabled={addMutation.isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          +
        </button>
      </form>

      {isError ? (
        <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
          {t("common.error")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t("customers.name")}</th>
                <th className="px-4 py-3 font-medium">{t("customers.phone")}</th>
                <th className="px-4 py-3 font-medium">{t("customers.balance")}</th>
                <th className="px-4 py-3 font-medium">{t("customers.bonus")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    {t("customers.empty")}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-white">{c.name}</td>
                    <td className="px-4 py-3 text-slate-300">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatMoney(c.balance)} {t("common.currency")}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.bonusPoints}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Open a club's customers page, confirm the list loads, add a customer, confirm it appears in the table.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clubs/[clubId]/customers/page.tsx"
git commit -m "Migrate customers page to TanStack Query"
```

---

### Task 5: `/clubs/[clubId]/reports` — GET only

**Files:**
- Modify: `src/app/clubs/[clubId]/reports/page.tsx`

- [ ] **Step 1: Convert**

Full file, after:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Report = {
  revenueToday: number;
  sessionsToday: number;
  avgCheck: number;
  recent: {
    id: string;
    station: string;
    tariffKind: string;
    customerName: string | null;
    endedAt: string | null;
    cost: number;
  }[];
};

async function fetchReport(clubId: string): Promise<Report> {
  const res = await fetch(`/api/clubs/${clubId}/reports`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET reports failed: ${res.status}`);
  return res.json();
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();

  const {
    data: report,
    isLoading,
    isError,
  } = useQuery({ queryKey: ["reports", clubId], queryFn: () => fetchReport(clubId) });

  if (isLoading) return <div className="text-slate-400">{t("common.loading")}</div>;
  if (isError || !report) {
    return (
      <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
        {t("common.error")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-white">{t("reports.title")}</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label={t("reports.revenueToday")}>
          {formatMoney(report.revenueToday)} {t("common.currency")}
        </Card>
        <Card label={t("reports.sessionsToday")}>{report.sessionsToday}</Card>
        <Card label={t("reports.avgCheck")}>
          {formatMoney(report.avgCheck)} {t("common.currency")}
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-white">{t("reports.recent")}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">{t("reports.station")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.tariff")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.name")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.amount")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.when")}</th>
            </tr>
          </thead>
          <tbody>
            {report.recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {t("reports.empty")}
                </td>
              </tr>
            ) : (
              report.recent.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-white">{s.station}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {t(`tariff.${s.tariffKind}` as TranslationKey)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{s.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-emerald-300">
                    {formatMoney(s.cost)} {t("common.currency")}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.endedAt ? new Date(s.endedAt).toLocaleString(locale) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Open a club's reports page, confirm the numbers and recent-sessions table render as before.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clubs/[clubId]/reports/page.tsx"
git commit -m "Migrate reports page to TanStack Query"
```

---

### Task 6: Room view page + `BookingModal` — polling query, stop mutation, booking mutation

**Files:**
- Modify: `src/app/clubs/[clubId]/rooms/[roomId]/page.tsx`
- Modify: `src/components/room/BookingModal.tsx`

**Context:** the original room view page polled with `setInterval(load, 15000)` — TanStack Query's built-in `refetchInterval` option replaces that manual timer entirely. Booking (in `BookingModal`) and stopping a session both invalidate the `["room", roomId]` query on success so the floor plan reflects the change without a manual `load()` call.

- [ ] **Step 1: Convert the room view page**

Full file, after:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatDuration, formatMoney } from "@/lib/format";
import { StationMarker } from "@/components/room/StationMarker";
import { BookingModal } from "@/components/room/BookingModal";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

async function fetchRoom(roomId: string): Promise<RoomDTO> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
  return res.json();
}

async function stopSession(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`POST stop failed: ${res.status}`);
  return res.json();
}

export default function RoomViewPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [booking, setBooking] = useState<StationDTO | null>(null);
  const [stopping, setStopping] = useState<StationDTO | null>(null);

  const { data: room, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => fetchRoom(roomId),
    refetchInterval: 15000,
  });

  const stopMutation = useMutation({
    mutationFn: stopSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      setStopping(null);
    },
  });

  function onSelect(s: StationDTO) {
    if (s.status === "BUSY") setStopping(s);
    else setBooking(s);
  }

  if (isLoading || !room) return <div className="text-slate-400">{t("common.loading")}</div>;

  const busy = room.stations.filter((s) => s.status === "BUSY").length;
  const free = room.stations.filter((s) => s.status === "FREE").length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <p className="text-sm text-slate-400">
            {room.club.name} · 🟢 {free} {t("room.free")} · 🔵 {busy} {t("room.busy")}
          </p>
        </div>
        <Link
          href={`/clubs/${clubId}/rooms/${roomId}/edit`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ✏️ {t("room.edit")}
        </Link>
      </header>

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {room.stations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            {t("editor.emptyHint")}
          </div>
        ) : (
          room.stations.map((s) => (
            <StationMarker key={s.id} station={s} room={room} now={now} onSelect={onSelect} />
          ))
        )}
      </div>

      {booking && (
        <BookingModal
          room={room}
          station={booking}
          onClose={() => setBooking(null)}
          onBooked={() => {
            setBooking(null);
            queryClient.invalidateQueries({ queryKey: ["room", roomId] });
          }}
        />
      )}

      {stopping?.activeSession && (
        <StopModal
          station={stopping}
          room={room}
          now={now}
          onClose={() => setStopping(null)}
          onStop={() => stopMutation.mutate(stopping.activeSession!.id)}
        />
      )}
    </div>
  );
}

function StopModal({
  station,
  room,
  now,
  onClose,
  onStop,
}: {
  station: StationDTO;
  room: RoomDTO;
  now: number;
  onClose: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();
  const sess = station.activeSession!;
  const started = new Date(sess.startedAt).getTime();
  const cost =
    sess.tariffKind === "OPEN"
      ? Math.round(((now - started) / 3_600_000) * room.openHourlyRate)
      : sess.tariffKind === "HOUR_1"
      ? room.price1h
      : sess.tariffKind === "HOUR_3"
      ? room.price3h
      : room.price5h;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-white">{station.name}</h2>
        <div className="mb-4 text-sm text-slate-400">
          {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          {sess.customerName ? ` · 👤 ${sess.customerName}` : ""}
        </div>
        <div className="mb-5 flex justify-between rounded-lg bg-slate-950 p-3 text-sm">
          <span className="text-slate-400">{t("station.elapsed")}</span>
          <span className="font-mono text-white">{formatDuration(now - started)}</span>
        </div>
        <div className="mb-5 flex justify-between rounded-lg bg-slate-950 p-3">
          <span className="text-slate-400">{t("station.cost")}</span>
          <span className="text-lg font-bold text-emerald-300">
            {formatMoney(cost)} {t("common.currency")}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStop}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            {t("station.stop")}
          </button>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm text-slate-400 hover:text-white">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Convert `BookingModal`**

Full file, after:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { TARIFFS, fixedPrice, type TariffKind } from "@/lib/tariffs";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Customer = { id: string; name: string };

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  return res.json();
}

async function bookSession(values: { stationId: string; tariffKind: TariffKind; customerId?: string }) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST session failed: ${res.status}`);
  return res.json();
}

export function BookingModal({
  room,
  station,
  onClose,
  onBooked,
}: {
  room: RoomDTO;
  station: StationDTO;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [tariff, setTariff] = useState<TariffKind>("HOUR_1");
  const [customerId, setCustomerId] = useState("");

  // Same query key as the customers page ("customers", clubId) — TanStack
  // Query dedupes/shares this cache entry with that page automatically.
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", room.club.id],
    queryFn: () => fetchCustomers(room.club.id),
  });

  const bookMutation = useMutation({
    mutationFn: bookSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", room.id] });
      onBooked();
    },
  });

  function confirm() {
    bookMutation.mutate({
      stationId: station.id,
      tariffKind: tariff,
      customerId: customerId || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
          {t("booking.station")}
        </div>
        <h2 className="mb-5 text-xl font-bold text-white">
          {station.name} <span className="text-sm text-slate-400">· {station.type}</span>
        </h2>

        <div className="mb-2 text-sm font-medium text-slate-300">
          {t("booking.chooseTariff")}
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {TARIFFS.map(({ kind }) => {
            const price = fixedPrice(room, kind);
            const active = tariff === kind;
            return (
              <button
                key={kind}
                onClick={() => setTariff(kind)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-brand bg-brand/10"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="font-semibold text-white">
                  {t(`tariff.${kind}` as TranslationKey)}
                </div>
                <div className="text-sm text-emerald-300">
                  {price === null
                    ? `${formatMoney(room.openHourlyRate)} ${t("common.currency")}${t("common.perHour")}`
                    : `${formatMoney(price)} ${t("common.currency")}`}
                </div>
              </button>
            );
          })}
        </div>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            {t("booking.customer")}
          </span>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            <option value="">{t("booking.customerNone")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            onClick={confirm}
            disabled={bookMutation.isPending}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {t("booking.confirm")}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm text-slate-400 hover:text-white"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Open a room, confirm the floor plan loads and auto-refreshes; book a free station (confirm the customer dropdown populates and the station flips to busy without a manual refresh); stop a busy station (confirm it flips back to free).

- [ ] **Step 4: Commit**

```bash
git add "src/app/clubs/[clubId]/rooms/[roomId]/page.tsx" src/components/room/BookingModal.tsx
git commit -m "Migrate room view page and BookingModal to TanStack Query"
```

---

### Task 7: Room editor — query for initial load, mutations for every edit

**Files:**
- Modify: `src/app/clubs/[clubId]/rooms/[roomId]/edit/page.tsx`

**Context:** this page is different from the others — during a drag, the `stations` array is client-authoritative local state, not a direct reflection of server data (the same way it worked before this migration). `useQuery` replaces only the *initial* `load()` call; the query's data seeds local state exactly once via a `useEffect`, and none of the mutations below invalidate that query — doing so would risk a mid-drag refetch clobbering in-flight local edits. This is a deliberate difference from Task 6's room view page (which *does* invalidate on every mutation, because that page has no local-authoritative state to protect).

- [ ] **Step 1: Convert**

Full file, after:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type EditStation = { id: string; name: string; type: string; status: string; posX: number; posY: number };

type RoomEditData = { name: string; stations: EditStation[] };

async function fetchRoom(roomId: string): Promise<RoomEditData> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
  return res.json();
}

async function addStationRequest(
  roomId: string,
  values: { name: string; type: string; posX: number; posY: number }
) {
  const res = await fetch(`/api/rooms/${roomId}/stations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST station failed: ${res.status}`);
  return res.json();
}

async function patchStationRequest(stationId: string, patch: Partial<EditStation>) {
  const res = await fetch(`/api/stations/${stationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH station failed: ${res.status}`);
  return res.json();
}

async function deleteStationRequest(stationId: string) {
  const res = await fetch(`/api/stations/${stationId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE station failed: ${res.status}`);
}

async function saveLayoutRequest(roomId: string, positions: { id: string; posX: number; posY: number }[]) {
  const res = await fetch(`/api/rooms/${roomId}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions }),
  });
  if (!res.ok) throw new Error(`PUT layout failed: ${res.status}`);
  return res.json();
}

export default function RoomEditPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({ queryKey: ["room-edit", roomId], queryFn: () => fetchRoom(roomId) });

  const [stations, setStations] = useState<EditStation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PS5");

  // Seed local editable state from the query once it loads. Deliberately not
  // re-synced on every refetch — during a drag, `stations` is client-
  // authoritative (see the mutations below), and this query has no polling
  // and no invalidation, so this effect only ever fires once per room visit.
  useEffect(() => {
    if (data) setStations(data.stations);
  }, [data]);

  const roomName = data?.name ?? "";

  // Drag bookkeeping (refs so we don't re-render per mousemove).
  const drag = useRef<{ id: string; moved: boolean } | null>(null);

  function pointFromEvent(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current.moved = true;
    const { x, y } = pointFromEvent(e);
    setStations((prev) =>
      prev.map((s) => (s.id === drag.current!.id ? { ...s, posX: x, posY: y } : s))
    );
    setDirty(true);
    setSaveState("idle");
  }

  function onPointerUp(e: React.PointerEvent, id: string) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // A press without movement counts as a selection.
    if (drag.current && !drag.current.moved) setSelectedId(id);
    drag.current = null;
  }

  const addStationMutation = useMutation({
    mutationFn: (values: { name: string; type: string; posX: number; posY: number }) =>
      addStationRequest(roomId, values),
    onSuccess: (created: EditStation) => {
      setStations((prev) => [...prev, created]);
      setNewName("");
      setSelectedId(created.id);
    },
  });

  function addStation(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addStationMutation.mutate({ name: newName, type: newType, posX: 50, posY: 50 });
  }

  const patchStationMutation = useMutation({
    mutationFn: ({ stationId, patch }: { stationId: string; patch: Partial<EditStation> }) =>
      patchStationRequest(stationId, patch),
  });

  function patchSelected(patch: Partial<EditStation>) {
    if (!selectedId) return;
    setStations((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    patchStationMutation.mutate({ stationId: selectedId, patch });
  }

  const removeStationMutation = useMutation({
    mutationFn: deleteStationRequest,
    onSuccess: (_data, stationId) => {
      setStations((prev) => prev.filter((s) => s.id !== stationId));
      setSelectedId(null);
    },
  });

  function removeSelected() {
    if (!selectedId) return;
    removeStationMutation.mutate(selectedId);
  }

  const saveLayoutMutation = useMutation({
    mutationFn: () =>
      saveLayoutRequest(
        roomId,
        stations.map((s) => ({ id: s.id, posX: s.posX, posY: s.posY }))
      ),
    onSuccess: () => {
      setDirty(false);
      setSaveState("saved");
    },
  });

  function saveLayout() {
    setSaveState("saving");
    saveLayoutMutation.mutate();
  }

  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/clubs/${clubId}`} className="text-xs text-slate-400 hover:text-white">
            ← {roomName}
          </Link>
          <h1 className="text-2xl font-bold text-white">{t("editor.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/clubs/${clubId}/rooms/${roomId}`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t("room.view")}
          </Link>
          <button
            onClick={saveLayout}
            disabled={saveState === "saving"}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              dirty ? "bg-brand hover:bg-brand-dark" : "bg-slate-700"
            }`}
          >
            {saveState === "saving"
              ? t("editor.saving")
              : saveState === "saved" && !dirty
              ? `✓ ${t("editor.saved")}`
              : t("editor.save")}
          </button>
        </div>
      </header>

      <form onSubmit={addStation} className="mb-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("editor.stationName")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        >
          <option value="PS5">PS5</option>
          <option value="PS4">PS4</option>
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          + {t("editor.addStation")}
        </button>
      </form>

      <p className="mb-2 text-xs text-slate-500">{t("editor.hint")}</p>

      <div className="flex gap-4">
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          className="relative aspect-[16/9] flex-1 touch-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {stations.length === 0 && (
            <div className="flex h-full items-center justify-center text-slate-500">
              {t("editor.emptyHint")}
            </div>
          )}
          {stations.map((s) => (
            <div
              key={s.id}
              onPointerDown={(e) => onPointerDown(e, s.id)}
              onPointerUp={(e) => onPointerUp(e, s.id)}
              style={{ left: `${s.posX}%`, top: `${s.posY}%` }}
              className={`absolute w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border-2 bg-slate-800 p-2 text-center shadow-lg active:cursor-grabbing ${
                selectedId === s.id ? "border-brand" : "border-slate-600"
              }`}
            >
              <div className="truncate text-xs font-semibold text-white">{s.name}</div>
              <div className="text-[10px] text-slate-400">{s.type}</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-white">{selected.name}</div>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-slate-400">{t("editor.stationName")}</span>
              <input
                value={selected.name}
                onChange={(e) => patchSelected({ name: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs text-slate-400">{t("editor.type")}</span>
              <select
                value={selected.type}
                onChange={(e) => patchSelected({ type: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              >
                <option value="PS5">PS5</option>
                <option value="PS4">PS4</option>
              </select>
            </label>
            <button
              onClick={removeSelected}
              className="w-full rounded-lg border border-rose-700 py-2 text-sm text-rose-400 hover:bg-rose-950"
            >
              {t("editor.remove")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Open a room's editor, confirm existing stations load at their saved positions; drag a station and confirm it moves smoothly (no flicker/snap-back — this is the behavior most at risk from this migration); add a station; rename the selected station and change its type; remove a station; click "Save layout" and reload the page to confirm positions persisted.

- [ ] **Step 3: Commit**

```bash
git add "src/app/clubs/[clubId]/rooms/[roomId]/edit/page.tsx"
git commit -m "Migrate room editor to TanStack Query"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0.

- [ ] **Step 2: Full manual pass**

Repeat the golden path end-to-end: sign in → `/clubs` → open a club → create a room → open the room → book a station → stop the session → edit the room's layout (drag, add, rename, remove, save) → customers → reports. Confirm every page behaves the same as it did before this migration, just without full-page reloads on mutations.

- [ ] **Step 3: Commit (only if Step 1 or 2 surfaced fixes)**

```bash
git add -A
git commit -m "Fix issues found during TanStack Query migration verification"
```

---

## Definition of done

- No page under `src/app` uses `useEffect` + manual `fetch` for data loading — every read is a `useQuery`, every write is a `useMutation`.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` all exit 0.
- The full manual pass in Task 8 behaves identically to pre-migration behavior.

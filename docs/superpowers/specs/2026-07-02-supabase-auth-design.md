# Supabase Auth for ps-crm

Date: 2026-07-02
Status: Approved for planning

## Context

ps-crm is a multi-tenant PlayStation-club CRM (Next.js + Prisma + Postgres/Supabase). The data model is already multi-tenant (`Tenant` owns `Room`, `Station`, `Customer`, `Session`), but there is currently no authentication at all: every page and every route under `src/app/api/**` is open to anyone, and `/clubs` lists every tenant in the database to any visitor.

This spec covers adding Supabase Auth so that:
- only invited people can sign in
- each person sees and can act on only the club(s) they belong to
- the operator (you) can create clubs and invite members without a public sign-up surface

## Decisions

These were confirmed with the user before design:

- **Sign-up model: invite-only.** No public sign-up page. New clubs and new members are created by the operator via an admin page.
- **User-tenant mapping: many-to-many via a `Membership` table.** One person can belong to multiple clubs; one club can have multiple members. Chosen over a single `tenantId`-on-user model because it costs little now and the alternative is expensive to retrofit later.
- **Roles: flat access for v1.** Every member of a tenant has full access to that tenant's data. `Membership.role` exists as a column (default `"member"`) but nothing branches on it yet — reserved for a future permission tier without a schema migration.
- **Invite mechanism: minimal `/admin` page.** Restricted to the operator's email. Creates clubs and invites members (calls Supabase's admin `inviteUserByEmail`), rather than leaving this as a fully manual (Supabase-dashboard + hand-written SQL) process.
- **Login method: email + password.** The invite email lets a new member set a password (Supabase's standard invite flow); daily login is a normal email/password form. Chosen over magic-link/OTP-only for front-desk convenience — no need to check email every login.

## Data model

One new Prisma model. No `User` table — Supabase's `auth.users` (a separate Postgres schema Prisma doesn't manage) is the identity source of truth; `Membership.userId` stores that user's UUID as a plain string, not a Prisma-level foreign key.

```prisma
model Membership {
  id        String   @id @default(cuid())
  userId    String   // Supabase auth.users.id
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId  String
  role      String   @default("member") // unused for now, reserved for later permission tiers
  createdAt DateTime @default(now())

  @@unique([userId, tenantId])
  @@index([userId])
  @@index([tenantId])
}
```

`Tenant` gains a `memberships Membership[]` back-relation.

## Session & route protection

Two layers, deliberately not collapsed into one:

1. **`middleware.ts` (global, "are you logged in at all")** — refreshes the Supabase session on every request via `supabase.auth.getUser()` (never trust `getSession()` in server code — it doesn't revalidate) and redirects to `/login` if there's no user. Exempts `/login` and `/auth/*`. This is the layer that can't be forgotten, because it's not opt-in per route.

2. **`requireMembership(tenantId)` helper (per-route, "do you belong to *this* club")** — a plain server-side function: given the current session user and a `tenantId`, queries `Membership`, throws/returns 401 if there's no session, 403 if there's a session but no matching membership. Called at the top of every `/api/clubs/[clubId]/**` route handler and every clubId-scoped server component page.

Rejected alternatives:
- **All-in-middleware** (parse `clubId` out of the URL, check membership before the request reaches a route): one choke point, but Prisma/Postgres queries inside Next's Edge middleware runtime are awkward, and it couples the check tightly to URL shape.
- **No middleware, checks only at each page/route**: simplest to write once, but on an app with 6+ pages already (and growing), a missed check on a new route silently leaves it open. Rejected specifically because the point of this work is maintainability.

### Effect on existing pages

`/clubs` becomes a server component: reads the session user, looks up their `Membership` rows, lists only those tenants. The current "show every tenant to anyone" behavior and the public "Create club" form both go away from this page — tenant creation moves to `/admin`.

## Admin & invite flow

`/admin`: a page + server actions, gated by `session.user.email === process.env.ADMIN_EMAIL` (separate, stricter check than the general login gate). Two actions:

- **Create a club** — the `Tenant`-creation logic that currently lives on the public `/clubs` page, moved here.
- **Invite a member** — takes an email + a club, calls `supabaseAdmin.auth.admin.inviteUserByEmail()` using the Supabase **service-role key** (server-only, never sent to the browser) which creates the auth user and emails them a set-password link. On success, immediately creates the matching `Membership` row.

### New environment variables (prerequisite, operator-provided)

From Supabase dashboard → Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — must never be exposed to client code or committed)

These must be added to `.env` before implementation of the admin/invite flow can be verified end-to-end.

## Login / logout UX

- **`/login`** — email + password form. Calls `supabase.auth.signInWithPassword()`. On success, redirect to `/clubs`. On failure, inline error state (same pattern as the `/clubs` data-loading error fix already shipped) rather than a crash.
- **`/auth/callback`** — handles the link from the invite email: exchanges the token for a session, forwards to `/set-password`.
- **`/set-password`** — new member sets their password via `supabase.auth.updateUser({ password })`, then redirects to `/clubs`.
- **Sidebar** — gets a sign-out button (`supabase.auth.signOut()` → redirect to `/login`).

## Error handling

Three distinct failure classes, each surfaced explicitly:

1. **Not logged in** → middleware redirect to `/login`. No error UI needed on the page itself.
2. **Logged in, not a member of the requested club** → API routes return `403` with a JSON body; pages show a "not found / no access" state. Deliberately phrased as not-found rather than forbidden, so the UI doesn't confirm or deny that a given club ID exists to someone without access.
3. **Supabase itself unreachable** (network/config failure) → same graceful error-state pattern as the existing `/clubs` fix (`try/catch` → real error state), never an unhandled crash.

## Testing strategy

Vitest + React Testing Library (new infra, part of the broader implementation plan).

- **`requireMembership()`** is a plain function against Prisma — directly unit-testable with no Supabase mocking: member → passes, authenticated non-member → 403, no session → 401.
- **Login form** — component test with the Supabase client mocked at the network boundary (the one unavoidable mock in this design): submit → calls `signInWithPassword` → renders the error state on rejection.
- **API route membership checks** — exercised by calling `requireMembership()`'s denial paths directly, rather than standing up a real Supabase session in tests.

## Out of scope for this pass

- Role-based permissions beyond the reserved `role` column (no enforcement logic yet).
- Public self-serve sign-up.
- Password reset flow (not requested; can reuse the same `/auth/callback` + `/set-password` pattern later if needed).
- OAuth / social login.

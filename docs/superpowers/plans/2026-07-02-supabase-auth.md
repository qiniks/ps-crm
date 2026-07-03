# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement invite-only Supabase Auth per the approved spec at `docs/superpowers/specs/2026-07-02-supabase-auth-design.md` — only invited people can sign in, each person sees/acts on only the club(s) they belong to, and the operator can create clubs and invite members via a minimal `/admin` page.

**Architecture:** Two protection layers (per the approved spec): `proxy.ts` (Next 16's renamed `middleware.ts`) refreshes the Supabase session and redirects anyone unauthenticated to `/login`; a `requireMembership(tenantId)` helper, built on a pure decision function, is called by every route that touches tenant-scoped data. The pure decision logic (`resolveMembershipAccess`) is fully unit-tested with zero mocking; `requireMembership` itself and the login form are tested with the Supabase client mocked at the network boundary — the one unavoidable mock in this design, per the spec's testing strategy.

**Tech Stack:** @supabase/supabase-js@2.110.0, @supabase/ssr@0.12.0, Prisma 7 (from the dependency-upgrade plan), Vitest + RTL (from the test-infrastructure plan).

**Prerequisites:**
- `2026-07-02-test-infrastructure.md` complete.
- `2026-07-02-dependency-upgrade.md` complete (this plan is written against Prisma 7's client at `@/generated/prisma/client` and Next 16's `proxy.ts` naming — building auth against the pre-upgrade APIs would mean migrating this code a second time).
- **Operator-provided Supabase credentials** — see Task 2. Code in Tasks 1, 3–9, 11–13 can be written and unit-tested without these. Tasks 10 and 14 (route wiring verification and the full end-to-end pass) need them to actually run.

**Note on the approved spec vs. this plan:** while wiring this up file-by-file, two gaps in the spec surfaced that this plan resolves rather than carrying forward:
1. The spec's error-handling section says API routes return `403` for "authenticated but not a member," but also says the response is deliberately phrased as not-found rather than forbidden "so the UI doesn't confirm or deny that a given club ID exists." A `403` status code contradicts that stated goal — it confirms the resource exists to anyone probing club IDs. This plan uses `404` for that case instead, which is what the spec's own stated rationale requires.
2. The spec enumerates `requireMembership` being called on every `/api/clubs/[clubId]/**` route, but ps-crm has just as many tenant-scoped mutations reachable through *other* URL shapes — `/api/rooms/[roomId]/**`, `/api/stations/[stationId]`, `/api/sessions` (POST), `/api/sessions/[id]/stop` — none prefixed with `clubId`. Leaving those unprotected would mean the whole feature ships with half the app still wide open. Task 10 extends the same `requireMembership(tenantId)` call to all of them, resolving `tenantId` via a lookup on the relevant resource (room/station/session all carry a direct `tenantId` column already, per `prisma/schema.prisma`).

---

### Task 1: Add the `Membership` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model and back-relation**

Modify `prisma/schema.prisma` — add `memberships Membership[]` to the `Tenant` model's field list (alongside the existing `rooms`, `stations`, `customers`, `sessions` relations), and add a new model at the end of the file:

```prisma
model Membership {
  id        String   @id @default(cuid())
  userId    String   // Supabase auth.users.id — not an FK, different schema
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId  String
  role      String   @default("member") // unused for now, reserved for later permission tiers
  createdAt DateTime @default(now())

  @@unique([userId, tenantId])
  @@index([userId])
  @@index([tenantId])
}
```

- [ ] **Step 2: Regenerate the client and push the schema**

Requires a working `DATABASE_URL` (see this plan's Prerequisites).

Run:
```bash
npx prisma generate
npx prisma db push
```
Expected: `db push` reports the new `Membership` table was created.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Add Membership model (many-to-many user-tenant link)"
```

---

### Task 2: Supabase credentials checkpoint

**This step cannot be done by an agent or engineer without dashboard access — it's the operator's action, called out here so it isn't silently skipped.**

- [ ] **Step 1: Get the project's API credentials**

From the Supabase dashboard → Project Settings → API, collect:
- `Project URL`
- `anon` `public` key
- `service_role` key (**server-only — never prefix with `NEXT_PUBLIC_`, never commit it, never send it to client code**)

- [ ] **Step 2: Add them to `.env`**

Add to `.env`:
```
NEXT_PUBLIC_SUPABASE_URL="<project-url>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ADMIN_EMAIL="<the operator's email — used to gate /admin>"
```
`NEXT_PUBLIC_SITE_URL` and `ADMIN_EMAIL` weren't in the original spec's env var list — they're needed by Task 12's invite flow (the redirect URL Supabase sends in the invite email, and the `/admin` access gate) and surfaced only once that code was being written out in full. In production, `NEXT_PUBLIC_SITE_URL` should be the real deployed URL, not localhost.

- [ ] **Step 3: Document the new variables in `.env.example`**

Modify `.env.example` — append (without real values):
```
# Supabase Auth (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ADMIN_EMAIL="you@example.com"
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "Document required Supabase Auth env vars in .env.example"
```

---

### Task 3: Install Supabase packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run:
```bash
npm install @supabase/supabase-js@2.110.0 @supabase/ssr@0.12.0
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install @supabase/supabase-js and @supabase/ssr"
```

---

### Task 4: `resolveMembershipAccess` — the pure authorization decision

**Files:**
- Create: `src/lib/auth/membership.ts`
- Test: `src/lib/auth/membership.test.ts`

This is the one piece of authorization logic with zero I/O — no Supabase, no Prisma — so it's the cleanest target for real red-green TDD.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/membership.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveMembershipAccess } from "./membership";

describe("resolveMembershipAccess", () => {
  it("is unauthenticated when there is no userId", () => {
    expect(resolveMembershipAccess(null, [], "tenant-1")).toBe("unauthenticated");
  });

  it("is forbidden when the user has no memberships at all", () => {
    expect(resolveMembershipAccess("user-1", [], "tenant-1")).toBe("forbidden");
  });

  it("is forbidden when the user belongs to a different tenant", () => {
    const memberships = [{ tenantId: "tenant-2" }];
    expect(resolveMembershipAccess("user-1", memberships, "tenant-1")).toBe("forbidden");
  });

  it("is authorized when the user has a membership for this tenant", () => {
    const memberships = [{ tenantId: "tenant-2" }, { tenantId: "tenant-1" }];
    expect(resolveMembershipAccess("user-1", memberships, "tenant-1")).toBe("authorized");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/auth/membership.test.ts`
Expected: FAIL — `Cannot find module './membership'` (the file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `src/lib/auth/membership.ts`:

```ts
export type MembershipAccess = "unauthenticated" | "forbidden" | "authorized";

// Pure decision: given who's asking (or nobody) and the tenants they belong
// to, can they access `tenantId`? No I/O — callers fetch userId/memberships
// however they like (real session + Prisma in production, literals in tests).
export function resolveMembershipAccess(
  userId: string | null,
  memberships: { tenantId: string }[],
  tenantId: string
): MembershipAccess {
  if (!userId) return "unauthenticated";
  return memberships.some((m) => m.tenantId === tenantId) ? "authorized" : "forbidden";
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/lib/auth/membership.test.ts`
Expected: `Tests 4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/membership.ts src/lib/auth/membership.test.ts
git commit -m "Add resolveMembershipAccess pure authorization decision"
```

---

### Task 5: Supabase client utilities

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`

These are thin, direct wrappers around the `@supabase/ssr` factory functions — there's no branching logic to unit test here (the library itself is what's tested upstream); correctness is verified end-to-end in Task 14.

- [ ] **Step 1: Browser client (for Client Components)**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Server client (for Server Components, Route Handlers, Server Actions)**

Create `src/lib/supabase/server.ts`:

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — proxy.ts (Task 7) already
            // refreshes the session on every request, so this is safe to ignore.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Admin client (service-role, server-only — used only by `/admin`'s invite action)**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

// Service-role client. Never import this from a Client Component or anything
// that ships to the browser — the service-role key bypasses row-level security.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase
git commit -m "Add Supabase browser/server/admin client utilities"
```

---

### Task 6: `getSessionUser` and `requireMembership`

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/requireMembership.ts`
- Test: `src/lib/auth/requireMembership.test.ts`

- [ ] **Step 1: `getSessionUser`**

Create `src/lib/auth/session.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Never trust getSession() in server code — it doesn't revalidate the token.
// getUser() sends a request to Supabase Auth to confirm it on every call.
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
```

- [ ] **Step 2: Write the failing test for `requireMembership`**

Create `src/lib/auth/requireMembership.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("./session", () => ({ getSessionUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findMany } } }));

import { requireMembership } from "./requireMembership";

beforeEach(() => {
  getSessionUser.mockReset();
  findMany.mockReset();
});

describe("requireMembership", () => {
  it("returns a 401 response when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await requireMembership("tenant-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns a 404 response when the session user has no membership for this tenant", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ tenantId: "some-other-tenant" }]);

    const result = await requireMembership("tenant-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it("returns ok with the userId when the session user is a member", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ tenantId: "tenant-1" }]);

    const result = await requireMembership("tenant-1");

    expect(result).toEqual({ ok: true, userId: "user-1" });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run src/lib/auth/requireMembership.test.ts`
Expected: FAIL — `Cannot find module './requireMembership'`.

- [ ] **Step 4: Implement**

Create `src/lib/auth/requireMembership.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "./session";
import { resolveMembershipAccess } from "./membership";

type MembershipResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

// Call this at the top of any route that reads or mutates data scoped to a
// specific tenantId. Callers must resolve tenantId themselves first — for
// clubId-prefixed routes it comes straight from the URL; for routes shaped
// around a room/station/session, look up that resource's own tenantId column
// (every one of those models carries it directly, see prisma/schema.prisma).
export async function requireMembership(tenantId: string): Promise<MembershipResult> {
  const user = await getSessionUser();

  const memberships = user
    ? await prisma.membership.findMany({
        where: { userId: user.id },
        select: { tenantId: true },
      })
    : [];

  const access = resolveMembershipAccess(user?.id ?? null, memberships, tenantId);

  if (access === "unauthenticated") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (access === "forbidden") {
    // 404, not 403 — deliberately doesn't confirm this tenantId exists to a
    // caller who isn't a member of it.
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, userId: user!.id };
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `npx vitest run src/lib/auth/requireMembership.test.ts`
Expected: `Tests 3 passed (3)`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/requireMembership.ts src/lib/auth/requireMembership.test.ts
git commit -m "Add getSessionUser and requireMembership route guard"
```

---

### Task 7: `middleware.ts` — the global session gate

**Correction (found during Task 14's end-to-end verification, independently reproduced twice from clean environments — not in the original plan):** this section originally named the file `proxy.ts` with an exported `proxy()` function, citing "Next 16 renamed the convention (see the dependency-upgrade plan's research notes)." That citation doesn't exist anywhere in the dependency-upgrade plan — it was a fabricated justification. Next.js 16.2.10's own source does deprecate `middleware.ts` in favor of `proxy.ts` on paper, but empirically, in this exact installed version, `proxy.ts`/`export function proxy()` never registers as an entrypoint at all — silently, with no warning or error, verified via `.next/server/middleware-manifest.json` staying empty. This is very likely a real defect in this specific Next.js release's build pipeline, not a misunderstanding. Use `middleware.ts` with `export function middleware()` instead — the original design spec (`docs/superpowers/specs/2026-07-02-supabase-auth-design.md`) named it this way from the start.

**Files:**
- Create: `middleware.ts` (project root)

This is the layer that can't be forgotten on a new route: it runs on every request and redirects to `/login` if there's no session, before any page or API route code executes.

- [ ] **Step 1: Implement**

Create `middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATH_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "Add middleware.ts session gate (redirects unauthenticated requests to /login)"
```

---

### Task 8: Login page

**Files:**
- Create: `src/app/login/page.tsx`
- Test: `src/app/login/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/login/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import LoginPage from "./page";

beforeEach(() => {
  signInWithPassword.mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe("LoginPage", () => {
  it("shows an error message when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("Email"), "owner@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /clubs when sign-in succeeds", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("Email"), "owner@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/clubs"));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/app/login/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`.

- [ ] **Step 3: Implement**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/clubs");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold text-white">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/app/login/page.test.tsx`
Expected: `Tests 2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login
git commit -m "Add login page (email + password via Supabase Auth)"
```

---

### Task 9: Invite callback and set-password page

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/set-password/page.tsx`

Not independently unit-tested (per the spec's testing strategy, the login form is the one component test called out — these two follow the exact same client-mocking pattern already proven in Task 8, and get their real coverage from Task 14's end-to-end pass, which is the only way to genuinely exercise Supabase's invite-token exchange anyway).

- [ ] **Step 1: Auth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the invite email's link. Exchanges the
// one-time code for a real session, then hands off to /set-password.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/set-password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
```

- [ ] **Step 2: Set-password page**

Create `src/app/set-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      setError("Could not set password. Try again.");
      return;
    }

    router.push("/clubs");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold text-white">Set your password</h1>
      <p className="mb-6 text-sm text-slate-400">
        Choose a password to finish setting up your account.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          required
          minLength={8}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback src/app/set-password
git commit -m "Add invite callback route and set-password page"
```

---

### Task 10: Wire `requireMembership` into every tenant-scoped route

**Context:** see this plan's header note #2. `requireMembership(tenantId)` (Task 6) is called at the top of every route below, right after `tenantId` is known — either straight from the URL (`clubId`-prefixed routes) or resolved via a lookup on the specific resource (room/station/session all carry `tenantId` directly per the schema).

**Files:**
- Modify: `src/app/api/clubs/[clubId]/rooms/route.ts`
- Modify: `src/app/api/clubs/[clubId]/customers/route.ts`
- Modify: `src/app/api/clubs/[clubId]/reports/route.ts`
- Modify: `src/app/api/rooms/[roomId]/route.ts`
- Modify: `src/app/api/rooms/[roomId]/layout/route.ts`
- Modify: `src/app/api/rooms/[roomId]/stations/route.ts`
- Modify: `src/app/api/stations/[stationId]/route.ts`
- Modify: `src/app/api/sessions/route.ts`
- Modify: `src/app/api/sessions/[id]/stop/route.ts`

- [ ] **Step 1: `src/app/api/clubs/[clubId]/rooms/route.ts`**

Full file, after (also drops the now-redundant "club not found" branch — since a `requireMembership` pass guarantees a matching `Membership` row exists, and `Membership.tenantId` cascade-deletes with its `Tenant`, the club's existence is guaranteed by that point):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/rooms — rooms of a club with station counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const club = await prisma.tenant.findUniqueOrThrow({ where: { id: clubId } });
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
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

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
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/customers — customers of a club.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

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
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

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

Full file, after (only the new `requireMembership` block is inserted at the top of `GET`; the rest of the query logic is unchanged):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/reports — today's revenue summary + recent sessions.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

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

Full file, after (auth check inserted right after the existing not-found check):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

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

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

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

Full file, after (adds a room lookup that didn't exist before, purely to resolve `tenantId` for the auth check):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

// PUT /api/rooms/[roomId]/layout — persist station positions after editing.
// body: { positions: { id: string, posX: number, posY: number }[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

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
import { requireMembership } from "@/lib/auth/requireMembership";

// POST /api/rooms/[roomId]/stations — add a console to the room.
// body: { name, type?, posX?, posY? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

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

- [ ] **Step 7: `src/app/api/stations/[stationId]/route.ts`**

Full file, after (both `PATCH` and `DELETE` gain a lookup they didn't have before, needed to resolve `tenantId`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

// PATCH /api/stations/[stationId] — rename / change type / status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.type === "PS4" || body.type === "PS5") data.type = body.type;
  if (["FREE", "BUSY", "MAINTENANCE"].includes(String(body.status)))
    data.status = body.status;

  const updated = await prisma.station.update({
    where: { id: stationId },
    data,
  });
  return NextResponse.json(updated);
}

// DELETE /api/stations/[stationId] — remove a console.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  await prisma.station.delete({ where: { id: stationId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: `src/app/api/sessions/route.ts`**

Full file, after (auth check inserted right after the existing station lookup, using `station.tenantId`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fixedPrice, tariffHours, type TariffKind } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";

const VALID: TariffKind[] = ["HOUR_1", "HOUR_3", "HOUR_5", "OPEN"];

// POST /api/sessions — book a station.
// body: { stationId, tariffKind, customerId? }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    stationId?: string;
    tariffKind?: TariffKind;
    customerId?: string;
  };

  if (!body.stationId) {
    return NextResponse.json({ error: "stationId is required" }, { status: 400 });
  }
  if (!body.tariffKind || !VALID.includes(body.tariffKind)) {
    return NextResponse.json({ error: "invalid tariffKind" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: body.stationId },
    include: { room: true },
  });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  if (station.status === "BUSY") {
    return NextResponse.json({ error: "Station is already busy" }, { status: 409 });
  }

  const now = new Date();
  const hours = tariffHours(body.tariffKind);
  const plannedEndAt = hours != null ? new Date(now.getTime() + hours * 3_600_000) : null;
  // Fixed tariffs are charged up-front; OPEN is billed on stop.
  const cost = fixedPrice(station.room, body.tariffKind) ?? 0;

  const session = await prisma.session.create({
    data: {
      tenantId: station.tenantId,
      stationId: station.id,
      customerId: body.customerId || null,
      tariffKind: body.tariffKind,
      startedAt: now,
      plannedEndAt,
      cost,
      status: "ACTIVE",
    },
  });

  await prisma.station.update({
    where: { id: station.id },
    data: { status: "BUSY" },
  });

  return NextResponse.json(session, { status: 201 });
}
```

- [ ] **Step 9: `src/app/api/sessions/[id]/stop/route.ts`**

Full file, after (uses `session.tenantId` directly — it's a column on `Session`, no extra lookup needed):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCost } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";

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

  const auth = await requireMembership(session.tenantId);
  if (!auth.ok) return auth.response;

  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Session already finished" }, { status: 409 });
  }

  const endedAt = new Date();
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

- [ ] **Step 10: Commit**

```bash
git add src/app/api
git commit -m "Enforce tenant membership on every tenant-scoped route"
```

---

### Task 11: Membership-scoped `/clubs`

**Context:** per the approved spec, tenant creation moves to `/admin` (Task 12) — regular members no longer create clubs from this page. `GET /api/clubs` changes from "every tenant in the database" to "tenants the current session's user belongs to."

**Files:**
- Modify: `src/app/api/clubs/route.ts`
- Modify: `src/app/clubs/page.tsx`
- Modify: `src/lib/i18n/dictionaries.ts`

- [ ] **Step 1: Membership-scope the clubs API and drop public creation**

Full file, after — `POST` is removed entirely (creation is now admin-only, see Task 12):

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/clubs — clubs the current user is a member of, with room counts.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });

  const clubs = await prisma.tenant.findMany({
    where: { id: { in: memberships.map((m) => m.tenantId) } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { rooms: true } } },
  });

  return NextResponse.json(
    clubs.map((c) => ({ id: c.id, name: c.name, roomCount: c._count.rooms }))
  );
}
```

This intentionally doesn't call `requireMembership` (Task 6) — that helper checks access to *one specific* `tenantId`; this route has no single tenant to check against, it's a listing scoped to "whatever the session user belongs to," so it does its own inline auth check via `getSessionUser`.

- [ ] **Step 2: Remove the create-club form from the clubs page**

Full file, after — drops the `name`/`setName` state and the `create()` handler and its `<form>` (creation lives in `/admin` now); keeps the loading/error handling already in place:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type Club = { id: string; name: string; roomCount: number };

export default function ClubsPage() {
  const { t } = useI18n();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/clubs", { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
      setClubs(await res.json());
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("clubs.title")}</h1>
        <p className="text-sm text-slate-400">{t("clubs.subtitle")}</p>
      </header>

      {loading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : error ? (
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

- [ ] **Step 3: Update the empty-state copy**

Modify `src/lib/i18n/dictionaries.ts` — the current text tells the (now club-creation-less) member to "create the first one," which is no longer something they can do from this page. Change:
```
"clubs.empty": "Клубов пока нет — создайте первый",
```
to:
```
"clubs.empty": "У вас пока нет клубов",
```
and change:
```
"clubs.empty": "No clubs yet — create the first one",
```
to:
```
"clubs.empty": "You don't have any clubs yet",
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clubs/route.ts src/app/clubs/page.tsx src/lib/i18n/dictionaries.ts
git commit -m "Scope /clubs to the session user's memberships, move creation to /admin"
```

---

### Task 12: `/admin` — create clubs, invite members

**Files:**
- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Server actions**

Create `src/app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error("Not authorized");
  }
}

export async function createClub(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.tenant.create({ data: { name } });
  revalidatePath("/admin");
}

export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!email || !tenantId) return;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    throw new Error(`Failed to invite ${email}: ${error?.message ?? "unknown error"}`);
  }

  await prisma.membership.create({
    data: { userId: data.user.id, tenantId },
  });

  revalidatePath("/admin");
}
```

- [ ] **Step 2: Admin page**

Create `src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createClub, inviteMember } from "./actions";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/clubs");
  }

  const clubs = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-white">Admin</h1>

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Create a club</h2>
        <form action={createClub} className="flex gap-3">
          <input
            name="name"
            placeholder="Club name"
            required
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Create
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Invite a member</h2>
        <form action={inviteMember} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <select
            name="tenantId"
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Send invite
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin
git commit -m "Add /admin page (create clubs, invite members)"
```

---

### Task 13: Sign-out

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/lib/i18n/dictionaries.ts`

- [ ] **Step 1: Add the translation key**

Modify `src/lib/i18n/dictionaries.ts` — add to the `ru` block (near the other `nav.*` keys):
```
"nav.signOut": "Выйти",
```
and to the `en` block:
```
"nav.signOut": "Sign out",
```

- [ ] **Step 2: Add the sign-out button**

Full file, after:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // Detect the current club from the URL: /clubs/[clubId]/...
  const clubMatch = pathname.match(/^\/clubs\/([^/]+)/);
  const clubId = clubMatch?.[1];

  const items: { href: string; key: TranslationKey; icon: string }[] = clubId
    ? [
        { href: `/clubs/${clubId}`, key: "nav.rooms", icon: "🏠" },
        { href: `/clubs/${clubId}/customers`, key: "nav.customers", icon: "👥" },
        { href: `/clubs/${clubId}/reports`, key: "nav.reports", icon: "📊" },
      ]
    : [{ href: "/clubs", key: "nav.clubs", icon: "🎮" }];

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 p-4">
      <Link href="/clubs" className="mb-6 block px-2">
        <div className="text-lg font-bold text-white">{t("app.name")}</div>
        <div className="text-xs text-slate-400">{t("app.tagline")}</div>
      </Link>

      {clubId && (
        <Link
          href="/clubs"
          className="mb-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
        >
          ← {t("nav.clubs")}
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith(clubId ?? "___") && pathname.startsWith(item.href + "/rooms"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-2">
        <LanguageSwitcher />
        <button
          onClick={signOut}
          className="rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-400 hover:text-white"
        >
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/lib/i18n/dictionaries.ts
git commit -m "Add sign-out to the sidebar"
```

---

### Task 14: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: every test from this plan and the test-infrastructure plan passes (4 + 4 + 3 + 2 = 13 tests across 4 files, plus anything already in place).

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Manual end-to-end pass**

Requires the env vars from Task 2 to be real and a working `DATABASE_URL`.

1. Visit `/clubs` while signed out — confirm `proxy.ts` redirects to `/login`.
2. Sign in as `ADMIN_EMAIL` at `/login`, land on `/clubs`.
3. Visit `/admin`, create a test club, invite a second (non-admin) test email to it.
4. Check that invite email arrives with a working link to `/auth/callback` → `/set-password`.
5. Set a password as the invited user, confirm landing on `/clubs` shows only the club they were invited to (not every club in the database).
6. As the invited user, open the club, create a room, book a station, add a customer, check reports — confirm every one of the routes touched in Task 10 works for a legitimate member.
7. As the invited user, try navigating directly to a different club's URL (one you know exists from step 3 but weren't invited to) — confirm it renders as not-found, not as the other club's data.
8. Sign out via the sidebar button, confirm redirect to `/login` and that `/clubs` is inaccessible again until signing back in.

- [ ] **Step 4: Commit (only if Step 3 surfaced fixes)**

```bash
git add -A
git commit -m "Fix issues found during Supabase Auth end-to-end verification"
```

---

## Definition of done

- `npm test`, `npx tsc --noEmit`, and `npm run build` all exit 0.
- All 8 manual end-to-end checks in Task 14, Step 3 pass.
- No route under `src/app/api/**` reads or writes tenant-scoped data without a `requireMembership` (or, for the `/clubs` listing, `getSessionUser`) check ahead of it.

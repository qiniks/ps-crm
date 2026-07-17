# Product Add-ons (Drinks/Snacks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let cashiers manage a per-club product catalog (drinks/snacks/etc.) with images and stock, and ring up standalone multi-item cart sales whose revenue counts toward shift cash reconciliation.

**Architecture:** Three new Prisma models (`Product`, `Sale`, `SaleLine`) alongside the existing `Session`/`Shift` models. Two new pure `src/lib` modules (`sales.ts` for cart math, `productImage.ts` for upload validation) carry the money/validation logic, tested in isolation. Four new/modified API routes handle catalog CRUD, image upload, and checkout. One new page (`/clubs/[clubId]/products`) renders the catalog grid + cart, following the exact structural pattern of the existing rooms page (`src/app/(dashboard)/clubs/[clubId]/page.tsx`).

**Tech Stack:** Next.js 16 App Router route handlers, Prisma 7 (`prisma db push`, no migrations dir), Supabase Storage via the existing service-role admin client, TanStack Query, shadcn/ui primitives already in the repo, Vitest.

## Global Constraints

- Money is stored as whole minor units (no decimals), matching `Room.price1h` etc. — see `src/lib/format.ts`.
- Every tenant-scoped route must call `requireMembership(tenantId)` before touching Prisma (`src/lib/auth/requireMembership.ts`). No OWNER-only gating anywhere in this feature — cashiers get full access, matching how Rooms/Sessions work today.
- Soft-delete via `archivedAt`, never hard-delete rows with sale/session history (`Room` is the existing precedent).
- `unitPrice`/`cost` on `SaleLine` are snapshotted at sale time from the server's own read of `Product.price` — never trust a client-sent price.
- Stock may go negative on sale — no floor check (per design decision, see spec).
- All new user-facing strings go into **both** `ru` and `en` in `src/lib/i18n/dictionaries.ts` — never hardcode UI text.
- `prisma/schema.prisma` and `supabase-setup.sql` must be kept in sync by hand (the latter is a manual mirror, not generated).
- Full spec: `docs/superpowers/specs/2026-07-17-product-addons-design.md`.

---

## Task 1: Prisma schema — `Product`, `Sale`, `SaleLine` models

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `supabase-setup.sql`

**Interfaces:**
- Produces: Prisma models `Product { id, tenantId, name, price, stock, imageUrl, createdAt, archivedAt }`, `Sale { id, tenantId, customerId, cost, paymentMethod, shiftId, createdAt, createdBy }`, `SaleLine { id, saleId, productId, quantity, unitPrice, cost }`. Every later task that imports `@/generated/prisma/client` relies on these exact field names.

- [ ] **Step 1: Add the three models to `prisma/schema.prisma`**

Append after the closing brace of the `AuditLog` model (end of file):

```prisma

// A sellable item (drink, snack, controller, etc.) besides console time.
// Tenant-scoped catalog managed by cashiers, not just owners.
model Product {
  id         String     @id @default(cuid())
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId   String
  name       String
  price      Int        @default(0) // whole minor units, like Room prices
  stock      Int        @default(0) // may go negative — sales don't block on insufficient stock
  imageUrl   String?
  createdAt  DateTime   @default(now())
  // Soft-delete marker, same pattern as Room.archivedAt: a product's sale
  // history (SaleLine) must survive even after it's discontinued.
  archivedAt DateTime?
  saleLines  SaleLine[]

  @@index([tenantId])
}

// One checkout: a single payment event (one paymentMethod, one optional
// customer, one shift) covering one or more product lines. Mirrors how a
// Session payment works, but for products instead of console time.
model Sale {
  id            String     @id @default(cuid())
  tenant        Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId      String
  customer      Customer?  @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerId    String?
  cost          Int // sum of line costs
  paymentMethod String // CASH | CARD | BALANCE
  shift         Shift?     @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  shiftId       String?
  createdAt     DateTime   @default(now())
  createdBy     String // email snapshot, same pattern as Shift.openedBy
  lines         SaleLine[]

  @@index([tenantId])
  @@index([shiftId])
}

// One product line within a Sale. unitPrice/cost are snapshotted at sale
// time so a later Product.price edit doesn't retroactively change historical
// sale totals (same reasoning as Session.cost being stored, not re-derived).
model SaleLine {
  id        String  @id @default(cuid())
  sale      Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  saleId    String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  unitPrice Int
  cost      Int

  @@index([saleId])
  @@index([productId])
}
```

- [ ] **Step 2: Add the reverse relation fields**

In the `Tenant` model, add two lines after `reservations Reservation[]` and before `memberships`:

```prisma
  products     Product[]
  sales        Sale[]
```

In the `Customer` model, add one line after `reservations Reservation[]`:

```prisma
  sales        Sale[]
```

In the `Shift` model, add one line after `sessions    Session[]`:

```prisma
  sales       Sale[]
```

- [ ] **Step 3: Generate the Prisma client and push the schema**

Run:
```bash
npx prisma generate
npm run db:push
```
Expected: `prisma generate` reports the client was generated to `src/generated/prisma` with no errors; `db:push` reports `Your database is now in sync with your Prisma schema` and lists the three new tables as created.

- [ ] **Step 4: Mirror the schema change into `supabase-setup.sql`**

This file is a hand-maintained SQL mirror of `schema.prisma` for one-shot Supabase setup (see its header comment) — it is not generated. Three edits:

First, add drop statements at the top, right after `DROP TABLE IF EXISTS "AuditLog" CASCADE;` (line 9):

```sql
DROP TABLE IF EXISTS "SaleLine" CASCADE;
DROP TABLE IF EXISTS "Sale" CASCADE;
DROP TABLE IF EXISTS "Product" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
```

(Replace the original single `DROP TABLE IF EXISTS "AuditLog" CASCADE;` line with this four-line block — `Sale`/`SaleLine` must drop before `AuditLog` isn't actually required by FK order here since none reference AuditLog, but keeping all four together at the top keeps the drop block readable.)

Second, add the three `CREATE TABLE` blocks right after the `AuditLog` table definition (after line 150, before the `-- CreateIndex` section):

```sql
-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "cost" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);
```

Third, add indexes and foreign keys. Append to the `-- CreateIndex` section (after the existing `AuditLog_createdAt_idx` line):

```sql
-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Sale_tenantId_idx" ON "Sale"("tenantId");

-- CreateIndex
CREATE INDEX "Sale_shiftId_idx" ON "Sale"("shiftId");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");
```

Append to the `-- AddForeignKey` section (after the existing `AuditLog_tenantId_fkey` line, before the demo-data block):

```sql
-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the generated Prisma client now exposes `prisma.product`, `prisma.sale`, `prisma.saleLine`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma supabase-setup.sql
git commit -m "Add Product/Sale/SaleLine schema for issue #21"
```

---

## Task 2: `src/lib/productImage.ts` — upload validation helpers

**Files:**
- Create: `src/lib/productImage.ts`
- Test: `src/lib/productImage.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports beyond none needed).
- Produces: `ALLOWED_IMAGE_TYPES: string[]`, `MAX_IMAGE_BYTES: number`, `isAllowedImageType(contentType: string): boolean`, `isAllowedImageSize(bytes: number): boolean`, `imageExtension(contentType: string): string | null`. Task 6 (upload route) imports all four.

- [ ] **Step 1: Write the failing test**

Create `src/lib/productImage.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageExtension,
  isAllowedImageSize,
  isAllowedImageType,
} from "./productImage";

describe("isAllowedImageType", () => {
  it("accepts jpeg, png and webp", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects other content types", () => {
    expect(isAllowedImageType("image/gif")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("")).toBe(false);
  });
});

describe("isAllowedImageSize", () => {
  it("accepts sizes at or under the limit", () => {
    expect(isAllowedImageSize(MAX_IMAGE_BYTES)).toBe(true);
    expect(isAllowedImageSize(1024)).toBe(true);
    expect(isAllowedImageSize(0)).toBe(true);
  });

  it("rejects sizes over the limit", () => {
    expect(isAllowedImageSize(MAX_IMAGE_BYTES + 1)).toBe(false);
  });
});

describe("imageExtension", () => {
  it("maps each allowed type to its extension", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/webp")).toBe("webp");
  });

  it("returns null for a disallowed type", () => {
    expect(imageExtension("image/gif")).toBeNull();
  });
});

describe("ALLOWED_IMAGE_TYPES", () => {
  it("lists exactly the three supported content types", () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/productImage.test.ts`
Expected: FAIL — `Cannot find module './productImage'`.

- [ ] **Step 3: Implement**

Create `src/lib/productImage.ts`:

```typescript
// Validation for product-photo uploads, shared by the upload route and its
// tests. Kept pure/tested here rather than inline in the route, same
// convention as tariffs.ts / reservations.ts / shifts.ts.

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function isAllowedImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

export function isAllowedImageSize(bytes: number): boolean {
  return bytes <= MAX_IMAGE_BYTES;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function imageExtension(contentType: string): string | null {
  return EXTENSION_BY_TYPE[contentType] ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/productImage.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productImage.ts src/lib/productImage.test.ts
git commit -m "Add product image upload validation helpers"
```

---

## Task 3: `src/lib/sales.ts` — cart line/total math

**Files:**
- Create: `src/lib/sales.ts`
- Test: `src/lib/sales.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `type CartItem = { productId: string; quantity: number }`, `type ProductPrice = { id: string; price: number }`, `type SaleLineResult = { productId: string; quantity: number; unitPrice: number; cost: number }`, `buildSaleLines(items: CartItem[], products: ProductPrice[]): SaleLineResult[]` (throws `Error` with message `"invalid-quantity"` or `"unknown-product"`), `saleTotal(lines: { cost: number }[]): number`. Task 7 (sales checkout route) imports all of these.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sales.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildSaleLines, saleTotal } from "./sales";

const PRODUCTS = [
  { id: "p1", price: 100 },
  { id: "p2", price: 250 },
];

describe("buildSaleLines", () => {
  it("builds a line per cart item with unit price and cost from the product list", () => {
    const lines = buildSaleLines(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      PRODUCTS
    );
    expect(lines).toEqual([
      { productId: "p1", quantity: 2, unitPrice: 100, cost: 200 },
      { productId: "p2", quantity: 1, unitPrice: 250, cost: 250 },
    ]);
  });

  it("uses the current product price argument, not any client-supplied price", () => {
    // Cart items never carry a price field at all — this test documents that
    // buildSaleLines only ever reads price from the `products` argument.
    const lines = buildSaleLines([{ productId: "p1", quantity: 1 }], PRODUCTS);
    expect(lines[0].unitPrice).toBe(100);
  });

  it("throws on a quantity of zero", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: 0 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws on a negative quantity", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: -1 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws on a non-integer quantity", () => {
    expect(() => buildSaleLines([{ productId: "p1", quantity: 1.5 }], PRODUCTS)).toThrow(
      "invalid-quantity"
    );
  });

  it("throws when a cart item references a product not in the given list", () => {
    expect(() => buildSaleLines([{ productId: "missing", quantity: 1 }], PRODUCTS)).toThrow(
      "unknown-product"
    );
  });

  it("returns an empty array for an empty cart", () => {
    expect(buildSaleLines([], PRODUCTS)).toEqual([]);
  });
});

describe("saleTotal", () => {
  it("sums line costs", () => {
    expect(saleTotal([{ cost: 200 }, { cost: 250 }])).toBe(450);
  });

  it("is 0 for no lines", () => {
    expect(saleTotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sales.test.ts`
Expected: FAIL — `Cannot find module './sales'`.

- [ ] **Step 3: Implement**

Create `src/lib/sales.ts`:

```typescript
// Cart -> sale-line math for a product quick-sale checkout, shared by the
// sales route and tested in isolation (same convention as tariffs.ts /
// reservations.ts). A checkout request is either fully valid or fully
// rejected — buildSaleLines throws rather than silently dropping a bad line.

export type CartItem = { productId: string; quantity: number };
export type ProductPrice = { id: string; price: number };
export type SaleLineResult = { productId: string; quantity: number; unitPrice: number; cost: number };

export function buildSaleLines(items: CartItem[], products: ProductPrice[]): SaleLineResult[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("invalid-quantity");
    }
    const product = byId.get(item.productId);
    if (!product) {
      throw new Error("unknown-product");
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.price,
      cost: product.price * item.quantity,
    };
  });
}

export function saleTotal(lines: { cost: number }[]): number {
  return lines.reduce((sum, l) => sum + l.cost, 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sales.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales.ts src/lib/sales.test.ts
git commit -m "Add pure cart-to-sale-line math for product checkout"
```

---

## Task 4: Regression tests — mixed session + sale payments in shift math

**Files:**
- Modify: `src/lib/shifts.test.ts`

**Interfaces:**
- Consumes: `expectedCash`, `paymentMethodBreakdown` from `./shifts` (unchanged signatures — both already accept `{cost, paymentMethod}[]`, so `Sale` rows are structurally compatible with `Session` rows for this purpose).
- Produces: nothing new — this task only adds test cases proving the shift routes (Task 8) can safely concatenate `sessions` and `sales` arrays before calling these functions.

- [ ] **Step 1: Add the failing-first test cases**

In `src/lib/shifts.test.ts`, add a new case inside the existing `describe("expectedCash", ...)` block (after the `"does not count balance payments..."` test, before its closing `});`):

```typescript
  it("treats session and sale payments the same way when concatenated", () => {
    const sessionPayments = [{ cost: 500, paymentMethod: "CASH" }];
    const salePayments = [
      { cost: 150, paymentMethod: "CASH" },
      { cost: 300, paymentMethod: "CARD" },
    ];
    expect(expectedCash(1000, [...sessionPayments, ...salePayments])).toBe(1650);
  });
```

And inside the existing `describe("paymentMethodBreakdown", ...)` block (after the last test, before its closing `});`):

```typescript
  it("combines session and sale payments into one breakdown", () => {
    const sessionPayments = [{ cost: 500, paymentMethod: "CASH" }];
    const salePayments = [{ cost: 150, paymentMethod: "CASH" }, { cost: 300, paymentMethod: "BALANCE" }];
    expect(paymentMethodBreakdown([...sessionPayments, ...salePayments])).toEqual({
      CASH: { count: 2, total: 650 },
      CARD: { count: 0, total: 0 },
      BALANCE: { count: 1, total: 300 },
    });
  });
```

These tests should already pass against the current, unmodified `shifts.ts` — this task exists to lock in that guarantee before Task 8 relies on it.

- [ ] **Step 2: Run the tests to verify they pass immediately**

Run: `npx vitest run src/lib/shifts.test.ts`
Expected: PASS, all tests including the 2 new ones (no implementation change needed — `expectedCash`/`paymentMethodBreakdown` are already generic over `{cost, paymentMethod}[]`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shifts.test.ts
git commit -m "Add regression tests for mixed session/sale payment arrays"
```

---

## Task 5: Product catalog CRUD API routes

**Files:**
- Create: `src/app/api/clubs/[clubId]/products/route.ts` (GET, POST)
- Create: `src/app/api/products/[productId]/route.ts` (PATCH, DELETE)

**Interfaces:**
- Consumes: `requireMembership` from `@/lib/auth/requireMembership`, `prisma` from `@/lib/prisma`.
- Produces: `GET /api/clubs/[clubId]/products` → `{ id, name, price, stock, imageUrl }[]`. `POST /api/clubs/[clubId]/products` body `{name, price, stock, imageUrl?}` → created `Product`, 201. `PATCH /api/products/[productId]` body any of `{name, price, stock, imageUrl, archived: false}` → updated `Product`. `DELETE /api/products/[productId]` → `{ok: true, archived: true}`. Task 11 (products page) calls all four.

- [ ] **Step 1: Create the club-scoped list/create route**

Create `src/app/api/clubs/[clubId]/products/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/products — active (non-archived) product catalog.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const products = await prisma.product.findMany({
    where: { tenantId: clubId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      imageUrl: p.imageUrl,
    }))
  );
}

// POST /api/clubs/[clubId]/products — add a catalog item.
// body: { name, price, stock, imageUrl? }
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
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  const product = await prisma.product.create({
    data: {
      tenantId: clubId,
      name,
      price: num(body.price),
      stock: num(body.stock),
      imageUrl,
    },
  });
  return NextResponse.json(product, { status: 201 });
}
```

- [ ] **Step 2: Create the single-product edit/archive route**

Create `src/app/api/products/[productId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// PATCH /api/products/[productId] — rename / reprice / restock / re-image,
// or restore an archived product via { archived: false }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const auth = await requireMembership(product.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.price !== undefined) data.price = num(body.price);
  if (body.stock !== undefined) data.stock = Math.round(Number(body.stock) || 0);
  if (body.imageUrl !== undefined) {
    data.imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  }
  // Restore path for an archived product — archiving itself goes through
  // DELETE below, same split as PATCH/DELETE /api/rooms/[roomId].
  if (body.archived === false) data.archivedAt = null;

  const updated = await prisma.product.update({ where: { id: productId }, data });
  return NextResponse.json(updated);
}

// DELETE /api/products/[productId] — archive a product (soft delete).
// Idempotent: archiving an already-archived product just returns it as-is.
// No "in progress" guard is needed (unlike Room, which blocks on a BUSY
// station) — a product has no analogous in-flight state.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const auth = await requireMembership(product.tenantId);
  if (!auth.ok) return auth.response;

  if (product.archivedAt) {
    return NextResponse.json({ ok: true, archived: true });
  }

  await prisma.product.update({ where: { id: productId }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true, archived: true });
}
```

Note: `PATCH` allows `stock` to go negative on purpose (uses `Math.round(Number(...) || 0)`, not the clamped-to-zero `num()` helper) — a manual stock correction (e.g. counting a loss) is a legitimate use, consistent with the "stock may go negative" design decision.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clubs/[clubId]/products/route.ts src/app/api/products/[productId]/route.ts
git commit -m "Add product catalog CRUD API routes"
```

---

## Task 6: Image upload route + Storage bucket setup docs

**Files:**
- Create: `src/app/api/clubs/[clubId]/products/upload-image/route.ts`
- Modify: `README.md`
- Modify: `supabase-setup.sql`

**Interfaces:**
- Consumes: `isAllowedImageType`, `isAllowedImageSize`, `imageExtension` from `@/lib/productImage` (Task 2), `createSupabaseAdminClient` from `@/lib/supabase/admin`, `requireMembership`.
- Produces: `POST /api/clubs/[clubId]/products/upload-image` (multipart `FormData`, field name `file`) → `{ url: string }`, 201. Task 11 (products page) calls this on file selection.

- [ ] **Step 1: Create the upload route**

Create `src/app/api/clubs/[clubId]/products/upload-image/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/auth/requireMembership";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { imageExtension, isAllowedImageSize, isAllowedImageType } from "@/lib/productImage";

export const dynamic = "force-dynamic";

const BUCKET = "product-images";

// POST /api/clubs/[clubId]/products/upload-image — upload a product photo.
// multipart/form-data with a single "file" field. Returns { url } (a public
// Storage URL) for the caller to include as Product.imageUrl on create/edit.
// Uses the service-role Storage client (src/lib/supabase/admin.ts) so no
// Storage RLS policy is needed — same trust model as createUser.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "unsupported-image-type" }, { status: 400 });
  }
  if (!isAllowedImageSize(file.size)) {
    return NextResponse.json({ error: "image-too-large" }, { status: 400 });
  }

  const ext = imageExtension(file.type);
  const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
  });
  if (error) {
    return NextResponse.json({ error: "upload-failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
```

- [ ] **Step 2: Document the one-time Storage bucket setup**

`prisma db push` only manages tables — Storage buckets are a separate, one-time manual step. Add a note to `supabase-setup.sql`'s header comment block (the comment at the top of the file, after the "Kept in sync by hand..." line):

```sql
-- Product photo uploads (see src/app/api/clubs/[clubId]/products/upload-image)
-- need a public Storage bucket named "product-images", created once via
-- Supabase Dashboard → Storage → New bucket → name "product-images",
-- "Public bucket" ON. This is a one-time manual step, not managed by this
-- SQL file or by `prisma db push` — Storage buckets aren't part of the
-- Postgres schema.
```

Add the same instruction to `README.md`. Find the Supabase setup section (search for the existing `supabase-setup.sql` mention) and add a new step right after it instructing the reader to create the `product-images` public bucket the same way, with the same one-line rationale (Storage buckets are separate from the SQL schema).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clubs/[clubId]/products/upload-image/route.ts README.md supabase-setup.sql
git commit -m "Add product image upload route and Storage bucket setup docs"
```

---

## Task 7: Sales checkout API route

**Files:**
- Create: `src/app/api/clubs/[clubId]/sales/route.ts`

**Interfaces:**
- Consumes: `buildSaleLines`, `saleTotal` from `@/lib/sales` (Task 3), `canPayFromBalance`, `isPaymentMethod` from `@/lib/shifts`, `requireMembership`, `getSessionUser` from `@/lib/auth/session`, `logAudit` from `@/lib/audit`.
- Produces: `POST /api/clubs/[clubId]/sales` body `{items: {productId, quantity}[], paymentMethod, customerId?}` → created `Sale` with `lines`, 201. Task 11 (products page cart) calls this on checkout.

- [ ] **Step 1: Create the route**

Create `src/app/api/clubs/[clubId]/sales/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { canPayFromBalance, isPaymentMethod } from "@/lib/shifts";
import { buildSaleLines, saleTotal, type CartItem } from "@/lib/sales";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Thrown inside the checkout transaction to short-circuit with a specific
// HTTP response — same pattern as StopError in the session-stop route.
class SaleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// POST /api/clubs/[clubId]/sales — check out a product cart.
// body: { items: {productId, quantity}[], paymentMethod, customerId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    items?: CartItem[];
    paymentMethod?: string;
    customerId?: string;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "cart is empty" }, { status: 400 });
  }

  const paymentMethod = body.paymentMethod ?? "CASH";
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "invalid paymentMethod" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { tenantId: clubId, id: { in: items.map((i) => i.productId) } },
    select: { id: true, price: true, stock: true },
  });

  let lines;
  try {
    lines = buildSaleLines(items, products);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid cart";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const cost = saleTotal(lines);

  const openShift = await prisma.shift.findFirst({
    where: { tenantId: clubId, status: "OPEN" },
    select: { id: true },
  });

  const user = await getSessionUser();

  try {
    const sale = await prisma.$transaction(async (tx) => {
      if (paymentMethod === "BALANCE") {
        if (!body.customerId) {
          throw new SaleError(400, "customerId is required to pay from balance");
        }
        const customer = await tx.customer.findUnique({
          where: { id: body.customerId },
          select: { balance: true },
        });
        if (!canPayFromBalance(customer, cost)) {
          throw new SaleError(400, "Insufficient balance");
        }
        await tx.customer.update({
          where: { id: body.customerId },
          data: { balance: { decrement: cost } },
        });
      }

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      return tx.sale.create({
        data: {
          tenantId: clubId,
          customerId: paymentMethod === "BALANCE" ? body.customerId : (body.customerId ?? null),
          cost,
          paymentMethod,
          shiftId: openShift?.id ?? null,
          createdBy: user?.email ?? "",
          lines: { create: lines },
        },
        include: { lines: true },
      });
    });

    await logAudit({
      tenantId: clubId,
      actorUserId: user?.id ?? auth.userId,
      actorEmail: user?.email ?? null,
      action: "sale.create",
      targetType: "Sale",
      targetId: sale.id,
      metadata: { cost, paymentMethod, lineCount: lines.length },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    if (err instanceof SaleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
```

Note: stock is decremented unconditionally (no floor check), matching the "stock may go negative" design decision — `Prisma`'s `decrement` will happily take `stock` below zero.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clubs/[clubId]/sales/route.ts
git commit -m "Add product cart checkout API route"
```

---

## Task 8: Shift routes — include product revenue in cash reconciliation

**Files:**
- Modify: `src/app/api/clubs/[clubId]/shifts/route.ts`
- Modify: `src/app/api/shifts/[shiftId]/close/route.ts`

**Interfaces:**
- Consumes: `expectedCash`, `paymentMethodBreakdown` from `@/lib/shifts` (unchanged, Task 4 already proved they handle concatenated arrays).
- Produces: both routes' JSON responses now reflect product-sale revenue in `expectedCash`/`difference`/`cashRevenue`/`cardRevenue`/`paymentBreakdown` — no response shape change, just correct totals. No other task depends on this one directly; it's a leaf change verified by the existing shift UI.

- [ ] **Step 1: Update `GET /api/clubs/[clubId]/shifts`**

In `src/app/api/clubs/[clubId]/shifts/route.ts`, change the `include` on the `shifts.findMany` call and the two places that read `shift.sessions`:

Replace:
```typescript
  const shifts = await prisma.shift.findMany({
    where: { tenantId: clubId },
    orderBy: { openedAt: "desc" },
    take: HISTORY_LIMIT + 1, // open shift (if any) rides along with history
    include: { sessions: { select: { cost: true, paymentMethod: true } } },
  });
```
with:
```typescript
  const shifts = await prisma.shift.findMany({
    where: { tenantId: clubId },
    orderBy: { openedAt: "desc" },
    take: HISTORY_LIMIT + 1, // open shift (if any) rides along with history
    include: {
      sessions: { select: { cost: true, paymentMethod: true } },
      sales: { select: { cost: true, paymentMethod: true } },
    },
  });
```

Replace the `serialize` function's body:
```typescript
  const serialize = (shift: (typeof shifts)[number]) => {
    const totals = totalsOf(shift.sessions);
    const expected = expectedCash(shift.openingCash, shift.sessions);
```
with:
```typescript
  const serialize = (shift: (typeof shifts)[number]) => {
    const payments = [...shift.sessions, ...shift.sales];
    const totals = totalsOf(payments);
    const expected = expectedCash(shift.openingCash, payments);
```

(`totalsOf`'s parameter type `{ cost: number; paymentMethod: string | null }[]` already matches both `Session` and `Sale` selections — no signature change needed there.)

- [ ] **Step 2: Update `POST /api/shifts/[shiftId]/close`**

In `src/app/api/shifts/[shiftId]/close/route.ts`, replace:
```typescript
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { sessions: { select: { cost: true, paymentMethod: true } } },
  });
```
with:
```typescript
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      sessions: { select: { cost: true, paymentMethod: true } },
      sales: { select: { cost: true, paymentMethod: true } },
    },
  });
```

Then replace the four `shift.sessions` usages after the shift is fetched:
```typescript
  const expected = expectedCash(shift.openingCash, shift.sessions);
```
with:
```typescript
  const payments = [...shift.sessions, ...shift.sales];
  const expected = expectedCash(shift.openingCash, payments);
```

and:
```typescript
  return NextResponse.json({
    ...updated,
    expectedCash: expected,
    difference: cashDifference(expected, closingCash),
    paymentBreakdown: paymentMethodBreakdown(shift.sessions),
    sessionsCount: shift.sessions.length,
  });
```
with:
```typescript
  return NextResponse.json({
    ...updated,
    expectedCash: expected,
    difference: cashDifference(expected, closingCash),
    paymentBreakdown: paymentMethodBreakdown(payments),
    sessionsCount: shift.sessions.length,
  });
```

(`sessionsCount` intentionally stays session-only — it's a session-count metric, not a payment-count metric; product-sale counts aren't surfaced in this response and that's fine, nothing in the UI reads a `salesCount` field.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all existing tests still pass (this task changes route handlers only, which have no existing unit tests, but must not break `shifts.test.ts` or anything else).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/clubs/[clubId]/shifts/route.ts src/app/api/shifts/[shiftId]/close/route.ts
git commit -m "Include product-sale revenue in shift cash reconciliation"
```

---

## Task 9: i18n keys

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts`

**Interfaces:**
- Produces: new `TranslationKey` values (the type is derived via `keyof typeof dictionaries.ru`, so adding keys to the `ru` block automatically extends the type — the `en` block must have the exact same key set or the `satisfies Record<Locale, Record<string, string>>` check still passes structurally, but every `ru` key must also exist in `en` for `t()` to work in English). Task 10 (Sidebar) and Task 11 (products page) call `t()` with these keys.

- [ ] **Step 1: Add the Russian keys**

In `src/lib/i18n/dictionaries.ts`, insert before the closing `},` of the `ru` block (i.e. right after the `"dateRange.to": "По",` line):

```typescript

    "nav.products": "Товары",
    "product.title": "Товары",
    "product.subtitle": "Каталог и продажа товаров",
    "product.add": "Добавить товар",
    "product.name": "Название",
    "product.price": "Цена",
    "product.stock": "Остаток",
    "product.image": "Фото",
    "product.uploadImage": "Загрузить фото",
    "product.uploading": "Загрузка фото…",
    "product.uploadFailed": "Не удалось загрузить фото",
    "product.edit": "Редактировать товар",
    "product.delete": "Удалить товар",
    "product.deleteConfirmTitle": "Удалить товар?",
    "product.deleteConfirmBody": "Товар исчезнет из каталога. История его продаж сохранится.",
    "product.archived": "Товар удалён",
    "product.empty": "В этом клубе пока нет товаров",
    "product.addToCart": "В корзину",
    "product.outOfStock": "Нет в наличии",
    "cart.title": "Корзина",
    "cart.empty": "Корзина пуста",
    "cart.customer": "Клиент",
    "cart.customerNone": "Без клиента",
    "cart.total": "Итого",
    "cart.checkout": "Оформить продажу",
    "cart.checkoutSuccess": "Продажа оформлена",
    "cart.checkoutFailed": "Не удалось оформить продажу",
```

- [ ] **Step 2: Add the matching English keys**

In the same file, insert before the closing `},` of the `en` block (i.e. right after the `"dateRange.to": "To",` line):

```typescript

    "nav.products": "Products",
    "product.title": "Products",
    "product.subtitle": "Catalog and product sales",
    "product.add": "Add product",
    "product.name": "Name",
    "product.price": "Price",
    "product.stock": "Stock",
    "product.image": "Photo",
    "product.uploadImage": "Upload photo",
    "product.uploading": "Uploading photo…",
    "product.uploadFailed": "Could not upload the photo",
    "product.edit": "Edit product",
    "product.delete": "Delete product",
    "product.deleteConfirmTitle": "Delete this product?",
    "product.deleteConfirmBody": "The product will disappear from the catalog. Its sale history is kept.",
    "product.archived": "Product deleted",
    "product.empty": "This club has no products yet",
    "product.addToCart": "Add to cart",
    "product.outOfStock": "Out of stock",
    "cart.title": "Cart",
    "cart.empty": "Cart is empty",
    "cart.customer": "Customer",
    "cart.customerNone": "No customer",
    "cart.total": "Total",
    "cart.checkout": "Check out",
    "cart.checkoutSuccess": "Sale completed",
    "cart.checkoutFailed": "Could not complete the sale",
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — confirms every `ru` key has a matching `en` key (a mismatch would surface as a type error anywhere `t()` is called with a key missing from one locale, since `TranslationKey` is derived from `ru` but `dictionaries` is checked against `Record<Locale, Record<string, string>>`... actually a missing `en` key would NOT be caught by that broad `Record<string,string>` check. Instead, manually diff the two key lists.)

Run this to manually verify the two locales have identical key sets:
```bash
node -e "
const { dictionaries } = require('./src/lib/i18n/dictionaries.ts');
" 2>&1 || true
```
Since that file is TypeScript (not directly requireable by plain Node), instead verify by eye: count keys added to `ru` (26: nav.products + 12 product.* + 2 deleteConfirm + archived... recount as listed above) and confirm the same 26 keys with the same names appear in the `en` block added in Step 2. Line-by-line, the `ru` and `en` blocks added above use identical keys in identical order — this is the actual check; there is no automated key-parity test in this codebase today.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "Add i18n keys for product catalog and cart checkout"
```

---

## Task 10: Sidebar navigation item

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `nav.products` key from Task 9.
- Produces: nothing consumed by later tasks — a leaf UI change.

- [ ] **Step 1: Add the Products nav item**

In `src/components/Sidebar.tsx`, add `IconPackage` to the icon import:

Replace:
```typescript
import {
  IconChartBar,
  IconChartHistogram,
  IconDeviceGamepad2,
  IconLogout,
  IconShieldLock,
  IconUserCog,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
```
with:
```typescript
import {
  IconChartBar,
  IconChartHistogram,
  IconDeviceGamepad2,
  IconLogout,
  IconPackage,
  IconShieldLock,
  IconUserCog,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
```

Then add the nav entry, right after Customers:
```typescript
  const items: { href: string; key: TranslationKey; icon: Icon }[] = clubId
    ? [
        { href: `/clubs/${clubId}`, key: "nav.rooms", icon: IconDeviceGamepad2 },
        { href: `/clubs/${clubId}/customers`, key: "nav.customers", icon: IconUsers },
        { href: `/clubs/${clubId}/products`, key: "nav.products", icon: IconPackage },
        { href: `/clubs/${clubId}/reports`, key: "nav.reports", icon: IconChartBar },
        { href: `/clubs/${clubId}/analytics`, key: "nav.analytics", icon: IconChartHistogram },
        { href: `/clubs/${clubId}/members`, key: "nav.members", icon: IconUserCog },
      ]
    : [{ href: "/clubs", key: "nav.clubs", icon: IconDeviceGamepad2 }];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "Add Products nav item to the sidebar"
```

---

## Task 11: Products page — catalog grid, create/edit dialog, cart checkout

**Files:**
- Create: `src/app/(dashboard)/clubs/[clubId]/products/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/clubs/[clubId]/products`, `PATCH/DELETE /api/products/[productId]`, `POST /api/clubs/[clubId]/products/upload-image`, `POST /api/clubs/[clubId]/sales` (Tasks 5–7), `PAYMENT_METHODS`/`canPayFromBalance`/`type PaymentMethod` from `@/lib/shifts`, `MAX_PAGE_SIZE` from `@/lib/listParams`, i18n keys from Task 9, `PageHeader`/`EmptyState`/`ErrorState` from `@/components/ui-patterns/*`, `Button`/`Card`/`Input`/`Label`/`Dialog*`/`Select*` from `@/components/ui/*`.
- Produces: the `/clubs/[clubId]/products` route the Task 10 nav link points to. Nothing else depends on this file.

This single file follows the exact structural pattern of the existing rooms page (`src/app/(dashboard)/clubs/[clubId]/page.tsx`: fetch-list + create dialog + delete-confirm dialog, all client-side with TanStack Query) plus the payment-method/balance-eligibility logic from `StopModal` in `src/app/(dashboard)/clubs/[clubId]/rooms/[roomId]/page.tsx`, and the customer-picker pattern from `src/components/room/BookingModal.tsx`. No new shared component files are introduced — this codebase's existing pages keep this amount of dialog/list logic inline rather than splitting into extra files (see the rooms page), so the products page follows suit.

- [ ] **Step 1: Create the page**

Create `src/app/(dashboard)/clubs/[clubId]/products/page.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconEdit, IconMinus, IconPackage, IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { MAX_PAGE_SIZE } from "@/lib/listParams";
import { canPayFromBalance, PAYMENT_METHODS, type PaymentMethod } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; price: number; stock: number; imageUrl: string | null };
type Customer = { id: string; name: string; balance: number };
type CartLine = { productId: string; name: string; unitPrice: number; quantity: number };

const NONE = "__none__";
const EMPTY_FORM = { name: "", price: "", stock: "", imageUrl: "" };

async function fetchProducts(clubId: string): Promise<Product[]> {
  const res = await fetch(`/api/clubs/${clubId}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET products failed: ${res.status}`);
  return res.json();
}

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers?pageSize=${MAX_PAGE_SIZE}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  const data = (await res.json()) as { items: Customer[] };
  return data.items;
}

async function saveProduct(clubId: string, editingId: string | null, values: typeof EMPTY_FORM) {
  const res = await fetch(editingId ? `/api/products/${editingId}` : `/api/clubs/${clubId}/products`, {
    method: editingId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`${editingId ? "PATCH" : "POST"} product failed: ${res.status}`);
  return res.json();
}

async function deleteProduct(productId: string) {
  const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE product failed: ${res.status}`);
  return res.json();
}

async function uploadProductImage(clubId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/clubs/${clubId}/products/upload-image`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `upload-image failed: ${res.status}`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

async function checkoutCart(
  clubId: string,
  values: { items: { productId: string; quantity: number }[]; paymentMethod: PaymentMethod; customerId?: string }
) {
  const res = await fetch(`/api/clubs/${clubId}/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `POST sales failed: ${res.status}`);
  }
  return res.json();
}

export default function ProductsPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customerId, setCustomerId] = useState(NONE);

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["products", clubId], queryFn: () => fetchProducts(clubId) });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "picker", clubId],
    queryFn: () => fetchCustomers(clubId),
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof EMPTY_FORM) => saveProduct(clubId, editing?.id ?? null, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error(t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => deleteProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      setPendingDelete(null);
      toast.success(t("product.archived"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const selectedCustomer = customerId === NONE ? null : customers.find((c) => c.id === customerId) ?? null;
  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const balanceEligible = canPayFromBalance(selectedCustomer, cartTotal);
  const effectiveMethod: PaymentMethod = paymentMethod === "BALANCE" && !balanceEligible ? "CASH" : paymentMethod;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutCart(clubId, {
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod: effectiveMethod,
        customerId: customerId === NONE ? undefined : customerId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shifts", clubId] });
      setCart([]);
      setCustomerId(NONE);
      setPaymentMethod("CASH");
      toast.success(t("cart.checkoutSuccess"));
    },
    onError: () => toast.error(t("cart.checkoutFailed")),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), imageUrl: p.imageUrl ?? "" });
    setDialogOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    saveMutation.mutate(form);
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(clubId, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      toast.error(t("product.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function addToCart(p: Product) {
    setCart((c) => {
      const existing = c.find((l) => l.productId === p.id);
      if (existing) {
        return c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...c, { productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("product.title")}
        subtitle={t("product.subtitle")}
        actions={<Button onClick={openCreate}>+ {t("product.add")}</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {isLoading ? (
            <div className="text-muted-foreground">{t("common.loading")}</div>
          ) : isError ? (
            <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
          ) : products.length === 0 ? (
            <EmptyState icon={<IconPackage className="h-8 w-8" />} message={t("product.empty")} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="flex flex-col p-4">
                  <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <IconPhoto className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-sm text-success">
                    {formatMoney(p.price)} {t("common.currency")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("product.stock")}: {p.stock}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" disabled={p.stock <= 0} onClick={() => addToCart(p)}>
                      {p.stock <= 0 ? t("product.outOfStock") : t("product.addToCart")}
                    </Button>
                    <Button size="icon" variant="outline" aria-label={t("product.edit")} onClick={() => openEdit(p)}>
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("product.delete")}
                      onClick={() => setPendingDelete(p)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit p-4">
          <div className="mb-3 font-semibold text-foreground">{t("cart.title")}</div>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((l) => (
                <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 text-foreground">{l.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-6 w-6"
                      onClick={() => changeQuantity(l.productId, -1)}
                    >
                      <IconMinus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center">{l.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-6 w-6"
                      onClick={() => changeQuantity(l.productId, 1)}
                    >
                      <IconPlus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="w-16 text-right text-muted-foreground">
                    {formatMoney(l.unitPrice * l.quantity)}
                  </span>
                </div>
              ))}

              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>{t("cart.total")}</span>
                <span>
                  {formatMoney(cartTotal)} {t("common.currency")}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("cart.customer")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("cart.customerNone")}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const disabled = m === "BALANCE" && !balanceEligible;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={effectiveMethod === m ? "default" : "outline"}
                      disabled={disabled}
                      className={cn(effectiveMethod !== m && "text-muted-foreground")}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {t(`payment.${m}` as TranslationKey)}
                    </Button>
                  );
                })}
              </div>

              <Button className="mt-2" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
                {t("cart.checkout")}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("product.edit") : t("product.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">{t("product.name")}</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">
                  {t("product.price")} ({t("common.currency")})
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-stock">{t("product.stock")}</Label>
                <Input
                  id="product-stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("product.image")}</Label>
              <div className="flex items-center gap-3">
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? t("product.uploading") : t("product.uploadImage")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onFileSelected}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saveMutation.isPending || uploading}>
                {editing ? t("common.save") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("product.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("product.deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (this task adds no new unit tests — it's a UI page verified end-to-end in Task 12 — but must not break anything existing).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/clubs/[clubId]/products/page.tsx"
git commit -m "Add products catalog page with cart checkout"
```

---

## Task 12: End-to-end verification

**Files:** none (manual verification only).

**Interfaces:**
- Consumes: the whole feature (Tasks 1–11).
- Produces: nothing — this is the final acceptance pass.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` with no build errors.

- [ ] **Step 2: Create the Storage bucket (if not already done)**

In the Supabase Dashboard for this project: Storage → New bucket → name `product-images` → toggle "Public bucket" on. (One-time step — see Task 6.)

- [ ] **Step 3: Walk the golden path in the browser**

1. Sign in, open a club, click "Products" in the sidebar → the empty state renders (`product.empty`).
2. Click "+ Add product", fill in name/price/stock, upload a photo, submit → the product appears in the grid with its photo, price, and stock.
3. Click "Add to cart" on the product → it appears in the cart panel with quantity 1 and the correct line total.
4. Increase the quantity with the `+` stepper → line total and cart total update.
5. Leave payment method on CASH (no customer selected), click "Check out" → success toast, cart clears, and the product's displayed stock decreases by the quantity sold.
6. Open a shift (if none is open) from the club home page, then repeat a small cash sale and confirm the shift card's expected-cash figure increases by the sale amount.
7. Edit the product (rename/reprice) → grid reflects the change immediately.
8. Delete the product → confirm dialog appears, confirming removes it from the grid (`product.archived` toast).
9. Switch the language switcher to English and repeat step 1–2 briefly → all new strings render in English, none show a raw translation key.

- [ ] **Step 4: Verify balance payment**

1. Create a customer with a positive balance (Customers page) if none exists.
2. Add a product to the cart, select that customer in the cart's customer picker, choose BALANCE as payment method (should be enabled), check out.
3. Confirm the customer's balance decreased by the sale total (Customers page) and the sale did **not** add to the shift's expected cash (CASH total unaffected, since BALANCE payments never touch the drawer — same rule as session payments).

- [ ] **Step 5: Verify insufficient-balance rejection**

1. Add a product priced above a customer's balance to the cart, select that customer, attempt BALANCE — the option should be disabled in the UI (mirrors `StopModal`'s `balanceEligible` logic) and checkout with CASH/CARD should still succeed normally.

If any step fails, return to the relevant task, fix the code, re-run its typecheck/tests, and re-verify from Step 3.

---

## Self-Review

**Spec coverage:**
- Data model (`Product`/`Sale`/`SaleLine`) → Task 1. ✅
- Image upload via Supabase Storage → Tasks 2, 6. ✅
- Cashier-accessible CRUD (create/edit/restock/archive) → Task 5 (no OWNER gate anywhere). ✅
- Standalone multi-item quick-sale cart with CASH/CARD/BALANCE → Tasks 3, 7, 11. ✅
- Shift cash-reconciliation includes product revenue → Tasks 4, 8. ✅
- i18n for all new strings → Task 9. ✅
- Nav entry → Task 10. ✅
- `supabase-setup.sql` kept in sync → Tasks 1, 6. ✅
- Explicitly out of scope (session-checkout attach, sale history view, Storage blob cleanup) → not implemented, matches spec's "Known follow-ups". ✅

**Placeholder scan:** no TBD/TODO markers; every code step has complete, runnable code; every test step has real assertions; commit messages are concrete.

**Type consistency:** `Product { id, name, price, stock, imageUrl }` used identically across Task 5 (route response), Task 7 (`products` query in the sales route selects `id, price, stock`), and Task 11 (`Product` type in the page). `CartItem { productId, quantity }` from Task 3's `sales.ts` matches the `items` field shape sent by Task 11 and consumed by Task 7. `PaymentMethod`/`PAYMENT_METHODS`/`canPayFromBalance` are reused unchanged from `src/lib/shifts.ts` everywhere (Tasks 7, 11) rather than redefined. `buildSaleLines`/`saleTotal` signatures defined in Task 3 are called with matching argument shapes in Task 7.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-17-product-addons.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
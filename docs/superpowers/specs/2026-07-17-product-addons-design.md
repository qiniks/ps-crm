# Product Add-ons (Drinks/Snacks) & Cashier-Managed Catalog

Implements [issue #21](https://github.com/qiniks/ps-crm/issues/21) (repo owner: qiniks).

## Motivation

The system only sells console time. Real PS clubs also sell drinks, snacks,
controllers, etc. This adds a small tenant-scoped product catalog that any
cashier (not just OWNER) can manage, plus a standalone quick-sale (POS-style
cart checkout) whose revenue flows into the same shift cash-reconciliation
math as session payments (`expectedCash()` in `src/lib/shifts.ts`).

## Scope for this pass

- Product catalog CRUD (create/edit/restock/archive), cashier-accessible.
- Real image upload via Supabase Storage (this app has no upload
  infrastructure today — this introduces the first one).
- Standalone multi-item quick-sale cart with CASH/CARD/BALANCE checkout.
- Shift cash-reconciliation includes product revenue.

**Explicitly out of scope for this pass** (can be a follow-up): attaching
products to an in-progress session's stop/checkout dialog. The issue asks for
both entry points; this pass ships the standalone quick-sale only. The data
model (`Sale.customerId`, nullable `shiftId`) doesn't preclude adding a
session-attach entry point later — it would just be another way to create a
`Sale`.

## Data model

Three new tables in `prisma/schema.prisma`, tenant-scoped, following existing
conventions (soft-delete via `archivedAt` like `Room`, money as whole minor
units, snapshot pricing at transaction time like `Session.cost`):

```prisma
model Product {
  id         String     @id @default(cuid())
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId   String
  name       String
  price      Int        @default(0)   // whole minor units, like Room prices
  stock      Int        @default(0)   // may go negative — no floor check on sale
  imageUrl   String?                  // Supabase Storage public URL
  createdAt  DateTime   @default(now())
  archivedAt DateTime?                // soft-delete, same pattern as Room
  saleLines  SaleLine[]

  @@index([tenantId])
}

model Sale {
  id            String     @id @default(cuid())
  tenant        Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId      String
  customer      Customer?  @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerId    String?
  cost          Int                      // sum of line costs
  paymentMethod String                   // CASH | CARD | BALANCE
  shift         Shift?     @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  shiftId       String?
  createdAt     DateTime   @default(now())
  createdBy     String                   // email snapshot, same pattern as Shift.openedBy
  lines         SaleLine[]

  @@index([tenantId])
  @@index([shiftId])
}

model SaleLine {
  id        String   @id @default(cuid())
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  saleId    String
  product   Product  @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  unitPrice Int      // snapshot of Product.price at sale time
  cost      Int      // unitPrice * quantity

  @@index([saleId])
  @@index([productId])
}
```

`Tenant`, `Customer`, and `Shift` models each need the reverse relation field
added (`products Product[]`, `sales Sale[]` on `Tenant`; `sales Sale[]` on
`Customer`; `sales Sale[]` on `Shift`).

Why `Sale`/`SaleLine` rather than one flat table: a cart checkout is one
payment event (one `paymentMethod`, one `customerId`, one `shiftId`) covering
N products — normalizing avoids repeating that on every line and gives a
natural "receipt" grouping for later reporting. `unitPrice` is snapshotted per
line so a later price edit on `Product` doesn't retroactively change
historical sale totals.

`supabase-setup.sql` must be updated with the equivalent hand-written SQL for
these three tables, per existing convention (it's a manual mirror of
`schema.prisma`, not generated).

## Image upload (Supabase Storage)

- New public Storage bucket named `product-images`. Bucket creation is a
  one-time manual step (Supabase dashboard or `supabase storage` CLI) — not
  part of `prisma db push`. Documented as a new step in `supabase-setup.sql`'s
  header comment and the README setup section, the same way that file already
  documents one-shot SQL setup.
- New route `POST /api/clubs/[clubId]/products/upload-image`: accepts
  multipart `FormData` with one file field. Validates content-type is one of
  `image/jpeg`, `image/png`, `image/webp` and size ≤ 5MB (reject otherwise
  with 400). Uploads via the existing `createSupabaseAdminClient()`
  (service-role client, already used in `src/lib/supabase/admin.ts`) to
  `product-images/{clubId}/{cuid()}.{ext}`, then returns
  `{ url: <public URL> }`. Using the service-role client means no new
  Storage RLS policies or env vars are needed — same trust model as
  `createUser.ts`'s use of the admin client.
- Frontend: the product create/edit form's file input immediately POSTs to
  this route on file selection, stores the returned URL in local form state,
  and the actual product create/edit request just sends `imageUrl` as a
  plain string field like any other. This decouples upload from product
  save so a failed create doesn't leave an orphaned product half-configured
  (an orphaned *blob* in Storage is an acceptable v1 trade-off — no cleanup
  job for now).

## API routes

- `GET /api/clubs/[clubId]/products` — active (non-archived) products for
  the club, `orderBy: createdAt asc` (matches `GET .../rooms`).
- `POST /api/clubs/[clubId]/products` — create `{name, price, stock, imageUrl?}`.
  `requireMembership(clubId)`, no OWNER-only gate (matches how room creation
  works today — `canManageMembers` is only enforced for membership
  management, nothing else).
- `PATCH /api/products/[productId]` — partial update of
  `name`/`price`/`stock`/`imageUrl`; `{archived: false}` restores an archived
  product. Mirrors `PATCH /api/rooms/[roomId]` exactly (resolve tenant from
  the product's own `tenantId`, `requireMembership`, then update).
- `DELETE /api/products/[productId]` — archive (soft-delete), idempotent.
  Unlike `DELETE /api/rooms/[roomId]`, no "can't delete" guard is needed —
  a product has no in-progress state analogous to a BUSY station.
- `POST /api/clubs/[clubId]/products/upload-image` — as described above.
- `POST /api/clubs/[clubId]/sales` — checkout the cart. Body:
  `{items: [{productId, quantity}], paymentMethod, customerId?}`.
  `requireMembership(clubId)`. In one `prisma.$transaction` (mirroring
  `POST /api/sessions/[id]/stop`):
  1. Re-fetch each `productId`'s current `price`/`stock` server-side — never
     trust client-sent prices.
  2. Build `SaleLine` inputs via a new pure helper (see Testing below):
     `unitPrice` = current product price, `cost` = `unitPrice * quantity`.
  3. Sum line costs into the sale's `cost`.
  4. If `paymentMethod === "BALANCE"`: require `customerId`, check
     `canPayFromBalance()` against the total, decrement
     `Customer.balance`.
  5. Decrement each product's `stock` by its quantity (no floor check — may
     go negative, per design decision above).
  6. Look up the tenant's currently-open shift (if any) and attach its id.
  7. Create `Sale` + `SaleLine` rows.
  8. Write an audit log entry (`sale.create`) with the actor resolved via
     `getSessionUser()` the same way `session.stop` and `shift.close` do
     (never the impersonated identity).
  Returns the created `Sale` with its lines.

## Shift cash-reconciliation integration

`expectedCash()` / `cashDifference()` / `paymentMethodBreakdown()` in
`src/lib/shifts.ts` already operate on a generic `{cost, paymentMethod}[]` —
**no signature change needed**. The two route call sites that assemble that
array today get updated to concatenate sales alongside sessions:

- `GET /api/clubs/[clubId]/shifts` (`shifts/route.ts`): `include` gains
  `sales: { select: { cost: true, paymentMethod: true } }` alongside the
  existing `sessions` include; `serialize()` passes
  `[...shift.sessions, ...shift.sales]` into `expectedCash()`, and
  `totalsOf()` (cash/card revenue for display) does the same.
- `POST /api/shifts/[shiftId]/close` (`close/route.ts`): same
  `include` addition, same array concatenation before calling
  `expectedCash()` / `paymentMethodBreakdown()`.

`ShiftCard.tsx`'s payment-breakdown display is driven entirely by these
totals, so it picks up product revenue automatically with no component
change required.

## Frontend / UI

- New nav item "Products" (`nav.products` i18n key, `IconShoppingCart` or
  similar from `@tabler/icons-react`) in `Sidebar.tsx`, positioned after
  Customers, linking to `/clubs/[clubId]/products`.
- One page (`src/app/(dashboard)/clubs/[clubId]/products/page.tsx`):
  - A product grid (image thumbnail, name, price, stock badge, edit/archive
    icon buttons, "Add to cart" action), plus an "Add product" button.
  - Create/edit uses a `Dialog` form (name, price, stock, image file input)
    — same shape as the room create/edit flow, reusing `Button`/`Input`/
    `Dialog` primitives from `src/components/ui/`.
  - A persistent cart panel/drawer: line items with quantity steppers, a
    running total, a customer picker (optional, only relevant for BALANCE),
    a payment-method selector reusing `PAYMENT_METHODS` from
    `src/lib/shifts.ts` with the exact same `canPayFromBalance()` disable
    logic as `StopModal` in the room page, and a checkout button that calls
    `POST .../sales`.
  - New components: `src/components/product/ProductCard.tsx`,
    `src/components/product/ProductFormDialog.tsx`,
    `src/components/product/CartPanel.tsx` — following the existing
    `src/components/room/` structure of one file per concern.
- All new user-facing strings added to both `ru` and `en` in
  `src/lib/i18n/dictionaries.ts` per existing convention (e.g.
  `product.name`, `product.price`, `product.stock`, `product.addToCart`,
  `product.checkout`, `nav.products`).
- No OWNER-only gating anywhere in this flow — cashiers get full access,
  consistent with how Rooms works today (`Membership.role` is only consulted
  by `canManageMembers()` for member management).

## Testing

- `src/lib/shifts.ts`: extend existing `expectedCash()` /
  `paymentMethodBreakdown()` tests with cases mixing session and sale
  payment entries in the same array (pure function, no signature change —
  just new test cases covering the concatenation this feature relies on).
- New `src/lib/sales.ts`: a pure helper,
  `buildSaleLines(items: {productId, quantity}[], products: {id, price}[]): {productId, quantity, unitPrice, cost}[]`
  plus `saleTotal(lines): number`, extracted out of the route per the
  CLAUDE.md convention of keeping money math in a tested `src/lib/*.ts`
  module rather than embedded in a route handler. `buildSaleLines` throws on
  a quantity ≤ 0 or a `productId` not present in the given `products` array
  (the route maps either case to a 400 response) — a checkout request is
  either fully valid or fully rejected, no silent partial-cart dropping.
  Unit tests cover: a normal multi-line total, a quantity-≤-0 item throwing,
  a missing-product-id item throwing, and that `unitPrice` reflects the
  *current* product price argument, not any client-supplied value.
- Route-handler/API integration coverage is intentionally not added for the
  new routes, consistent with this codebase's existing coverage shape
  (CLAUDE.md notes there is "essentially no route-handler/API integration
  coverage" today) — the money-relevant logic is what's covered, via
  `sales.ts` and `shifts.ts`.

## Known follow-ups (not this pass)

- Attaching products to an in-progress session's stop/checkout dialog.
- Sale history / receipts view.
- Cleanup of orphaned Storage blobs from abandoned product-image uploads.
- `Membership.role` (OWNER/CASHIER) still isn't consulted anywhere in this
  feature, matching existing behavior elsewhere in the app.

# PS Club CRM — UI/UX Redesign

## Motivation

The app works but looks like an early prototype: plain Tailwind slate-950
background, hand-rolled form controls, emoji used as icons, and duplicated
loading/empty/error markup on every data-fetching page. This is a full
redesign covering visual identity, component consistency, and a general UX
pass (loading/empty/error states, forms, tables) — not just a restyle.

## Direction

- **Aesthetic**: clean modern SaaS admin (Linear/Vercel/Stripe-dashboard
  register), not a "gamer" dark-neon look, despite the PlayStation brand tie-in.
- **Theming**: both light and dark, with a user-facing toggle. Not a
  dark-only app anymore.
- **Components**: adopt shadcn/ui (Radix + Tailwind) as the primitive layer
  instead of continuing to hand-roll buttons/inputs/dialogs/tables.
- **Icons**: `@tabler/icons-react` instead of emoji.
- **Scope**: UI layer only. No changes to routes, data fetching, mutations,
  Prisma schema, or i18n keys/content. Existing behavior must be preserved;
  only presentation changes.

## Design tokens & theming

- `globals.css` moves to the shadcn CSS-variable convention: `--background`,
  `--foreground`, `--primary`, `--muted`, `--destructive`, `--success`, etc.,
  defined once under `:root` (light) and once under `.dark`.
- PlayStation blue (`#0070d1`, currently `tailwind.config.ts` → `brand`)
  becomes `--primary` in both themes. Existing ad-hoc semantic colors
  (`emerald-300` for money/success, `rose-600` for destructive/stop actions)
  become `--success` / `--destructive` tokens used consistently instead of
  scattered Tailwind color classes.
- `next-themes` provides the light/dark toggle (system-aware, persisted to
  localStorage). A toggle control (sun/moon icon button) is added to the
  Sidebar above sign-out.
- Typography: `Inter` via `next/font/google`, replacing the browser default
  sans stack. Single family, weight variation only — no second display font.
- Icons: `@tabler/icons-react` replaces every emoji currently used as an icon
  (🎮 clubs/stations, 👥 customers, 📊 reports, 🟢/🔵 station status, ✏️ edit,
  👤 customer marker, ← back arrows).

## Component library & shared primitives

- Install shadcn/ui (`components.json`, `cn` utility) with these primitives:
  `Button`, `Input`, `Label`, `Select`, `Dialog`, `Table`, `Card`, `Badge`,
  `DropdownMenu`, `Skeleton`, `Form`, `Sonner` (toast), `Separator`,
  `RadioGroup`.
- Build three shared components (new, under `src/components/ui-patterns/` or
  similar) used by every data-fetching page, replacing the duplicated
  `isLoading ? ... : isError ? ... : empty ? ...` ternary chains seen today in
  every page (`clubs/page.tsx`, `[clubId]/page.tsx`, `customers/page.tsx`,
  `reports/page.tsx`):
  - `<EmptyState icon message action? />`
  - `<ErrorState message retry? />`
  - `<PageHeader title subtitle? actions? />`

## Navigation & layout shell

- `Sidebar.tsx` rebuilt on shadcn `Button` (ghost/secondary variants) with
  Tabler icons per nav item. Active state becomes a subtle tinted background
  instead of a solid brand-color fill.
- Theme toggle added above the existing sign-out button.
- `layout.tsx` keeps the sidebar + main-content shell; main content adopts
  `<PageHeader>` for a consistent title/subtitle/actions rhythm across pages.

## Page-by-page

| Page | Current | Redesigned |
|---|---|---|
| `login/page.tsx`, `set-password/page.tsx` | Bare centered div + raw inputs | Centered `Card`, shadcn `Input`/`Label`/`Button`, destructive-styled inline error |
| `clubs/page.tsx` | Emoji card grid | shadcn `Card` grid, Tabler icon, `Skeleton` while loading, shared `EmptyState`/`ErrorState` |
| `clubs/[clubId]/page.tsx` | Inline toggle form, raw card grid | "Add room" moves into a `Dialog`; rooms as `Card` + `Badge` for station count |
| `rooms/[roomId]/page.tsx` (room view) | Floor-plan canvas (kept as-is structurally) + raw-div `BookingModal`/stop modal | Canvas/`StationMarker` restyled with tokens only; both modals become shadcn `Dialog` with tariff cards and `Select` for customer |
| `rooms/[roomId]/edit/page.tsx` | Canvas drag/drop (kept) + raw-div side panel | Side panel becomes `Card` with shadcn `Input`/`Select`; remove becomes destructive `Button` |
| `customers/page.tsx` | Raw inline form + raw table | Compact inline shadcn form (kept inline, 2 fields — no dialog needed); shadcn `Table` |
| `reports/page.tsx` | Raw stat cards + raw table | Stat tiles as `Card`; session list as shadcn `Table`. No charts (out of scope) |
| `admin/page.tsx` | Raw forms | `Card` + shadcn `Form` fields, same two forms (create club, invite member) |

No functional or data-flow changes on any page — same queries, mutations,
routes, and i18n translation keys throughout.

## Sequencing

Foundation-first:

1. **Phase 1 — Foundation**: design tokens, shadcn/ui setup, `next-themes`,
   Tabler icons, Inter font, rebuilt Sidebar/layout shell, shared
   `EmptyState`/`ErrorState`/`PageHeader` components.
2. **Phase 2 — Pages**: apply the foundation page-by-page in the order listed
   in the table above (auth pages first since they're simplest/lowest-risk,
   then clubs → club detail → room view → room edit → customers → reports →
   admin).

## Verification

- Existing Vitest suite (e.g. `login/page.test.tsx`) must keep passing;
  update any assertions tied to specific class names/DOM structure that the
  restyle changes.
- For each page, drive it in the browser preview (both light and dark) and
  check the golden path plus loading/empty/error states before moving to the
  next page.

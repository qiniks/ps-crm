# PS Club CRM UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign PS Club CRM into a clean modern SaaS admin UI with shadcn/ui components, Tabler icons, and a light/dark theme toggle, with zero changes to routes, data fetching, or i18n content.

**Architecture:** Foundation-first. Phase 1 (Tasks 1-3) installs shadcn/ui + `next-themes` + Tabler icons, defines CSS-variable design tokens, and rebuilds the shared shell (Sidebar, layout, shared empty/error/header components). Phase 2 (Tasks 4-11) applies that foundation to every page, one page per task, in increasing complexity order.

**Tech Stack:** Next.js 16 (App Router) / React 19 / Tailwind CSS 3 / shadcn/ui (Radix primitives, hand-written — not scaffolded via CLI, so icons can be Tabler instead of the default lucide-react) / `@tabler/icons-react` / `next-themes` / `sonner` / TanStack Query / Vitest + Testing Library.

## Global Constraints

- **No functional changes.** Every page keeps its existing routes, fetch calls, mutations, query keys, and i18n translation keys. This is a UI-layer redesign only.
- **Existing tests must keep passing.** In particular `src/app/login/page.test.tsx` queries `getByPlaceholderText("Email")`, `getByPlaceholderText("Password")`, and `getByRole("button", { name: /sign in/i })`, and asserts the text `"Invalid email or password."` — the login redesign must preserve these exact strings/attributes.
- **Icons:** `@tabler/icons-react` only. Never add `lucide-react`.
- **Theming:** both light and dark, toggled via `next-themes`, `attribute="class"`, default theme `"dark"` (matches today's only theme), `enableSystem={false}` (no automatic OS-preference switching — keeps behavior deterministic).
- **Design tokens:** every new/rewritten file uses the semantic Tailwind classes defined in Task 1 (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `bg-destructive`, `bg-success`, `bg-warning`, `border-border`, etc.) — never raw `slate-*`/`emerald-*`/`rose-*`/`amber-*`/`brand` classes in any file touched after Task 1.
- **Verification per task:** run `npm run test` (full suite) and expect the same or greater pass count with zero failures, then manually verify the touched page in the browser preview in both light and dark mode (golden path + loading/empty/error states where applicable) before committing.
- Reference spec: `docs/superpowers/specs/2026-07-07-ui-redesign-design.md`.

---

### Task 1: Install dependencies, design tokens, and theming plumbing

**Files:**
- Modify: `package.json` (new dependencies)
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/table.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/radio-group.tsx`
- Create: `src/components/ui/sonner.tsx`
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`. `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Badge`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `RadioGroup`/`RadioGroupItem`, `Toaster` (from `@/components/ui/sonner`) — all from `@/components/ui/*`. `ThemeProvider` from `@/components/theme-provider`. Tailwind semantic color/utility classes listed in Global Constraints. `toast` from the `sonner` package directly (re-exported by the package, no wrapper needed).
- Consumes: nothing (first task).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install next-themes @tabler/icons-react sonner clsx tailwind-merge class-variance-authority tailwindcss-animate @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-radio-group @radix-ui/react-slot @radix-ui/react-label
```
Expected: `package.json` `dependencies` gains all of the above; install completes with no errors.

- [ ] **Step 2: Create the `cn` class-merge helper**

Create `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Replace `globals.css` with design tokens**

Replace the full contents of `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 208 100% 41%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --success: 152 76% 36%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 208 100% 41%;
    --radius: 0.625rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 6% 10%;
    --card-foreground: 0 0% 98%;
    --popover: 240 6% 10%;
    --popover-foreground: 0 0% 98%;
    --primary: 208 100% 55%;
    --primary-foreground: 240 10% 3.9%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --success: 152 60% 46%;
    --success-foreground: 240 10% 3.9%;
    --warning: 38 92% 55%;
    --warning-foreground: 240 10% 3.9%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 208 100% 55%;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

- [ ] **Step 4: Update `tailwind.config.ts`**

Replace the full contents of `tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // TODO(remove after Task 11): kept only until every page migrates off bg-brand/text-brand.
        brand: {
          DEFAULT: "#0070d1",
          dark: "#003791",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

(This is genuinely a real, permanent code comment marking known follow-up work in Task 11, not a plan placeholder — the `brand` colors are intentionally kept until every consuming page has been migrated in later tasks.)

- [ ] **Step 5: Add the remaining shadcn/ui primitive components**

Create `src/components/ui/button.tsx`:
```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

Create `src/components/ui/input.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

Create `src/components/ui/label.tsx`:
```tsx
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

Create `src/components/ui/card.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

Create `src/components/ui/badge.tsx`:
```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        success: "border-transparent bg-success text-success-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

Create `src/components/ui/table.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("bg-muted/50 [&_tr]:border-b", className)} {...props} />
  )
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b border-border transition-colors hover:bg-muted/50", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn("h-11 px-4 text-left align-middle font-medium text-muted-foreground", className)}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3 align-middle", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

Create `src/components/ui/skeleton.tsx`:
```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
```

Create `src/components/ui/dialog.tsx`:
```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <IconX className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

Create `src/components/ui/select.tsx`:
```tsx
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { IconCheck, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <IconChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <IconChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <IconChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <IconCheck className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
```

Create `src/components/ui/radio-group.tsx`:
```tsx
"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { IconCircleFilled } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <IconCircleFilled className="h-2 w-2 fill-primary text-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
```

Create `src/components/ui/sonner.tsx`:
```tsx
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
```

Create `src/components/theme-provider.tsx`:
```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 6: Wire theming and the Inter font into the root layout**

Replace the full contents of `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "@/components/Sidebar";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

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
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <LanguageProvider>
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-8">{children}</main>
              </div>
            </LanguageProvider>
          </QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify the app still boots and existing tests pass**

Run: `npm run test`
Expected: all existing tests pass (same suite as before this task — no new test files yet).

Run: `npx tsc --noEmit`
Expected: no type errors.

Start the dev server and load `/login` and `/clubs` in the browser preview. Expected: pages render (unstyled by the new tokens yet since no page has been migrated — Sidebar and pages still use old `slate-*`/`brand` classes, which still work because Step 4 kept the `brand` colors and Tailwind still has the old utility classes available). No console errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/utils.ts src/components/ui src/components/theme-provider.tsx src/app/globals.css tailwind.config.ts src/app/layout.tsx
git commit -m "Add shadcn/ui primitives, design tokens, and theme toggle plumbing"
```

---

### Task 2: Shared empty/error/header components

**Files:**
- Create: `src/components/ui-patterns/empty-state.tsx`
- Create: `src/components/ui-patterns/empty-state.test.tsx`
- Create: `src/components/ui-patterns/error-state.tsx`
- Create: `src/components/ui-patterns/error-state.test.tsx`
- Create: `src/components/ui-patterns/page-header.tsx`
- Create: `src/components/ui-patterns/page-header.test.tsx`
- Modify: `src/lib/i18n/dictionaries.ts` (add `common.retry`)

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button` (Task 1).
- Produces: `EmptyState({ icon, message, action? })`, `ErrorState({ message, onRetry?, retryLabel? })`, `PageHeader({ title, subtitle?, actions? })` — all from `@/components/ui-patterns/*`, used by every page task from Task 5 onward.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui-patterns/empty-state.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the message and icon", () => {
    render(<EmptyState icon={<svg data-testid="icon" />} message="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(<EmptyState icon={<svg />} message="Nothing here" action={<button>Do it</button>} />);
    expect(screen.getByRole("button", { name: "Do it" })).toBeInTheDocument();
  });
});
```

Create `src/components/ui-patterns/error-state.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("renders the message", () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState message="Something broke" onRetry={onRetry} retryLabel="Try again" />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

Create `src/components/ui-patterns/page-header.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Clubs" />);
    expect(screen.getByRole("heading", { name: "Clubs" })).toBeInTheDocument();
  });

  it("renders an optional subtitle and actions", () => {
    render(<PageHeader title="Clubs" subtitle="Pick a club" actions={<button>+ Add</button>} />);
    expect(screen.getByText("Pick a club")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
  });

  it("omits the subtitle paragraph when not provided", () => {
    const { container } = render(<PageHeader title="Clubs" />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui-patterns`
Expected: FAIL — `Cannot find module './empty-state'` (and the same for `./error-state`, `./page-header`).

- [ ] **Step 3: Implement the components**

Create `src/components/ui-patterns/empty-state.tsx`:
```tsx
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <div className="text-muted-foreground/60">{icon}</div>
      <p>{message}</p>
      {action}
    </div>
  );
}
```

Create `src/components/ui-patterns/error-state.tsx`:
```tsx
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-10 text-center text-destructive">
      <IconAlertTriangle className="h-8 w-8" />
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel ?? "Retry"}
        </Button>
      )}
    </div>
  );
}
```

Create `src/components/ui-patterns/page-header.tsx`:
```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 4: Add the `common.retry` translation key**

In `src/lib/i18n/dictionaries.ts`, in the `ru` object, add this line directly after `"common.confirm": "Подтвердить",`:
```ts
    "common.retry": "Повторить",
```

In the `en` object, add this line directly after `"common.confirm": "Confirm",`:
```ts
    "common.retry": "Retry",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ui-patterns`
Expected: PASS — all 8 tests green.

Run: `npm run test`
Expected: full suite passes (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui-patterns src/lib/i18n/dictionaries.ts
git commit -m "Add shared EmptyState/ErrorState/PageHeader components"
```

---

### Task 3: Theme toggle, Sidebar, and LanguageSwitcher redesign

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Create: `src/components/theme-toggle.test.tsx`
- Modify: `src/components/LanguageSwitcher.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/lib/i18n/dictionaries.ts` (add `theme.toggle`)

**Interfaces:**
- Consumes: `Button` (Task 1), `useI18n()` returning `{ t, locale, setLocale }` from `@/lib/i18n/LanguageProvider` (existing), `LOCALES` from `@/lib/i18n/dictionaries` (existing).
- Produces: `ThemeToggle({ label: string })` from `@/components/theme-toggle`, used only by `Sidebar.tsx`.

- [ ] **Step 1: Write the failing test for ThemeToggle**

Create `src/components/theme-toggle.test.tsx`:
```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme }));

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  useTheme.mockReset();
});

describe("ThemeToggle", () => {
  it("switches from dark to light when clicked", async () => {
    const setTheme = vi.fn();
    useTheme.mockReturnValue({ resolvedTheme: "dark", setTheme });
    const user = userEvent.setup();

    render(<ThemeToggle label="Toggle theme" />);
    await user.click(await screen.findByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("switches from light to dark when clicked", async () => {
    const setTheme = vi.fn();
    useTheme.mockReturnValue({ resolvedTheme: "light", setTheme });
    const user = userEvent.setup();

    render(<ThemeToggle label="Toggle theme" />);
    await user.click(await screen.findByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/theme-toggle.test.tsx`
Expected: FAIL — `Cannot find module './theme-toggle'`.

- [ ] **Step 3: Implement ThemeToggle**

Create `src/components/theme-toggle.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/theme-toggle.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 5: Add the `theme.toggle` translation key**

In `src/lib/i18n/dictionaries.ts`, in the `ru` object, add directly after `"nav.signOut": "Выйти",`:
```ts
    "theme.toggle": "Переключить тему",
```

In the `en` object, add directly after `"nav.signOut": "Sign out",`:
```ts
    "theme.toggle": "Toggle theme",
```

- [ ] **Step 6: Redesign LanguageSwitcher**

Replace the full contents of `src/components/LanguageSwitcher.tsx`:
```tsx
"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-md bg-muted p-1">
      {LOCALES.map((l) => (
        <Button
          key={l}
          size="sm"
          variant={locale === l ? "default" : "ghost"}
          className={cn("h-7 px-2.5 text-xs font-semibold uppercase", locale !== l && "text-muted-foreground")}
          onClick={() => setLocale(l)}
        >
          {l}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Redesign Sidebar**

Replace the full contents of `src/components/Sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconChartBar,
  IconDeviceGamepad2,
  IconLogout,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // Detect the current club from the URL: /clubs/[clubId]/...
  const clubMatch = pathname.match(/^\/clubs\/([^/]+)/);
  const clubId = clubMatch?.[1];

  const items: { href: string; key: TranslationKey; icon: Icon }[] = clubId
    ? [
        { href: `/clubs/${clubId}`, key: "nav.rooms", icon: IconDeviceGamepad2 },
        { href: `/clubs/${clubId}/customers`, key: "nav.customers", icon: IconUsers },
        { href: `/clubs/${clubId}/reports`, key: "nav.reports", icon: IconChartBar },
      ]
    : [{ href: "/clubs", key: "nav.clubs", icon: IconDeviceGamepad2 }];

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
      <Link href="/clubs" className="mb-6 block px-2">
        <div className="text-lg font-bold text-foreground">{t("app.name")}</div>
        <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
      </Link>

      {clubId && (
        <Link
          href="/clubs"
          className="mb-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          {t("nav.clubs")}
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith(clubId ?? "___") && pathname.startsWith(item.href + "/rooms"));
          const ItemIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <ThemeToggle label={t("theme.toggle")} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="justify-start gap-2 px-3 text-muted-foreground hover:text-foreground"
        >
          <IconLogout className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 8: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass (existing suite + Task 2/3 new tests).

Run: `npx tsc --noEmit`
Expected: no type errors.

Start the dev server, open `/clubs`. Expected: Sidebar shows the PS Club CRM logo/tagline, nav items with Tabler icons, an active-state tint on the current page's link, a language toggle + sun/moon theme button above sign-out. Click the theme button — the whole app (Sidebar background/border, at minimum) switches between the light and dark token values from Task 1. Click both language buttons — active language is visually distinguished.

- [ ] **Step 9: Commit**

```bash
git add src/components/theme-toggle.tsx src/components/theme-toggle.test.tsx src/components/LanguageSwitcher.tsx src/components/Sidebar.tsx src/lib/i18n/dictionaries.ts
git commit -m "Redesign Sidebar/LanguageSwitcher and add the theme toggle"
```

---

### Task 4: Auth pages (login + set-password)

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/set-password/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` (Task 1).
- Produces: nothing new (leaf pages).

- [ ] **Step 1: Redesign the login page**

Replace the full contents of `src/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button disabled={submitting} className="mt-1">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing login test to verify it still passes unmodified**

Run: `npx vitest run src/app/login/page.test.tsx`
Expected: PASS — both existing tests green, with zero edits to the test file. This confirms the redesign preserved the placeholder text, button accessible name, and error message string the test depends on.

- [ ] **Step 3: Redesign the set-password page**

Replace the full contents of `src/app/set-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set your password</CardTitle>
          <CardDescription>Choose a password to finish setting up your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={8}
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button disabled={submitting} className="mt-1">
              {submitting ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Start the dev server, open `/login` and `/set-password` in both light and dark mode. Expected: centered card, labeled inputs, working submit/error states.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/set-password/page.tsx
git commit -m "Redesign login and set-password pages"
```

---

### Task 5: Clubs list page

**Files:**
- Modify: `src/app/clubs/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `ErrorState` (Task 2), `Skeleton`, `Card` (Task 1).
- Produces: nothing new (leaf page).

- [ ] **Step 1: Redesign the clubs list page**

Replace the full contents of `src/app/clubs/page.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

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
    refetch,
  } = useQuery({ queryKey: ["clubs"], queryFn: fetchClubs });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("clubs.title")} subtitle={t("clubs.subtitle")} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : clubs.length === 0 ? (
        <EmptyState icon={<IconDeviceGamepad2 className="h-8 w-8" />} message={t("clubs.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link key={c.id} href={`/clubs/${c.id}`} className="group">
              <Card className="p-5 transition hover:border-primary">
                <IconDeviceGamepad2 className="h-6 w-6 text-primary" />
                <div className="mt-2 font-semibold text-foreground group-hover:text-primary">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.roomCount} {t("clubs.roomsCount")}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass (no test file exists for this page — verified manually per project convention, matching how this page was tested before the redesign).

Start the dev server, open `/clubs`. Expected: card grid of clubs with a gamepad icon, hover state tints the border/icon/title with the primary color. Throttle/force an error (e.g. temporarily rename the `/api/clubs` route or stop the DB) to see the `ErrorState` with a working retry button, then restore it. If there are zero clubs for the signed-in account, verify the `EmptyState` renders. Check both light and dark.

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/page.tsx
git commit -m "Redesign clubs list page"
```

---

### Task 6: Club detail (rooms) page

**Files:**
- Modify: `src/app/clubs/[clubId]/page.tsx`
- Modify: `src/lib/i18n/dictionaries.ts` (add `club.roomCreated`)

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `ErrorState` (Task 2); `Button`, `Card`, `Badge`, `Input`, `Label`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` (Task 1); `toast` from `sonner`.
- Produces: nothing new (leaf page).

- [ ] **Step 1: Add the `club.roomCreated` translation key**

In `src/lib/i18n/dictionaries.ts`, in the `ru` object, add directly after `"club.noRooms": "В этом клубе пока нет залов",`:
```ts
    "club.roomCreated": "Зал создан",
```

In the `en` object, add directly after `"club.noRooms": "This club has no rooms yet",`:
```ts
    "club.roomCreated": "Room created",
```

- [ ] **Step 2: Redesign the club detail page**

Replace the full contents of `src/app/clubs/[clubId]/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

class RoomsFetchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "RoomsFetchError";
  }
}

const EMPTY = { name: "", price1h: "", price3h: "", price5h: "", openHourlyRate: "" };

async function fetchRooms(clubId: string): Promise<RoomsResponse> {
  const res = await fetch(`/api/clubs/${clubId}/rooms`, { cache: "no-store" });
  if (!res.ok) {
    throw new RoomsFetchError(`GET rooms failed: ${res.status}`, res.status);
  }
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
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["rooms", clubId],
    queryFn: () => fetchRooms(clubId),
  });

  const createRoomMutation = useMutation({
    mutationFn: (values: typeof EMPTY) => createRoom(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", clubId] });
      setForm(EMPTY);
      setOpen(false);
      toast.success(t("club.roomCreated"));
    },
  });

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createRoomMutation.mutate(form);
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (isError && error instanceof RoomsFetchError && error.status === 404) {
    notFound();
  }

  const clubName = data?.club.name ?? "";
  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={clubName}
        subtitle={t("club.rooms")}
        actions={<Button onClick={() => setOpen(true)}>+ {t("club.addRoom")}</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("club.addRoom")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">{t("club.roomName")}</Label>
              <Input id="room-name" value={form.name} onChange={set("name")} />
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
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
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={createRoomMutation.isPending}>{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : rooms.length === 0 ? (
        <EmptyState icon={<IconDeviceGamepad2 className="h-8 w-8" />} message={t("club.noRooms")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground">{r.name}</div>
                <Badge variant="secondary">
                  {r.stationCount} {t("club.stationsCount")}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>1h: {formatMoney(r.price1h)}</span>
                <span>3h: {formatMoney(r.price3h)}</span>
                <span>5h: {formatMoney(r.price5h)}</span>
                <span>
                  {t("station.openTariff")}: {formatMoney(r.openHourlyRate)}
                  {t("common.perHour")}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/clubs/${clubId}/rooms/${r.id}`}>{t("room.view")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/clubs/${clubId}/rooms/${r.id}/edit`}>{t("common.edit")}</Link>
                </Button>
              </div>
            </Card>
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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min="0" value={value} onChange={onChange} placeholder="0" />
    </div>
  );
}
```

- [ ] **Step 3: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Start the dev server, open a club's room list (`/clubs/<id>`). Expected: clicking "+ Add room" opens a `Dialog` (not an inline toggle) with the name + 4 price fields; submitting creates the room, closes the dialog, shows a "Room created" toast, and the new room card appears. Verify the empty-club and loading states. Check both light and dark.

- [ ] **Step 4: Commit**

```bash
git add src/app/clubs/[clubId]/page.tsx src/lib/i18n/dictionaries.ts
git commit -m "Redesign club detail page with an Add Room dialog"
```

---

### Task 7: Room view page, BookingModal, and StationMarker

**Files:**
- Modify: `src/app/clubs/[clubId]/rooms/[roomId]/page.tsx`
- Modify: `src/components/room/BookingModal.tsx`
- Modify: `src/components/room/StationMarker.tsx`

**Interfaces:**
- Consumes: `Button`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, `RadioGroup`/`RadioGroupItem`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `Label` (Task 1).
- Produces: nothing new (leaf page + its two dedicated components).

- [ ] **Step 1: Redesign StationMarker**

Replace the full contents of `src/components/room/StationMarker.tsx`:
```tsx
"use client";

import { IconUser } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

// A console shown on the room floor plan (booking/view mode).
export function StationMarker({
  station,
  room,
  now,
  onSelect,
}: {
  station: StationDTO;
  room: RoomDTO;
  now: number;
  onSelect: (s: StationDTO) => void;
}) {
  const { t } = useI18n();
  const sess = station.activeSession;
  const isBusy = station.status === "BUSY" && sess;
  const isMaint = station.status === "MAINTENANCE";

  // Timer text for busy stations.
  let timer: { label: string; value: string; danger?: boolean } | null = null;
  let cost = 0;
  if (isBusy && sess) {
    const started = new Date(sess.startedAt).getTime();
    if (sess.tariffKind === "OPEN") {
      cost = Math.round(((now - started) / 3_600_000) * room.openHourlyRate);
      timer = { label: t("station.elapsed"), value: formatDuration(now - started) };
    } else if (sess.plannedEndAt) {
      const remaining = new Date(sess.plannedEndAt).getTime() - now;
      timer =
        remaining >= 0
          ? { label: t("station.remaining"), value: formatDuration(remaining) }
          : { label: t("station.overtime"), value: formatDuration(-remaining), danger: true };
    }
  }

  return (
    <button
      onClick={() => !isMaint && onSelect(station)}
      disabled={isMaint}
      style={{ left: `${station.posX}%`, top: `${station.posY}%` }}
      className={cn(
        "absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 p-2 text-center text-xs shadow-lg transition",
        isBusy
          ? "border-success bg-success/15"
          : isMaint
          ? "cursor-not-allowed border-warning bg-warning/10 opacity-70"
          : "cursor-pointer border-border bg-card hover:border-primary hover:bg-primary/10"
      )}
    >
      <div className="truncate font-semibold text-foreground">{station.name}</div>
      <div className="text-[10px] text-muted-foreground">{station.type}</div>

      {isBusy && sess ? (
        <div className="mt-1 space-y-0.5">
          <div className="text-[10px] text-muted-foreground">
            {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          </div>
          {timer && (
            <div
              className={cn(
                "font-mono text-sm tabular-nums",
                timer.danger ? "text-destructive" : "text-foreground"
              )}
            >
              {timer.value}
            </div>
          )}
          {sess.tariffKind === "OPEN" && (
            <div className="text-[11px] font-semibold text-success">
              {formatMoney(cost)} {t("common.currency")}
            </div>
          )}
          {sess.customerName && (
            <div className="flex items-center justify-center gap-1 truncate text-[10px] text-muted-foreground">
              <IconUser className="h-3 w-3" />
              {sess.customerName}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[11px] font-medium text-muted-foreground">
          {isMaint ? t("station.maintenance") : t("station.free")}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Redesign BookingModal**

Replace the full contents of `src/components/room/BookingModal.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { TARIFFS, fixedPrice, type TariffKind } from "@/lib/tariffs";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Customer = { id: string; name: string };

// Radix Select rejects an empty-string item value, so "no customer" uses this sentinel
// instead of "" and is converted back to `undefined` before the API call.
const NONE = "__none__";

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
  const [customerId, setCustomerId] = useState(NONE);

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
      customerId: customerId === NONE ? undefined : customerId,
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("booking.station")}</div>
          <DialogTitle>
            {station.name} <span className="text-sm font-normal text-muted-foreground">· {station.type}</span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <div className="mb-2 text-sm font-medium text-foreground">{t("booking.chooseTariff")}</div>
          <RadioGroup
            value={tariff}
            onValueChange={(v) => setTariff(v as TariffKind)}
            className="grid grid-cols-2 gap-3"
          >
            {TARIFFS.map(({ kind }) => {
              const price = fixedPrice(room, kind);
              return (
                <Label
                  key={kind}
                  htmlFor={`tariff-${kind}`}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 font-normal transition",
                    tariff === kind ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={kind} id={`tariff-${kind}`} />
                    <span className="font-semibold text-foreground">{t(`tariff.${kind}` as TranslationKey)}</span>
                  </div>
                  <div className="text-sm text-success">
                    {price === null
                      ? `${formatMoney(room.openHourlyRate)} ${t("common.currency")}${t("common.perHour")}`
                      : `${formatMoney(price)} ${t("common.currency")}`}
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>{t("booking.customer")}</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("booking.customerNone")}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={bookMutation.isPending} onClick={confirm}>
            {t("booking.confirm")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Redesign the room view page**

Replace the full contents of `src/app/clubs/[clubId]/rooms/[roomId]/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCircleFilled, IconEdit } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatDuration, formatMoney } from "@/lib/format";
import { StationMarker } from "@/components/room/StationMarker";
import { BookingModal } from "@/components/room/BookingModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  if (isLoading || !room) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const busy = room.stations.filter((s) => s.status === "BUSY").length;
  const free = room.stations.filter((s) => s.status === "FREE").length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{room.name}</h1>
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            {room.club.name}
            <span className="flex items-center gap-1">
              <IconCircleFilled className="h-2.5 w-2.5 text-success" />
              {free} {t("room.free")}
            </span>
            <span className="flex items-center gap-1">
              <IconCircleFilled className="h-2.5 w-2.5 text-primary" />
              {busy} {t("room.busy")}
            </span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/clubs/${clubId}/rooms/${roomId}/edit`}>
            <IconEdit className="h-4 w-4" />
            {t("room.edit")}
          </Link>
        </Button>
      </header>

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-muted/40 bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]">
        {room.stations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{station.name}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          {sess.customerName ? ` · ${sess.customerName}` : ""}
        </div>
        <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
          <span className="text-muted-foreground">{t("station.elapsed")}</span>
          <span className="font-mono text-foreground">{formatDuration(now - started)}</span>
        </div>
        <div className="flex justify-between rounded-lg bg-muted p-3">
          <span className="text-muted-foreground">{t("station.cost")}</span>
          <span className="text-lg font-bold text-success">
            {formatMoney(cost)} {t("common.currency")}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" className="flex-1" onClick={onStop}>
            {t("station.stop")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Run: `npx tsc --noEmit`
Expected: no type errors.

Start the dev server, open a room (`/clubs/<clubId>/rooms/<roomId>`). Expected: floor-plan canvas renders station markers with the new token colors (success-green for busy, warning-amber for maintenance, primary-tinted hover for free). Click a free station — the `BookingModal` opens as a proper dialog; the tariff cards are keyboard-navigable radio options; the customer `Select` lists customers and defaults to "No customer"; confirming books the session and closes the dialog. Click a busy station — the stop dialog opens with a live elapsed timer and cost, and "Stop" ends the session. Check both light and dark.

- [ ] **Step 5: Commit**

```bash
git add src/app/clubs/[clubId]/rooms/[roomId]/page.tsx src/components/room/BookingModal.tsx src/components/room/StationMarker.tsx
git commit -m "Redesign room view page, BookingModal, and StationMarker"
```

---

### Task 8: Room edit page

**Files:**
- Modify: `src/app/clubs/[clubId]/rooms/[roomId]/edit/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label`, `Card`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (Task 1); `toast` from `sonner`.
- Produces: nothing new (leaf page).

- [ ] **Step 1: Redesign the room edit page**

Replace the full contents of `src/app/clubs/[clubId]/rooms/[roomId]/edit/page.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from server data into client-authoritative drag state; see comment above.
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
    setStations((prev) => prev.map((s) => (s.id === drag.current!.id ? { ...s, posX: x, posY: y } : s)));
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
      toast.success(t("editor.saved"));
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
          <Link
            href={`/clubs/${clubId}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft className="h-3 w-3" />
            {roomName}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t("editor.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/clubs/${clubId}/rooms/${roomId}`}>{t("room.view")}</Link>
          </Button>
          <Button onClick={saveLayout} disabled={saveState === "saving"} variant={dirty ? "default" : "secondary"}>
            {saveState === "saving" ? (
              t("editor.saving")
            ) : saveState === "saved" && !dirty ? (
              <>
                <IconCheck className="h-4 w-4" />
                {t("editor.saved")}
              </>
            ) : (
              t("editor.save")
            )}
          </Button>
        </div>
      </header>

      <form onSubmit={addStation} className="mb-4 flex flex-wrap gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("editor.stationName")}
          className="max-w-xs"
        />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PS5">PS5</SelectItem>
            <SelectItem value="PS4">PS4</SelectItem>
          </SelectContent>
        </Select>
        <Button>+ {t("editor.addStation")}</Button>
      </form>

      <p className="mb-2 text-xs text-muted-foreground">{t("editor.hint")}</p>

      <div className="flex gap-4">
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          className="relative aspect-[16/9] flex-1 touch-none overflow-hidden rounded-2xl border border-border bg-muted/40 bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {stations.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t("editor.emptyHint")}
            </div>
          )}
          {stations.map((s) => (
            <div
              key={s.id}
              onPointerDown={(e) => onPointerDown(e, s.id)}
              onPointerUp={(e) => onPointerUp(e, s.id)}
              style={{ left: `${s.posX}%`, top: `${s.posY}%` }}
              className={cn(
                "absolute w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border-2 bg-card p-2 text-center shadow-lg active:cursor-grabbing",
                selectedId === s.id ? "border-primary" : "border-border"
              )}
            >
              <div className="truncate text-xs font-semibold text-foreground">{s.name}</div>
              <div className="text-[10px] text-muted-foreground">{s.type}</div>
            </div>
          ))}
        </div>

        {selected && (
          <Card className="w-56 shrink-0 p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">{selected.name}</div>
            <div className="mb-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("editor.stationName")}</Label>
              <Input value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} />
            </div>
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("editor.type")}</Label>
              <Select value={selected.type} onValueChange={(v) => patchSelected({ type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PS5">PS5</SelectItem>
                  <SelectItem value="PS4">PS4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="destructive" className="w-full" onClick={removeSelected}>
              {t("editor.remove")}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Start the dev server, open a room's edit page. Expected: adding a station via the name input + PS5/PS4 select works; dragging a station on the canvas still works (pointer-based drag is unchanged); selecting a station shows the side `Card` with editable name/type and a destructive "Remove console" button; saving the layout shows the "Saving…" → "Saved" toast + button state. Check both light and dark.

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/[clubId]/rooms/[roomId]/edit/page.tsx
git commit -m "Redesign room edit page"
```

---

### Task 9: Customers page

**Files:**
- Modify: `src/app/clubs/[clubId]/customers/page.tsx`
- Modify: `src/lib/i18n/dictionaries.ts` (add `customers.created`)

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `ErrorState` (Task 2); `Input`, `Button`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Task 1); `toast` from `sonner`.
- Produces: nothing new (leaf page).

- [ ] **Step 1: Add the `customers.created` translation key**

In `src/lib/i18n/dictionaries.ts`, in the `ru` object, add directly after `"customers.empty": "Клиентов пока нет",`:
```ts
    "customers.created": "Клиент добавлен",
```

In the `en` object, add directly after `"customers.empty": "No customers yet",`:
```ts
    "customers.created": "Customer added",
```

- [ ] **Step 2: Redesign the customers page**

Replace the full contents of `src/app/clubs/[clubId]/customers/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    refetch,
  } = useQuery({ queryKey: ["customers", clubId], queryFn: () => fetchCustomers(clubId) });

  const addMutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) => createCustomer(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      setName("");
      setPhone("");
      toast.success(t("customers.created"));
    },
  });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate({ name, phone });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("customers.title")} />

      <form onSubmit={add} className="mb-6 flex flex-wrap gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("customers.name")} className="max-w-xs" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("customers.phone")} className="max-w-xs" />
        <Button disabled={addMutation.isPending}>+</Button>
      </form>

      {isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : !isLoading && customers.length === 0 ? (
        <EmptyState icon={<IconUsers className="h-8 w-8" />} message={t("customers.empty")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customers.name")}</TableHead>
                <TableHead>{t("customers.phone")}</TableHead>
                <TableHead>{t("customers.balance")}</TableHead>
                <TableHead>{t("customers.bonus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(c.balance)} {t("common.currency")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.bonusPoints}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Start the dev server, open a club's customers page. Expected: adding a customer via the two inline inputs works and shows a "Customer added" toast; the table renders with the new token styling; the empty and error states render correctly. Check both light and dark.

- [ ] **Step 4: Commit**

```bash
git add src/app/clubs/[clubId]/customers/page.tsx src/lib/i18n/dictionaries.ts
git commit -m "Redesign customers page"
```

---

### Task 10: Reports page

**Files:**
- Modify: `src/app/clubs/[clubId]/reports/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `ErrorState` (Task 2); `Card`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Task 1).
- Produces: nothing new (leaf page).

- [ ] **Step 1: Redesign the reports page**

Replace the full contents of `src/app/clubs/[clubId]/reports/page.tsx`:
```tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
    refetch,
  } = useQuery({ queryKey: ["reports", clubId], queryFn: () => fetchReport(clubId) });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (isError || !report) {
    return <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("reports.title")} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("reports.revenueToday")}>
          {formatMoney(report.revenueToday)} {t("common.currency")}
        </StatCard>
        <StatCard label={t("reports.sessionsToday")}>{report.sessionsToday}</StatCard>
        <StatCard label={t("reports.avgCheck")}>
          {formatMoney(report.avgCheck)} {t("common.currency")}
        </StatCard>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("reports.recent")}</h2>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reports.station")}</TableHead>
              <TableHead>{t("reports.tariff")}</TableHead>
              <TableHead>{t("customers.name")}</TableHead>
              <TableHead>{t("reports.amount")}</TableHead>
              <TableHead>{t("reports.when")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.recent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("reports.empty")}
                </TableCell>
              </TableRow>
            ) : (
              report.recent.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">{s.station}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t(`tariff.${s.tariffKind}` as TranslationKey)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.customerName ?? "—"}</TableCell>
                  <TableCell className="text-success">
                    {formatMoney(s.cost)} {t("common.currency")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.endedAt ? new Date(s.endedAt).toLocaleString(locale) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-foreground">{children}</div>
    </Card>
  );
}
```

- [ ] **Step 2: Run the full suite and verify in the browser**

Run: `npm run test`
Expected: all tests pass.

Start the dev server, open a club's reports page. Expected: three stat `Card`s at the top, a sessions `Table` below, error state renders on failure. Check both light and dark.

- [ ] **Step 3: Commit**

```bash
git add src/app/clubs/[clubId]/reports/page.tsx
git commit -m "Redesign reports page"
```

---

### Task 11: Admin page and final `brand` color cleanup

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `tailwind.config.ts` (remove the now-unused `brand` color)

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Input`, `Button`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (Task 1).
- Produces: nothing new (leaf page; last task).

- [ ] **Step 1: Redesign the admin page**

Replace the full contents of `src/app/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createClub, inviteMember } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/clubs");
  }

  const clubs = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Admin</h1>

      <Card className="mb-8 p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg">Create a club</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={createClub} className="flex gap-3">
            <Input name="name" placeholder="Club name" required className="flex-1" />
            <Button>Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg">Invite a member</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={inviteMember} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Select name="tenantId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button>Send invite</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the admin page's Select participates in the native form action**

Start the dev server, sign in as the `ADMIN_EMAIL` user, open `/admin`. Expected: the "Invite a member" form's club `Select` is a styled dropdown (not a native `<select>` visually), but submitting the form still sends `tenantId` to the `inviteMember` server action correctly (Radix `Select` renders a hidden native `<select>` for form participation when given a `name` prop) — confirm by inviting a member to a specific club and checking the created membership/tenant is correct. Also verify "Create a club" still works.

- [ ] **Step 3: Confirm no page still references the legacy `brand` color**

Run:
```bash
grep -rn "brand" src/
```
Expected: only `tailwind.config.ts` matches (the color definition itself) — no `bg-brand`, `text-brand`, `border-brand`, or `hover:bg-brand-dark` usages remain in any `src/app` or `src/components` file.

- [ ] **Step 4: Remove the legacy `brand` color from Tailwind config**

In `tailwind.config.ts`, remove this block from `theme.extend.colors` (it was only kept as a migration bridge through Task 10):
```ts
        // TODO(remove after Task 11): kept only until every page migrates off bg-brand/text-brand.
        brand: {
          DEFAULT: "#0070d1",
          dark: "#003791",
        },
```

- [ ] **Step 5: Run the full suite, type-check, and verify in the browser one more time**

Run: `npm run test`
Expected: all tests pass.

Run: `npx tsc --noEmit`
Expected: no type errors.

Run: `npm run build`
Expected: production build succeeds (this also catches any Tailwind class purge issues from the config cleanup).

Click through every page (`/login`, `/clubs`, `/clubs/<id>`, `/clubs/<id>/rooms/<id>`, `/clubs/<id>/rooms/<id>/edit`, `/clubs/<id>/customers`, `/clubs/<id>/reports`, `/admin`) in both light and dark mode as a final pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx tailwind.config.ts
git commit -m "Redesign admin page and remove the legacy brand color"
```

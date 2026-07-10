// Audit log: a record of who did what to what, and when. Used for
// cash-handling actions (session stop, shift close) and admin impersonation,
// where there's otherwise no trail of who performed a sensitive action.
//
// logAudit() is the only place that should call prisma.auditLog.create — call
// sites stay thin (build the input, call logAudit) so the actual normalization
// logic lives here and is covered by audit.test.ts instead of duplicated/
// re-derived at every route.

import { prisma } from "./prisma";
import { Prisma } from "@/generated/prisma/client";
import { cashDifference } from "./shifts";

export type AuditEntryInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditEntry = {
  tenantId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
};

// Pure: strips undefined values so what's stored matches what round-trips
// back out of JSON (JSON.stringify silently drops undefined keys anyway;
// this makes that behavior explicit and predictable for callers/tests).
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== undefined));
}

// Pure: normalizes an audit entry input into the exact shape written to the
// database — trims the action, defaults missing optional fields to null
// (Prisma needs explicit null, not undefined, for nullable columns), and
// sanitizes metadata. Throws on an empty action since every log line must be
// attributable to a specific action.
export function buildAuditEntry(input: AuditEntryInput): AuditEntry {
  const action = input.action.trim();
  if (!action) {
    throw new Error("audit action is required");
  }
  return {
    tenantId: input.tenantId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ? sanitizeMetadata(input.metadata) : null,
  };
}

// Pure: the metadata attached to a "shift.close" audit entry, including a
// hasShortage flag so the admin audit view can highlight shortages without
// re-deriving the comparison from raw numbers.
export function shiftCloseMetadata(input: {
  openingCash: number;
  closingCash: number;
  expectedCash: number;
}): {
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  difference: number;
  hasShortage: boolean;
} {
  const difference = cashDifference(input.expectedCash, input.closingCash);
  return {
    openingCash: input.openingCash,
    closingCash: input.closingCash,
    expectedCash: input.expectedCash,
    difference,
    hasShortage: difference < 0,
  };
}

// Writes one audit log row. Never throws: a failure to log must not break
// the primary mutation (e.g. closing a shift with real cash), so errors are
// caught and reported to the console instead of propagating.
export async function logAudit(input: AuditEntryInput): Promise<void> {
  const entry = buildAuditEntry(input);
  try {
    await prisma.auditLog.create({
      data: {
        ...entry,
        // Prisma's Json fields distinguish "column is SQL NULL" from
        // "column holds the JSON value null" — Prisma.DbNull is the former,
        // which is what an absent metadata object means here.
        metadata: (entry.metadata as Prisma.InputJsonObject | null) ?? Prisma.DbNull,
      },
    });
  } catch (err) {
    console.error("audit log write failed", { action: entry.action, err });
  }
}

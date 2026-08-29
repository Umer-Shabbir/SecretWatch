import { prisma } from "@/lib/db";

/**
 * Scan Rules business logic (M08).
 *
 * A ScanRule is a detection regex the scanner worker evaluates against
 * scanned code (apps/worker/src/rules/engine.ts, apps/worker/src/scheduler.ts,
 * apps/worker/src/scanner.worker.ts). Those worker files already read
 * `enabled` ScanRule rows live from the DB on every scheduler tick / scan job
 * — there is no in-memory cache to invalidate, so a plain CRUD surface here
 * is sufficient for admin changes to take effect on the worker's next tick.
 *
 * Patterns stored here are detection regexes, not secrets — logging a
 * pattern's text is fine. This module must never handle, log, or persist any
 * matched secret value; that boundary belongs entirely to
 * apps/worker/src/rules/engine.ts and is out of scope here.
 */

export interface ScanRuleSummary {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  createdAt: string; // ISO 8601
}

const SCAN_RULE_SELECT = {
  id: true,
  name: true,
  pattern: true,
  enabled: true,
  createdAt: true,
} as const;

type ScanRuleRow = {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  createdAt: Date;
};

function toScanRuleSummary(row: ScanRuleRow): ScanRuleSummary {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ScanRuleNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Scan rule not found: ${id}`);
    this.name = "ScanRuleNotFoundError";
  }
}

export class InvalidPatternError extends Error {
  constructor(public readonly reason: string) {
    super(`Invalid pattern: ${reason}`);
    this.name = "InvalidPatternError";
  }
}

/**
 * Heuristically rejects regex shapes that are classic ReDoS
 * (catastrophic-backtracking) triggers. This is a defense-in-depth
 * admin-input filter, NOT the security boundary — the actual boundary is
 * the worker's execution timeout (apps/worker/src/rules/engine.ts,
 * evaluateRuleWithTimeout). Even a pattern shape this heuristic misses can
 * never hang the scanner indefinitely, because the worker enforces a hard
 * wall-clock budget per evaluation regardless of what shape the pattern is.
 *
 * Shapes covered:
 * - nested quantifiers: `(a+)+`, `(a*)*`, `(.+)+`, `(x{2,})+`
 * - quantified alternation: `(a|aa)+`, `(a|a?)+` — ambiguous alternatives
 *   inside a quantified group, another classic catastrophic-backtracking
 *   trigger distinct from nested quantifiers
 */
const CATASTROPHIC_BACKTRACKING_SHAPES = [
  /\([^()]*[+*][^()]*\)[+*]/, // (x+)+ , (x*)* , (x+)* , (x*)+ style groups
  /\([^()]*\{\d*,?\d*\}[^()]*\)[+*]/, // (x{2,}) followed by + or *
  /\([^()]*\|[^()]*\)[+*]/, // (a|aa)+ , (a|a?)+ — quantified alternation
];

const MAX_PATTERN_LENGTH = 500;

function hasCatastrophicBacktrackingShape(pattern: string): boolean {
  return CATASTROPHIC_BACKTRACKING_SHAPES.some((shape) => shape.test(pattern));
}

/**
 * Validates that a pattern string compiles as a JS RegExp, stays within a
 * sane length bound, and does not match a known catastrophic-backtracking
 * shape. Throws InvalidPatternError otherwise. Never logs the raw pattern on
 * failure beyond what the caller chooses to log (patterns are detection
 * regexes, not secrets, so this is safe — see module doc comment).
 *
 * This is a best-effort admin-input filter, not a full static ReDoS proof —
 * see the worker-side execution timeout in apps/worker/src/rules/engine.ts
 * for the actual availability guarantee.
 */
function assertValidPattern(pattern: string): void {
  if (!pattern || pattern.trim().length === 0) {
    throw new InvalidPatternError("Pattern must not be empty");
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new InvalidPatternError(`Pattern must not exceed ${MAX_PATTERN_LENGTH} characters`);
  }

  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new InvalidPatternError(`Pattern does not compile as a valid regular expression: ${message}`);
  }

  if (hasCatastrophicBacktrackingShape(pattern)) {
    throw new InvalidPatternError(
      "Pattern contains a shape (e.g. (a+)+ or (a|aa)+) that risks catastrophic backtracking"
    );
  }
}

/** Returns all scan rules, newest first. */
export async function listScanRules(): Promise<ScanRuleSummary[]> {
  const rows = await prisma.scanRule.findMany({
    orderBy: { createdAt: "desc" },
    select: SCAN_RULE_SELECT,
  });
  return rows.map(toScanRuleSummary);
}

/** Fetches one scan rule by id. Returns null if not found. */
export async function getScanRule(id: string): Promise<ScanRuleSummary | null> {
  const row = await prisma.scanRule.findUnique({
    where: { id },
    select: SCAN_RULE_SELECT,
  });
  if (!row) return null;
  return toScanRuleSummary(row);
}

/**
 * Creates a new scan rule. Validates `name` is non-empty and `pattern`
 * compiles as a valid JS RegExp (and isn't an obvious ReDoS shape). New
 * rules default to enabled: true, matching the Prisma schema default and
 * the Figma Create Rule form's "Enable this rule immediately" checkbox
 * (checked by default). `enabled` is optional and only overrides the
 * default when explicitly provided (frontend contract addition for M08's
 * frontend slice — the checkbox is part of the designed Create Rule form
 * but the initial backend pass always forced enabled: true).
 */
export async function createScanRule(params: {
  name: string;
  pattern: string;
  enabled?: boolean;
}): Promise<ScanRuleSummary> {
  const name = params.name?.trim() ?? "";
  if (!name) {
    throw new InvalidPatternError("Name must not be empty");
  }
  assertValidPattern(params.pattern);

  const row = await prisma.scanRule.create({
    data: {
      name,
      pattern: params.pattern,
      enabled: params.enabled ?? true,
    },
    select: SCAN_RULE_SELECT,
  });

  return toScanRuleSummary(row);
}

/**
 * Updates a scan rule's name and/or pattern (Figma "Edit" action). Either
 * field may be omitted to leave it unchanged. Re-validates `pattern` if
 * provided. Does not touch `enabled` — use setScanRuleEnabled for that.
 */
export async function updateScanRule(
  id: string,
  params: { name?: string; pattern?: string }
): Promise<ScanRuleSummary> {
  const existing = await prisma.scanRule.findUnique({ where: { id }, select: SCAN_RULE_SELECT });
  if (!existing) {
    throw new ScanRuleNotFoundError(id);
  }

  const data: { name?: string; pattern?: string } = {};

  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed) {
      throw new InvalidPatternError("Name must not be empty");
    }
    data.name = trimmed;
  }

  if (params.pattern !== undefined) {
    assertValidPattern(params.pattern);
    data.pattern = params.pattern;
  }

  const row = await prisma.scanRule.update({
    where: { id },
    data,
    select: SCAN_RULE_SELECT,
  });

  return toScanRuleSummary(row);
}

/**
 * Flips a scan rule's enabled flag (Figma Enable/Disable actions, the
 * Disable action gated behind the Disable Confirmation modal on the
 * frontend). This function only flips the flag — the confirmation semantics
 * ("rule stops being evaluated; existing findings from this rule are not
 * affected") are a frontend-only confirmation UX concern; the underlying
 * data model already guarantees this because Finding rows do not reference
 * ScanRule by foreign key (matchedRule is a denormalized display string), so
 * disabling a rule can never cascade into existing Finding rows.
 *
 * Idempotent: setting enabled to its current value still succeeds (no
 * invalid-transition error), since enable/disable has no ordering
 * constraint, unlike Finding's status state machine.
 */
export async function setScanRuleEnabled(id: string, enabled: boolean): Promise<ScanRuleSummary> {
  const existing = await prisma.scanRule.findUnique({ where: { id }, select: SCAN_RULE_SELECT });
  if (!existing) {
    throw new ScanRuleNotFoundError(id);
  }

  const row = await prisma.scanRule.update({
    where: { id },
    data: { enabled },
    select: SCAN_RULE_SELECT,
  });

  return toScanRuleSummary(row);
}

/**
 * Deletes a scan rule by ID.
 * Since Finding.matchedRule is a denormalized string, historical findings remain intact.
 */
export async function deleteScanRule(id: string): Promise<void> {
  const existing = await prisma.scanRule.findUnique({ where: { id }, select: SCAN_RULE_SELECT });
  if (!existing) {
    throw new ScanRuleNotFoundError(id);
  }

  await prisma.scanRule.delete({
    where: { id },
  });
}

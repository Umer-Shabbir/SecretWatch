"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RuleFormValues {
  name: string;
  pattern: string;
  /** Only meaningful on create — see Field: Enabled in Figma's Create Rule form. */
  enabled?: boolean;
}

/**
 * Shared Create/Edit Rule form — Figma nodes 51:267 (Admin / Scan Rules /
 * Create Rule) and 51:268 (Admin / Scan Rules / Invalid Regex, the same
 * form's inline validation-error state). Reused by both
 * app/(protected)/admin/rules/new/page.tsx and
 * app/(protected)/admin/rules/[id]/edit/page.tsx per the task's "reuse the
 * same form component/route pattern" instruction — there is exactly one
 * hand-composed "Rule Form" frame in Figma, not a separate Edit design.
 *
 * The "Enabled" checkbox only appears on Create (Figma's Create Rule form
 * has a "Enable this rule immediately" field; the Invalid Regex/Edit flows
 * do not re-expose it — enable/disable is its own action per
 * scopeNotes/backendSlice decisions in state/modules/M08.json, and
 * PATCH /api/scan-rules/:id does not accept `enabled`).
 *
 * Validation:
 *  - Client-side: both fields non-empty before submit is enabled.
 *  - Server-side: POST/PATCH /api/scan-rules can return 409 { error:
 *    "invalid_pattern", message } for a pattern that doesn't compile (or
 *    matches an unsafe nested-quantifier shape) — rendered inline under the
 *    Pattern field using the Input error state, exactly matching the Figma
 *    "Invalid Regex" copy pattern ("Invalid regular expression: ...").
 *    A 400 (schema validation, e.g. empty name) surfaces the same way.
 *  - No full page reload on failure: this is a client component, submit is
 *    handled via fetch().
 */
export function RuleForm({
  mode,
  breadcrumbLabel,
  title,
  initialValues,
  submitLabel,
  submittingLabel,
  onSubmit,
}: {
  mode: "create" | "edit";
  breadcrumbLabel: string;
  title: string;
  initialValues: RuleFormValues;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (values: RuleFormValues) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues.name);
  const [pattern, setPattern] = useState(initialValues.pattern);
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [patternError, setPatternError] = useState<string | undefined>(undefined);

  const canSubmit = name.trim().length > 0 && pattern.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    setPatternError(undefined);

    const trimmedName = name.trim();
    const trimmedPattern = pattern.trim();

    if (!trimmedName) {
      setNameError("Rule name is required.");
      return;
    }
    if (!trimmedPattern) {
      setPatternError("Pattern is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(
        mode === "create" ? { name: trimmedName, pattern: trimmedPattern, enabled } : { name: trimmedName, pattern: trimmedPattern }
      );
      if (!result.ok) {
        // The API's InvalidPatternError message covers both empty-name and
        // invalid-regex cases; route regex-shaped messages to the Pattern
        // field (matching the Figma Invalid Regex state) and anything else
        // to the Name field.
        if (/pattern|regular expression|regex|backtracking/i.test(result.message)) {
          setPatternError(result.message);
        } else {
          setNameError(result.message);
        }
        return;
      }
      router.push("/admin/rules");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-fg-muted">{breadcrumbLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-8 text-fg-default">{title}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-[560px] flex-col gap-5">
        <Input
          label="Rule Name"
          name="name"
          placeholder="e.g. AWS Access Key"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <Input
            label="Pattern (regex)"
            name="pattern"
            className="font-mono"
            placeholder="AKIA[0-9A-Z]{16}"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            error={patternError}
            disabled={submitting}
          />
          {!patternError && (
            <p className="text-xs text-fg-subtle">Validated as a JavaScript-compatible regular expression before saving.</p>
          )}
        </div>

        {mode === "create" && (
          <label className="flex items-center gap-2 text-sm text-fg-default">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={submitting}
              className="size-4 rounded-[4px] border border-border-default accent-accent-emphasis"
            />
            Enable this rule immediately
          </label>
        )}

        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={() => router.push("/admin/rules")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="w-auto" disabled={!canSubmit} loading={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export type TemplateSeverityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "";
export type TemplateSecretTypeValue = "AWS_KEY" | "GITHUB_TOKEN" | "GENERIC_API_KEY" | "DB_CONNECTION_STRING" | "";

export interface TemplateFormValues {
  name: string;
  body: string;
  severity?: TemplateSeverityValue;
  secretType?: TemplateSecretTypeValue;
  includeAttributionLine?: boolean;
}

const AVAILABLE_VARIABLES_CAPTION = "Available variables: {{repo}}  {{file}}  {{rule}}";

const SEVERITY_OPTIONS: { value: TemplateSeverityValue; label: string }[] = [
  { value: "", label: "None" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const SECRET_TYPE_OPTIONS: { value: TemplateSecretTypeValue; label: string }[] = [
  { value: "", label: "None" },
  { value: "AWS_KEY", label: "AWS Key" },
  { value: "GITHUB_TOKEN", label: "GitHub Token" },
  { value: "GENERIC_API_KEY", label: "Generic API Key" },
  { value: "DB_CONNECTION_STRING", label: "DB Connection String" },
];

/**
 * Fixed, non-editable preview of the soft attribution line (2026-08-17
 * addition) — admins can only toggle whether it's appended, never edit its
 * text, so it can never be repurposed into an arbitrary link/ask. The exact
 * text lives in packages/shared/src/template.ts's ATTRIBUTION_LINE; this is
 * a display-only copy of it for the toggle's helper text.
 */
const ATTRIBUTION_LINE_PREVIEW =
  "If you'd like to support this project, visit: https://github.com/TODO-project-org/secretwatch";

/**
 * Shared Create/Edit Template form — hand-composed "Template Form" frame
 * per state/modules/M09.json's componentsNotReused_builtLocally (no
 * generic Message Template Editor / Textarea primitive exists in Figma's
 * component library yet). Figma nodes:
 *   - 51:274 Admin / Templates / Invalid Variable — this form's inline
 *     validation-error state (red border on Textarea + red helper text
 *     naming the exact unsupported variable, e.g. "Unsupported variable
 *     {{filepath}} — did you mean {{file}}?")
 *   - 51:275 Admin / Templates / Save Success — this form's success state
 *     (green Alert=Success banner above the form, "Template saved
 *     successfully.")
 *
 * Both captured frames are the *Edit Template* screen ("Templates / Edit
 * Template" breadcrumb); no separate "Create Template" frame exists in
 * Figma, so — mirroring RuleForm's exact precedent for Scan Rules — this
 * one form component is reused for both create and edit, with the
 * breadcrumb/title/submit copy varied by the caller.
 *
 * Body textarea uses font-mono (JetBrains Mono) per DESIGN.md's typography
 * rule that template body content is always monospace, matching the
 * Figma Textarea's JetBrains_Mono:Regular text style exactly.
 *
 * Validation:
 *  - Client-side: both fields non-empty before submit is enabled.
 *  - Server-side: POST/PATCH /api/message-templates can return 400
 *    { error: "invalid_variable", message } naming the exact unsupported
 *    variable (lib/messageTemplates.ts's InvalidVariableError) — rendered
 *    inline under the Body field using the same red-border Textarea +
 *    red helper text treatment as the Figma Invalid Variable state. A
 *    generic 400 (schema validation, e.g. empty name) surfaces on the
 *    Name field.
 *  - No full page reload on failure: this is a client component, submit
 *    is handled via fetch() (caller-supplied onSubmit).
 */
export function TemplateForm({
  mode,
  breadcrumbLabel,
  title,
  initialValues,
  submitLabel,
  submittingLabel,
  cancelHref,
  onSubmit,
}: {
  mode: "create" | "edit";
  breadcrumbLabel: string;
  title: string;
  initialValues: TemplateFormValues;
  submitLabel: string;
  submittingLabel: string;
  cancelHref: string;
  onSubmit: (values: TemplateFormValues) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues.name);
  const [body, setBody] = useState(initialValues.body);
  const [severity, setSeverity] = useState<TemplateSeverityValue>(initialValues.severity ?? "");
  const [secretType, setSecretType] = useState<TemplateSecretTypeValue>(initialValues.secretType ?? "");
  const [includeAttributionLine, setIncludeAttributionLine] = useState(
    initialValues.includeAttributionLine ?? false
  );
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [bodyError, setBodyError] = useState<string | undefined>(undefined);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  const canSubmit = name.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    setBodyError(undefined);
    setSavedSuccessfully(false);

    const trimmedName = name.trim();
    const trimmedBody = body;

    if (!trimmedName) {
      setNameError("Template name is required.");
      return;
    }
    if (!trimmedBody.trim()) {
      setBodyError("Template body is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit({
        name: trimmedName,
        body: trimmedBody,
        severity,
        secretType,
        includeAttributionLine,
      });
      if (!result.ok) {
        // InvalidVariableError messages read "Unsupported template
        // variable: {{x}}" — route those (and any other body-shaped
        // message) to the Body field, matching the Figma Invalid Variable
        // state; anything else goes to the Name field.
        if (/variable|body/i.test(result.message)) {
          setBodyError(result.message);
        } else {
          setNameError(result.message);
        }
        return;
      }
      if (mode === "edit") {
        // Figma's Save Success state keeps the admin on the same Edit
        // Template screen with a success banner rather than navigating
        // away — only Edit shows this state in Figma.
        setSavedSuccessfully(true);
        router.refresh();
      } else {
        router.push("/admin/templates");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <p className="text-sm text-fg-muted">{breadcrumbLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-8 text-fg-default">{title}</h1>
      </div>

      {savedSuccessfully && <Alert variant="success">Template saved successfully.</Alert>}

      <form onSubmit={handleSubmit} className="flex w-full max-w-[640px] flex-col gap-5">
        <Input
          label="Template Name"
          name="name"
          placeholder="e.g. Default Secret Finding"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSavedSuccessfully(false);
          }}
          error={nameError}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="template-body" className="text-xs font-medium text-fg-default">
            Template Body
          </label>
          <textarea
            id="template-body"
            name="body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSavedSuccessfully(false);
            }}
            disabled={submitting}
            aria-invalid={!!bodyError}
            aria-describedby={bodyError ? "template-body-error" : "template-body-help"}
            rows={7}
            className={`w-full resize-y rounded-small border px-3 py-2.5 font-mono text-[13px] text-fg-default bg-canvas-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis/40 ${
              bodyError ? "border-danger-emphasis" : "border-border-default"
            }`}
          />
          {bodyError && (
            <p id="template-body-error" className="text-xs text-danger-fg">
              {bodyError}
            </p>
          )}
          <p id="template-body-help" className="text-xs text-fg-subtle">
            {AVAILABLE_VARIABLES_CAPTION}
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
          <div className="flex w-full flex-col gap-1.5 sm:w-1/2">
            <label htmlFor="template-severity" className="text-xs font-medium text-fg-default">
              Severity (optional)
            </label>
            <select
              id="template-severity"
              name="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as TemplateSeverityValue)}
              disabled={submitting}
              className="w-full rounded-small border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis/40"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:w-1/2">
            <label htmlFor="template-secret-type" className="text-xs font-medium text-fg-default">
              Secret type (optional)
            </label>
            <select
              id="template-secret-type"
              name="secretType"
              value={secretType}
              onChange={(e) => setSecretType(e.target.value as TemplateSecretTypeValue)}
              disabled={submitting}
              className="w-full rounded-small border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis/40"
            >
              {SECRET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 rounded-small border border-border-muted bg-canvas-subtle p-3">
          <label htmlFor="template-attribution" className="flex items-start gap-2 text-sm text-fg-default">
            <input
              id="template-attribution"
              name="includeAttributionLine"
              type="checkbox"
              checked={includeAttributionLine}
              onChange={(e) => setIncludeAttributionLine(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-border-default"
            />
            <span>Include soft attribution line in this template&apos;s rendered issue body</span>
          </label>
          <p className="pl-6 text-xs text-fg-subtle">{ATTRIBUTION_LINE_PREVIEW}</p>
        </div>

        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={() => router.push(cancelHref)}
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

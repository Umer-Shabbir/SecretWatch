/**
 * Message template variable rendering (M07), shared between apps/worker
 * (flagger.worker.ts, renders the GitHub issue body) and apps/web (M09
 * template editor preview, once built). Supports {{repo}}, {{file}},
 * {{rule}} per ARCHITECTURE.md section 4's MessageTemplate.body comment.
 *
 * SECURITY: variables are populated only from Finding.repoFullName/filePath/
 * matchedRule — never from redactedSnippet or any raw secret value. Callers
 * must not add a variable backed by secret material.
 */

export interface TemplateVariables {
  repo: string;
  file: string;
  rule: string;
}

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*(repo|file|rule)\s*\}\}/g;

export function renderTemplate(body: string, vars: TemplateVariables): string {
  return body.replace(TEMPLATE_VARIABLE_PATTERN, (_match, key: keyof TemplateVariables) => vars[key]);
}

/**
 * General `{{ ... }}` token matcher — unlike TEMPLATE_VARIABLE_PATTERN above
 * (which only matches the supported repo/file/rule names), this matches ANY
 * `{{...}}`-shaped token regardless of its inner name. Added for M09 (Message
 * Template admin editor), which needs to find and report *unsupported*
 * variable names back to the admin (e.g. `{{secret}}` -> "unsupported
 * variable: secret") rather than silently leaving them unrendered. Additive
 * only — does not change renderTemplate's behavior or the pattern above.
 */
const GENERIC_TEMPLATE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]*)\s*\}\}/g;

const SUPPORTED_TEMPLATE_VARIABLES: ReadonlySet<string> = new Set(["repo", "file", "rule"]);

/**
 * Scans `body` for `{{...}}` tokens and returns the inner names (in
 * first-seen order, duplicates included) that are NOT one of the supported
 * variables (repo, file, rule). Returns an empty array when every token is
 * supported (including when there are no tokens at all).
 */
export function findUnsupportedVariables(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(GENERIC_TEMPLATE_TOKEN_PATTERN)) {
    const name = match[1];
    if (!SUPPORTED_TEMPLATE_VARIABLES.has(name)) {
      found.push(name);
    }
  }
  return found;
}

export const DEFAULT_TEMPLATE_NAME = "Default Secret Finding";

export const DEFAULT_TEMPLATE_BODY = `A potential leaked secret was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual secret value is not included in this issue. Please rotate/revoke the credential if it is genuine, then remove it from source control (e.g. via git history rewrite + secret rotation) and consider adding a .gitignore entry or pre-commit secret scan to prevent recurrence.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`;

/**
 * Optional, admin-toggleable soft attribution line (2026-08-17 addition).
 * Fixed constant, never a per-template freeform value — a template only
 * carries a boolean (`includeAttributionLine`) saying whether to append this
 * exact line, never its own custom URL/copy. This keeps the line
 * unambiguously "clearly a placeholder" and prevents it from being repurposed
 * to inject an arbitrary link into a GitHub issue body.
 *
 * Deliberately NOT a wallet address, NOT a star-request, and NOT a direct
 * donation ask — a single neutral sentence pointing at a placeholder project
 * URL. The `TODO-project-org` segment is intentionally left as a visible
 * placeholder until a real project org/repo exists.
 */
export const ATTRIBUTION_LINE =
  "If you'd like to support this project, visit: https://github.com/TODO-project-org/secretwatch";

/**
 * Appends ATTRIBUTION_LINE to `body` when `include` is true, separated from
 * the rendered body by a blank line. No-op (returns `body` unchanged) when
 * `include` is false/omitted — the line is never force-appended.
 */
export function appendAttributionLine(body: string, include: boolean | undefined): string {
  if (!include) return body;
  return `${body}\n\n${ATTRIBUTION_LINE}`;
}

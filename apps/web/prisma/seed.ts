import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_BODY } from "@secretwatch/shared";

const prisma = new PrismaClient();

/**
 * Initial hardcoded scan rule set (M04). Source of truth for the literal
 * pattern strings lives in apps/worker/src/rules/definitions.ts — kept in
 * sync manually since the worker package isn't imported here (Next.js app
 * vs. standalone worker package; duplicating a small readonly array is
 * simpler than adding a cross-package import for a one-time seed script).
 * Rule editing UI is out of scope for M04 (M08) — this only bootstraps rows
 * so the scanner has something to evaluate out of the box.
 */
const INITIAL_SCAN_RULES = [
  { name: "AWS Access Key", pattern: "(?:AKIA|ASIA)[0-9A-Z]{16}", enabled: true },
  {
    name: "AWS Secret Key",
    pattern: "(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\\s*[:=]\\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?",
    enabled: true,
  },
  {
    name: "GitHub Token",
    pattern: "(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,255}",
    enabled: true,
  },
  { name: "Stripe Secret Key", pattern: "sk_(?:live|test)_[A-Za-z0-9]{24,99}", enabled: true },
  { name: "Slack Token", pattern: "xox[baprs]-[A-Za-z0-9-]{10,72}", enabled: true },
  {
    name: "Generic High-Entropy String",
    pattern: "(?:api[_-]?key|secret|token|password|passwd|pwd)\\s*[:=]\\s*['\"]([A-Za-z0-9_\\-/+]{20,100})['\"]",
    enabled: true,
  },
];

async function seedScanRules() {
  for (const rule of INITIAL_SCAN_RULES) {
    const existing = await prisma.scanRule.findFirst({ where: { name: rule.name } });
    if (existing) {
      // Preserve any admin edits (e.g. enabled toggled off) — only fill in
      // pattern if somehow missing. Do not clobber existing data.
      continue;
    }
    await prisma.scanRule.create({ data: rule });
  }
  console.log(`Scan rules ready (${INITIAL_SCAN_RULES.length} defaults checked).`);
}

/**
 * Bootstraps the default message template (M07) so the flagger worker has
 * something to render out of the box. apps/worker/src/flagger.worker.ts
 * also self-heals this (getOrCreateDefaultTemplate) if it's ever missing,
 * but seeding it here keeps a fresh install's admin Templates list (M09)
 * non-empty immediately. Never clobbers an existing default template's
 * admin-edited body.
 */
async function seedDefaultTemplate() {
  const existing = await prisma.messageTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return;
  await prisma.messageTemplate.create({
    data: { name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY, isDefault: true },
  });
  console.log("Default message template ready.");
}

/**
 * Seeds severity-based tone variants and secret-type-specific variants of
 * the issue-body message template (2026-08-17 addition). All are
 * `isDefault: false` — the worker only ever selects the isDefault: true row
 * (see lib/messageTemplates.ts's module doc comment), so seeding these has
 * no effect on which template is actually used to flag a Finding today; they
 * exist so an admin has ready-made starting points to edit/promote/copy
 * from, and so severity/secretType classification has real seeded examples
 * rather than shipping the columns with zero populated rows.
 *
 * `includeAttributionLine` is left `false` on every seeded template — the
 * soft attribution line is opt-in only, never seeded on by default.
 *
 * Idempotent: matched by `name`, never overwrites an existing row's
 * admin-edited body (same non-clobber precedent as seedDefaultTemplate /
 * seedScanRules above).
 */
const SEVERITY_TEMPLATE_VARIANTS = [
  {
    name: "Severity: Critical",
    severity: "CRITICAL" as const,
    body: `**CRITICAL: Immediate action required.**

A potential leaked secret was detected in this repository by automated scanning. This class of finding is treated as critical because it typically grants direct, high-impact access if genuine.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual secret value is not included in this issue. Please rotate/revoke the credential immediately if it is genuine, then remove it from source control (e.g. via git history rewrite + secret rotation).

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Severity: High",
    severity: "HIGH" as const,
    body: `**High severity finding.**

A potential leaked secret was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual secret value is not included in this issue. Please prioritize rotating/revoking the credential if it is genuine, then remove it from source control.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Severity: Medium",
    severity: "MEDIUM" as const,
    body: `**Medium severity finding.**

A potential leaked secret was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual secret value is not included in this issue. When convenient, please verify whether this credential is genuine and rotate it if so, then remove it from source control.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Severity: Low",
    severity: "LOW" as const,
    body: `**Low severity finding — for awareness.**

A potential secret-shaped string was detected in this repository by automated scanning; it may be a false positive, a test fixture, or low-risk.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual matched value is not included in this issue. No immediate action is required, but please confirm this isn't a genuine credential and remove it from source control if so.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
];

const SECRET_TYPE_TEMPLATE_VARIANTS = [
  {
    name: "Secret type: AWS Access Key",
    secretType: "AWS_KEY" as const,
    body: `A potential AWS access key was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual key value is not included in this issue. If genuine: deactivate/rotate the key in the AWS IAM console immediately, review CloudTrail for unauthorized usage, then remove it from source control.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Secret type: GitHub Token",
    secretType: "GITHUB_TOKEN" as const,
    body: `A potential GitHub token (personal access token or app token) was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual token value is not included in this issue. If genuine: revoke the token from GitHub Settings > Developer settings immediately, then remove it from source control.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Secret type: Generic API Key",
    secretType: "GENERIC_API_KEY" as const,
    body: `A potential API key was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual key value is not included in this issue. If genuine: rotate the key with the issuing provider, then remove it from source control and consider adding a pre-commit secret scan.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
  {
    name: "Secret type: Database Connection String",
    secretType: "DB_CONNECTION_STRING" as const,
    body: `A potential database connection string (with embedded credentials) was detected in this repository by automated scanning.

- **File:** \`{{file}}\`
- **Rule matched:** {{rule}}

The actual connection string is not included in this issue. If genuine: rotate the database credential and review access logs for unauthorized connections, then remove it from source control.

_This issue was opened automatically by SecretWatch on behalf of an authorized user. Repository: {{repo}}._`,
  },
];

async function seedTemplateVariants() {
  let created = 0;
  for (const variant of [...SEVERITY_TEMPLATE_VARIANTS, ...SECRET_TYPE_TEMPLATE_VARIANTS]) {
    const existing = await prisma.messageTemplate.findFirst({ where: { name: variant.name } });
    if (existing) continue;
    await prisma.messageTemplate.create({
      data: {
        name: variant.name,
        body: variant.body,
        isDefault: false,
        severity: "severity" in variant ? variant.severity : null,
        secretType: "secretType" in variant ? variant.secretType : null,
        includeAttributionLine: false,
      },
    });
    created += 1;
  }
  console.log(`Message template variants ready (${created} created, ${8 - created} already present).`);
}

/**
 * Bootstraps exactly one ADMIN account from environment variables.
 * There is no self-serve admin signup — admins are provisioned out-of-band
 * by whoever controls deployment env vars. Never logs the password.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed.");
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
      where: { email: email.toLowerCase().trim() },
      update: { role: "ADMIN", passwordHash },
      create: {
        email: email.toLowerCase().trim(),
        username: "admin",
        role: "ADMIN",
        passwordHash,
      },
    });

    console.log(`Admin account ready for ${email}.`);
  }

  await seedScanRules();
  await seedDefaultTemplate();
  await seedTemplateVariants();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

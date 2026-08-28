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
    body: `## 🚨 Critical Secret Exposure Detected by SecretWatch

SecretWatch has identified a **critical** potential leaked credential in **{{repo}}**. This class of finding typically grants direct, high-impact access if genuine — immediate action is strongly recommended.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |
| **Severity** | Critical |

### What you should do

1. **Rotate or revoke** the credential immediately with the issuing provider — do not wait to verify first.
2. **Remove** the secret from source control using \`git filter-repo\`, \`BFG Repo-Cleaner\`, or a history rewrite (a simple delete commit is not enough).
3. **Audit** for unauthorized usage of this credential since its exposure.
4. **Prevent recurrence** by using environment variables or a secrets manager, and enabling a pre-commit secret scanning hook.

The actual secret value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Severity: High",
    severity: "HIGH" as const,
    body: `## ⚠️ High-Severity Secret Detected by SecretWatch

SecretWatch has identified a **high-severity** potential leaked credential in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |
| **Severity** | High |

### What you should do

1. **Verify** whether the detected value is a genuine credential.
2. **Rotate or revoke** the credential promptly if it is real.
3. **Remove** the secret from source control using a history rewrite tool (\`git filter-repo\` or \`BFG Repo-Cleaner\`).
4. **Prevent recurrence** by using environment variables or a secrets manager.

The actual secret value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Severity: Medium",
    severity: "MEDIUM" as const,
    body: `## ⚠️ Medium-Severity Secret Detected by SecretWatch

SecretWatch has identified a **medium-severity** potential leaked credential in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |
| **Severity** | Medium |

### What you should do

1. **Verify** whether the detected value is a genuine credential (it may be a test fixture or example).
2. **Rotate** the credential if genuine, then remove it from source control.
3. **Prevent recurrence** by adding the file to \`.gitignore\` and using environment variables.

The actual secret value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Severity: Low",
    severity: "LOW" as const,
    body: `## ℹ️ Low-Severity Finding by SecretWatch

SecretWatch has identified a potential secret-shaped string in **{{repo}}**. This may be a false positive, a test fixture, or a low-risk value — no immediate action is required.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |
| **Severity** | Low |

### Recommended action

Please confirm this is not a genuine credential. If it is, rotate it and remove it from source control. If it is a test value or false positive, no action is needed — you can close this issue.

The actual matched value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch).`,
  },
];

const SECRET_TYPE_TEMPLATE_VARIANTS = [
  {
    name: "Secret type: AWS Access Key",
    secretType: "AWS_KEY" as const,
    body: `## ⚠️ Potential AWS Access Key Detected by SecretWatch

SecretWatch has identified a potential **AWS access key** in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |

### What you should do

1. **Deactivate/rotate** the key in the [AWS IAM console](https://console.aws.amazon.com/iam/) immediately.
2. **Review CloudTrail** logs for any unauthorized usage since the key was exposed.
3. **Remove** the key from source control using a history rewrite tool (\`git filter-repo\` or \`BFG Repo-Cleaner\`).
4. **Prevent recurrence** by using IAM roles, environment variables, or AWS Secrets Manager instead of hardcoded keys.

The actual key value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Secret type: GitHub Token",
    secretType: "GITHUB_TOKEN" as const,
    body: `## ⚠️ Potential GitHub Token Detected by SecretWatch

SecretWatch has identified a potential **GitHub token** (personal access token or app token) in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |

### What you should do

1. **Revoke** the token from [GitHub Settings > Developer settings](https://github.com/settings/tokens) immediately.
2. **Review** recent activity on any repositories or organizations the token had access to.
3. **Remove** the token from source control using a history rewrite tool (\`git filter-repo\` or \`BFG Repo-Cleaner\`).
4. **Prevent recurrence** by using environment variables and never committing tokens to source control.

The actual token value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Secret type: Generic API Key",
    secretType: "GENERIC_API_KEY" as const,
    body: `## ⚠️ Potential API Key Detected by SecretWatch

SecretWatch has identified a potential **API key** in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |

### What you should do

1. **Verify** whether the detected value is a genuine credential.
2. **Rotate** the key with the issuing provider if it is real.
3. **Remove** the key from source control using a history rewrite tool.
4. **Prevent recurrence** by using environment variables or a secrets manager, and enabling a pre-commit secret scanning hook.

The actual key value is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
  },
  {
    name: "Secret type: Database Connection String",
    secretType: "DB_CONNECTION_STRING" as const,
    body: `## ⚠️ Potential Database Connection String Detected by SecretWatch

SecretWatch has identified a potential **database connection string** with embedded credentials in **{{repo}}**.

| Detail | Value |
|--------|-------|
| **Repository** | \`{{repo}}\` |
| **File** | \`{{file}}\` |
| **Rule matched** | {{rule}} |

### What you should do

1. **Rotate** the database password immediately.
2. **Review** database access logs for any unauthorized connections since the string was exposed.
3. **Remove** the connection string from source control using a history rewrite tool.
4. **Prevent recurrence** by using environment variables or a secrets manager — never hardcode database credentials.

The actual connection string is not included in this issue for safety. This issue was opened automatically by [SecretWatch](https://github.com/TODO-project-org/secretwatch). If you believe this is a false positive, you can close this issue.`,
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

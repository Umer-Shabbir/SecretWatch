# SecretWatch Product Source of Truth

## Product

SecretWatch is a full web application for discovering potential leaked API keys/secrets in public GitHub repositories/code search and reporting findings through GitHub issues.

**2026-08-17 scope correction — no end-user accounts, no per-user OAuth/PAT ownership.** SecretWatch has no self-serve signup, no end-user login, and no per-user dashboard. There are no end-user accounts of any kind. The only account type in the system is ADMIN, provisioned out-of-band (via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars at seed time) and signed in via an email+password Credentials form — never GitHub OAuth login. GitHub tokens used for scanning/flagging are submitted **globally and publicly**, with no login required and no per-user ownership: any visitor can submit a GitHub personal access token via a public form, which is encrypted at rest and pooled for the scanner/flagger workers to use. Admins can view (masked only) and deactivate submitted tokens, but no token is "owned" by a submitting user — this mirrors how `Finding`/`Flag` rows already have no per-user ownership.

The product has:

- public marketing site
- public, no-login GitHub token submission form
- admin panel (the only authenticated area)
- scan/findings history (admin-visible)
- review queue
- scan rules
- message templates
- worker monitoring

## Core security behavior

The raw secret value is never persisted.

A finding stores:

- repository
- file path
- commit SHA
- matched rule
- redacted snippet
- status

The flag record stores the issue URL, token reference, template reference, and timestamp.

Submitted GitHub tokens are stored AES-256-GCM encrypted at rest; only a display-safe masked identifier (e.g. `ghp_••••••••••••••••••••••••abcd`) is ever returned by any API or shown in any UI. The raw token value is never logged, echoed back in an API response, or displayed to an admin after submission — it exists in plaintext only transiently, in memory, during initial encryption.

Message templates (used to render the body of GitHub issues the flagger opens) may optionally be tagged with a `severity` (Critical/High/Medium/Low) and/or `secretType` (AWS Key/GitHub Token/Generic API Key/DB Connection String) for admin organization, and may optionally include a single fixed, non-editable soft attribution line in their rendered body (off by default, toggled per template — never a per-template freeform link/ask). The flagger worker still selects only the one `isDefault` template to render per Finding; severity/secretType do not yet drive automatic template selection — that is a documented follow-up, not current behavior.

## Core roles

- ADMIN — the only account type. Signs in via email+password Credentials auth at `/admin-sign-in`. All `/admin/*` routes and their backing APIs require an authenticated ADMIN session (enforced server-side by `middleware.ts`'s `/admin/:path*` matcher and by each API route's `requireAdmin()` check).

There is no USER role account/session in this product. (The `Role` enum in `prisma/schema.prisma` retains a `USER` value for backward-compatible typing only; no code path creates or authenticates a USER-role session today.)

## Finding statuses

- PENDING
- APPROVED
- FLAGGED
- IGNORED
- FAILED

## Worker responsibilities

### Scanner

Searches GitHub code, evaluates regex/entropy rules, and writes findings.

### Flagger

Processes approved findings and creates GitHub issues using a globally-submitted, admin-managed GitHub token (round-robins active tokens, least-recently-used first) — not a per-user credential, since no end-user accounts exist.

### Scheduler

Creates recurring scan jobs through BullMQ.

## UI areas

### Marketing

- Landing
- Pricing
- How It Works

### Public (no login)

- Submit Token — the public GitHub-token submission form (`/submit-token`), replacing what earlier drafts of this document described as a per-user "Tokens" screen. No end-user account, session, or per-user "Overview"/"Findings"/"Flags"/"Scan Rules" dashboard exists — those were part of an earlier, superseded per-user product model and have been removed from both the product and the codebase as of the 2026-08-17 scope correction.

### Admin (the only authenticated area)

- Sign In (`/admin-sign-in`) — email+password Credentials auth
- Review Queue
- Findings
- Tokens — admin-only view (masked identifiers only) + deactivate for all globally-submitted GitHub tokens; replaces the earlier per-user "Tokens" screen
- Rules
- Templates
- Workers

There is no admin "Users" screen — user management (previously scoped as module M11) was removed along with the per-user account model; there are no end-user accounts to manage. `Users`/`USER role management` mentioned in earlier drafts of this document is superseded by this section.

## Figma source of truth

The Figma system must use normal frames, not Sections.

Every screen is isolated spatially and named:

`[AREA] / [SCREEN] / [STATE]`

The Figma design system is the visual source of truth for frontend implementation.

## Module principle

A module should represent a cohesive vertical slice whenever possible.

A vertical slice includes:

Figma → business logic/backend → API/data → frontend → integration → verification.

Do not create disconnected mock screens that cannot eventually be wired to real behavior.

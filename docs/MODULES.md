# SecretWatch Module Registry

## Dependency graph

```text
M00 Foundation
 ├── M01 Authentication
 ├── M02 User Overview
 ├── M03 Token & GitHub Authorization
 │    └── M04 Scanner + Findings
 │         ├── M05 Finding Detail
 │         ├── M06 Review Queue
 │         └── M07 Flagger + Flags
 ├── M08 Scan Rules
 ├── M09 Message Templates
 ├── M10 Worker Monitoring
 ├── M11 User Management
 └── M12 Marketing Site
      └── M13 Hardening + Deployment
```

## M00 — Foundation + Figma Design System

Scope:

- repository bootstrap
- shared layout
- CSS variables
- typography
- spacing
- light/dark theme
- base components
- Figma file structure
- Figma variables/styles/components
- app shell
- header
- sidebar
- responsive foundations

Exit:

- Figma design system exists
- app shell implemented
- tokens mapped to code
- base component inventory usable
- no screen overlap

## M01 — Authentication

Scope:

- GitHub OAuth
- admin authentication/authorization
- sessions
- protected route boundaries
- auth screens/states

Exit:

- user can authenticate
- admin role is enforced
- unauthorized routes are protected
- Figma auth states match implementation

## M02 — User Overview

Scope:

- dashboard overview
- scan status
- recent findings
- flag summary
- token/account status
- scan controls

Exit:

- real data or explicit empty/loading/error states
- responsive
- wired to backend

## M03 — GitHub Token & Authorization

Scope:

- token/OAuth management
- encrypted storage
- token status
- rate limit visibility
- revoke/delete flow
- security confirmation states

Exit:

- no raw token leakage
- encrypted persistence
- audit logging where required

## M04 — Scanner + Findings

Scope:

- scanner worker
- GitHub code search
- regex/entropy rule evaluation
- finding persistence
- deduplication/idempotency
- findings list UI
- filtering/pagination

Exit:

- scan produces safe findings
- raw secrets never persist
- UI uses real data

## M05 — Finding Detail

Scope:

- repository/file/commit context
- matched rule
- redacted evidence
- finding status
- action controls
- detail API

Exit:

- raw secret impossible to display
- actions are authorization-checked

## M06 — Admin Review Queue

Scope:

- pending findings
- approve
- ignore
- filters
- confirmation dialog
- audit trail

Exit:

- review gate works
- state transitions are validated server-side

## M07 — Flagger + Flags

Scope:

- flagging worker
- GitHub issue creation
- template rendering
- token rotation
- rate limit awareness
- retry/backoff
- flags history UI

Exit:

- issue creation is auditable
- failures are visible
- no uncontrolled automation beyond configured limits

## M08 — Scan Rules

Scope:

- rule list
- rule editor
- regex validation
- enable/disable
- API
- worker consumption

## M09 — Message Templates

Scope:

- template list/editor
- supported variables
- preview
- validation
- persistence

## M10 — Worker Monitoring

Scope:

- scanner/flagger/scheduler health
- queue counts
- last jobs
- failures
- rate-limit metrics
- operational states

## M11 — User Management

Scope:

- admin user list
- role
- token/account status
- activity
- safe administrative actions

## M12 — Marketing Site

Scope:

- landing
- pricing
- how it works
- trust/security messaging
- responsive SEO-ready surfaces

## M13 — Hardening + Deployment

Scope:

- production configuration
- security headers
- rate limiting
- logging
- health checks
- Railway deployment
- worker deployment
- Postgres/Redis configuration
- final accessibility/performance audit

## Completion rule

A module is DONE only when:

- Figma design complete
- implementation complete
- integration complete
- tests/checks pass
- visual audit complete where applicable
- security review complete where applicable
- module state recorded

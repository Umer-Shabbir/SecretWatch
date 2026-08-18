# SecretWatch Claude Code Operating Rules

## 1. Mission

You are building SecretWatch, a GitHub-focused security SaaS that scans public GitHub code for possible leaked API keys/secrets, records findings without storing raw secrets, and can create GitHub issues through authorized user credentials.

Read these before implementation:

- `ARCHITECTURE.md`
- `DESIGN.md`
- `docs/PRODUCT_SOURCE_OF_TRUTH.md`
- `docs/MODULES.md`
- `docs/AGENT_PROTOCOL.md`

## 2. Source-of-truth hierarchy

When sources conflict:

1. Current user instruction in the active task
2. `ARCHITECTURE.md` for architecture/data/security/backend behavior
3. `DESIGN.md` for visual/interaction/Figma behavior
4. `docs/MODULES.md` for workflow/module boundaries
5. Existing implementation, only when it does not contradict the above

Never silently invent a product requirement.

## 3. One-module rule

The default unit of work is exactly ONE module.

A module is not complete until:

- its plan exists
- its Figma work is complete
- backend/business logic required by the module exists
- frontend is implemented from Figma
- frontend/backend integration works
- tests/checks pass
- security constraints pass
- visual verification is performed where possible
- module status is marked `DONE`

After one module reaches `DONE`, STOP.

Never automatically start the next module.

## 4. Multi-agent safety

Before changing module files:

```bash
node scripts/module-status.mjs
node scripts/claim-module.mjs Mxx <agent-id>
```

The claim must succeed.

If the module is already claimed by another agent, STOP and report the owner.

Do not remove another agent's lock.

Release only your own lock:

```bash
node scripts/release-module.mjs Mxx <agent-id>
```

Agents must not modify another module's implementation files.

Shared files require extra care:

- package manifests
- Prisma schema
- shared types
- global CSS/tokens
- shared UI components
- navigation
- env examples
- database migrations

If a module needs a shared change, record it in its module change log and keep the change backward compatible.

## 5. Git safety

Before implementation:

- inspect `git status`
- never reset or discard user work
- never rewrite unrelated changes
- never force-push
- never delete branches/worktrees belonging to other agents

Prefer a dedicated branch/worktree for parallel work.

## 6. Figma rules

Figma is a source of truth for UI implementation.

Use normal Figma frames.

Never use Figma Sections for application screens.

Every screen gets its own separated frame.

Minimum recommended frame gap:

- horizontal: 120px
- vertical: 120px

Screen naming:

`[AREA] / [SCREEN] / [STATE]`

Examples:

- `Marketing / Landing / Default`
- `Dashboard / Overview / Default`
- `Dashboard / Findings / Default`
- `Dashboard / Finding Detail / Pending`
- `Admin / Review Queue / Default`
- `Admin / Workers / Default`
- `Admin / Rules / Default`

Do not place frames on top of one another.

Reuse components. Do not manually duplicate reusable buttons, inputs, tables, badges, cards, navigation, modals, or alerts.

## 7. Design rules

The design system is GitHub Native:

- light theme first
- dark theme supported
- Inter for UI
- JetBrains Mono for technical values
- compact information-dense layouts
- borders over shadows
- restrained radius
- blue for primary actions
- explicit text + icon for statuses
- no neon cyberpunk styling
- no fake hacker terminal aesthetic
- no excessive gradients
- no decorative UI that does not improve security workflows

Use semantic CSS variables/tokens rather than scattered raw colors.

## 8. Security rules

Never:

- store raw discovered secrets
- display raw tokens
- log raw tokens
- put tokens in screenshots
- put credentials in source control
- print decrypted tokens during debugging

Findings may contain only redacted snippets.

GitHub tokens must be encrypted at rest and decrypted only in memory when required.

Prefer OAuth/scoped authorization over asking users to paste raw PATs when the architecture permits it.

Admin review should remain enabled by default for flagging behavior.

## 9. Implementation rules

Do not rewrite the whole repository just to implement a module.

Prefer:

- small changes
- reusable components
- typed boundaries
- explicit API contracts
- migrations
- tests
- deterministic validation

The intended stack is:

- Next.js 14 App Router
- TypeScript
- Tailwind
- Auth.js
- PostgreSQL
- Prisma
- BullMQ
- Redis/Upstash
- Node workers

Follow the architecture document when implementation details are ambiguous.

## 10. Verification

Every module must end with a verification pass.

At minimum:

- typecheck
- lint
- unit/integration tests relevant to the module
- build when practical
- route/API verification
- database migration validation when applicable
- Figma visual audit for UI modules
- security audit for auth/token/finding/flagging modules

Never declare success because code "looks right".

## 11. Stop conditions

STOP immediately if:

- the module is locked by another agent
- a required product decision is missing
- a destructive database change is required without approval
- a security-sensitive behavior is unclear
- Figma MCP is unavailable for a task that explicitly requires writing to Figma
- implementation would require changing unrelated modules
- verification fails and cannot be fixed safely

Report the exact blocker and stop.

## 12. Completion record

Every completed module must update:

`state/modules/Mxx.json`

with:

- status
- owner
- timestamps
- changed files
- Figma nodes/URLs if known
- tests/checks
- known follow-ups

Then release the module lock and stop.

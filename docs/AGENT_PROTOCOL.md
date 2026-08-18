# Agent Protocol

## Agent IDs

Use stable IDs:

- `orchestrator`
- `figma-architect`
- `figma-designer`
- `backend-builder`
- `frontend-builder`
- `integration-builder`
- `qa-reviewer`
- `security-reviewer`
- `figma-auditor`

## Ownership

Exactly one implementation agent owns a module at a time.

Example:

```text
M04 owner = frontend-builder@M04
```

Other agents may review the module but must not change its implementation files unless ownership is explicitly transferred.

## Lock states

- `AVAILABLE`
- `CLAIMED`
- `DESIGNING`
- `BACKEND`
- `FRONTEND`
- `INTEGRATING`
- `VERIFYING`
- `REVIEWING`
- `DONE`
- `BLOCKED`

## Claim protocol

```bash
node scripts/claim-module.mjs M04 frontend-builder@M04
```

If the command exits non-zero, do not edit the module.

## Handoff protocol

A module handoff must include:

```text
Module:
Owner:
Status:
What changed:
Figma:
Backend:
Frontend:
Tests:
Known issues:
Files changed:
Next action:
```

## Shared-file protocol

If a module needs a shared file:

1. inspect whether another module owns it
2. make the smallest backward-compatible change
3. record the change in the module status
4. never delete or refactor unrelated code
5. run affected tests

## Parallel work

Safe parallelism:

- M04 backend + M12 marketing is safe if they touch separate files
- M04 frontend + M08 workers is safe if boundaries are separate

Unsafe:

- two agents editing `prisma/schema.prisma`
- two agents editing global design tokens
- two agents changing navigation
- two agents editing the same Figma file simultaneously without explicit node ownership

## Figma ownership

The Figma designer owns the screen nodes it creates.

The Figma auditor is read-only.

The frontend agent reads Figma but does not modify Figma unless explicitly asked to reconcile an implementation capture.

## Stop-after-module

A worker never continues into the next module after completion.

The orchestrator must wait for the user command `continue`.

---
name: orchestrate-module
description: Run exactly one SecretWatch module from planning through verification, then stop. Use when the user says bootstrap, continue, work on a module, or asks to advance the build.
---

## Rules

1. Read `docs/MODULES.md`.
2. Inspect `state/modules/`.
3. Select exactly one eligible module.
4. Claim it before edits.
5. Delegate/read specialists as appropriate.
6. Run the module lifecycle:
   PLAN → FIGMA → BACKEND → FRONTEND → INTEGRATE → VERIFY → REVIEW → DONE.
7. Do not start another module.
8. Release the lock.
9. Report the result.
10. Stop.

Use module locks as mandatory coordination, not advisory metadata.

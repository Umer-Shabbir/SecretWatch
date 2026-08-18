---
name: verify-module
description: Verify a SecretWatch module before it can be marked DONE.
---

Run the smallest relevant validation set:

- typecheck
- lint
- unit tests
- integration/API tests
- build
- migration validation
- route verification
- security checks
- visual/Figma verification for UI modules

Inspect git diff.

Check that no raw credentials/secrets were added to source, logs, fixtures, snapshots, screenshots, or test output.

If verification fails, fix only the current module or report a blocker.

Never mark DONE on failed verification.

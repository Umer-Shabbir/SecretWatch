---
name: claim-module
description: Safely claim a SecretWatch module before changing it. Use before any module implementation work.
---

Run:

```bash
node scripts/claim-module.mjs <module-id> <agent-id>
```

If the command fails because another owner has the module, do not edit the module.

After claiming, inspect the module's current state and repository status.

A claim is not permission to modify unrelated modules.

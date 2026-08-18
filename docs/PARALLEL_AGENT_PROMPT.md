# Parallel Agent Prompt

You are a parallel SecretWatch worker.

Your assigned module is `<MODULE_ID>`.

Before touching files:

```bash
node scripts/claim-module.mjs <MODULE_ID> <AGENT_ID>
```

If the claim fails, do nothing.

You may edit only files required by your module. Shared files must be changed minimally and backward-compatibly.

You may review other modules but must not modify them.

Complete only your assigned module.

At completion:

1. update its state
2. set status DONE or BLOCKED
3. release the lock
4. report handoff
5. stop

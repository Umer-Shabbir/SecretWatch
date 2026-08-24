# SecretWatch Agent Prompts

Ready-to-paste prompts for driving SecretWatch's one-module-at-a-time workflow.
All three obey the rules in `.claude/CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`,
`docs/PRODUCT_SOURCE_OF_TRUTH.md`, `docs/MODULES.md`, and `docs/AGENT_PROTOCOL.md`.

Open work: **M12 Marketing Site**, then **M13 Hardening + Deployment**.
(M02 and M11 are REMOVED — see `docs/MODULES.md`. Do not build them.)

---

## Bootstrap (scout only, no changes)

> You are the SecretWatch orchestrator. Do not implement anything yet.
> 1. Inspect repository state (`git status`, `node scripts/module-status.mjs`).
> 2. Inspect Figma MCP availability (`/mcp` or Figma tools).
> 3. Inspect module states in `state/modules/`.
> 4. Identify the next eligible module.
> 5. Report blockers and the exact next action, then STOP.
>
> After I say `continue`, implement exactly one module and stop when it reaches
> DONE or BLOCKED.

---

## Continue (implement exactly one module)

> Continue SecretWatch development. You MUST:
> 1. Select exactly one eligible module.
> 2. Claim it: `node scripts/claim-module.mjs Mxx <agent-id>` (must succeed).
> 3. Plan it.
> 4. Design/verify its Figma work via Figma MCP.
> 5. Implement required backend/business logic.
> 6. Implement the frontend from the Figma design.
> 7. Integrate real APIs/data (no mock data where real data is required).
> 8. Verify: typecheck, lint, tests, build where practical, security, a11y,
>    Figma fidelity.
> 9. Update `state/modules/Mxx.json`.
> 10. Release the lock: `node scripts/release-module.mjs Mxx <agent-id>`.
> 11. STOP. Do not start another module.

---

## Parallel worker (one assigned module)

> You are a parallel SecretWatch worker. Your module is `<MODULE_ID>`.
> Before touching files: `node scripts/claim-module.mjs <MODULE_ID> <AGENT_ID>`.
> If the claim fails, do nothing.
> Edit only files required by your module. Shared files (see `.claude/CLAUDE.md`
> §4) change minimally and backward-compatibly. You may read other modules but
> must not modify them.
> At completion: update state, set status DONE or BLOCKED, release the lock,
> report handoff, STOP.

---

See `docs/AGENT_MAP.md` for agent responsibilities and the in-module sequence,
and `docs/IMPLEMENTATION_CHECKLIST.md` for the per-module checklist.

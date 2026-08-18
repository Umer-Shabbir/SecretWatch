# Bootstrap Prompt

Read and obey:

- `.claude/CLAUDE.md`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `docs/PRODUCT_SOURCE_OF_TRUTH.md`
- `docs/MODULES.md`
- `docs/AGENT_PROTOCOL.md`

You are the SecretWatch orchestrator.

Do not implement anything yet.

1. Inspect repository state.
2. Inspect Figma MCP with `/mcp` or available Figma tools.
3. Inspect module states.
4. Identify the next eligible module.
5. Report blockers and exact next action.
6. Stop.

After I say `continue`, implement exactly one module and stop when it reaches DONE or BLOCKED.

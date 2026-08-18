# SecretWatch — Claude Code Multi-Agent Workflow

This package is the development operating system for building SecretWatch module-by-module with Claude Code, Figma MCP, reusable Skills, and project Subagents.

## Source of truth

- `ARCHITECTURE.md` — product architecture, data model, workers, deployment, security, and suggested build order.
- `DESIGN.md` — GitHub Native visual system, components, responsive rules, accessibility, Figma rules, and screen-specific rules.
- `docs/PRODUCT_SOURCE_OF_TRUTH.md` — conflict-resolution rules and non-negotiable product constraints.
- `docs/MODULES.md` — module dependency graph and completion criteria.
- `.claude/CLAUDE.md` — rules Claude Code must load every session.
- `.claude/agents/` — specialized workers.
- `.claude/skills/` — reusable workflows.
- `state/modules/` — machine-readable module locks/status.
- `scripts/` — deterministic module-lock utilities.

## Operating model

The project is intentionally **module-locked**:

1. The orchestrator selects exactly one module.
2. It claims that module with an atomic lock.
3. No other agent may modify that module while the lock is active.
4. The module goes through:
   `PLAN → FIGMA → BACKEND → FRONTEND → INTEGRATE → VERIFY → REVIEW → DONE`
5. The orchestrator stops after the module is complete.
6. You say `continue` to move to the next module.

Agents may work in parallel only when they own different modules and never touch another module's files.

## First setup

### 1. Install Figma MCP

Preferred current setup:

```bash
claude plugin install figma@claude-plugins-official
```

Restart Claude Code, then run:

```text
/plugin
```

Authenticate the Figma plugin and verify with:

```text
/mcp
```

A project-scoped fallback is also included as `.mcp.json.example`.

### 2. Install the workflow

Copy the `.claude/` directory and `scripts/` into the root of your SecretWatch repository.

Copy:

- `ARCHITECTURE.md`
- `DESIGN.md`
- `docs/`
- `state/`
- `scripts/`

The package's source documents are the basis for the workflow.

### 3. Start Claude Code

```bash
claude
```

Then use:

```text
bootstrap
```

or paste:

```text
Read .claude/CLAUDE.md, ARCHITECTURE.md, DESIGN.md, docs/PRODUCT_SOURCE_OF_TRUTH.md, and docs/MODULES.md.

Initialize the module registry and inspect the current repository.

Do not implement anything yet. Report:
1. repository state
2. Figma MCP state
3. current module statuses
4. next eligible module
5. blockers

Then stop.
```

## Normal loop

```text
bootstrap
```

Then:

```text
continue
```

The orchestrator completes one module and stops.

For a specific module:

```text
work on M04
```

For review:

```text
review M04
```

For only the Figma side:

```text
design M04
```

For only verification:

```text
verify M04
```

## Important

Do not let agents "just keep going". The stop-after-one-module rule is deliberate.

Do not treat screenshots as the only design source. Figma MCP should read/write native Figma structure, components, variables, auto layout, and frames where supported.

Do not store raw secrets. The architecture requires encrypted GitHub tokens and redacted finding snippets only.

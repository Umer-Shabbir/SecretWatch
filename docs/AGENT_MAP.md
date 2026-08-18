# Agent Map

| Agent | Owns | Default access |
|---|---|---|
| orchestrator | module lifecycle | broad |
| figma-architect | Figma architecture | Figma + read |
| figma-designer | one module's Figma screens | Figma + read |
| backend-builder | backend/business logic | code + tests |
| frontend-builder | frontend implementation | code + Figma read |
| integration-builder | boundaries/integration | code + tests |
| qa-reviewer | verification | read/test |
| security-reviewer | security review | read/test |
| figma-auditor | Figma audit | read-only |

## Recommended sequence inside a module

```text
orchestrator
  ↓
figma-designer
  ↓
backend-builder
  ↓
frontend-builder
  ↓
integration-builder
  ↓
qa-reviewer + security-reviewer + figma-auditor
  ↓
orchestrator
```

The agents do not need to be separate concurrent sessions for every stage. The purpose of the map is clear responsibility.

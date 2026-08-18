---
name: implement-module
description: Implement a claimed SecretWatch module as a vertical slice: backend, frontend, integration, tests, and verification.
---

## Sequence

1. Read module definition.
2. Inspect Figma frame via MCP.
3. Inspect existing code.
4. Define API/data contract.
5. Implement backend/business logic required by the module.
6. Implement frontend from Figma.
7. Wire frontend to real backend.
8. Add loading/empty/error states.
9. Test.
10. Run security checks relevant to the module.
11. Run visual audit.
12. Update module state.

Do not rewrite unrelated areas.

Use design tokens and reusable components.

Do not leave production UI on fake data unless the module explicitly calls for a prototype.

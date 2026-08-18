---
name: review-module
description: Perform a focused code, product, security, and design review of one SecretWatch module without changing implementation unless explicitly authorized.
---

Review:

- architecture alignment
- module boundaries
- API correctness
- authorization
- data validation
- secret handling
- idempotency
- error handling
- loading/empty/error UI
- Figma fidelity
- responsive behavior
- accessibility
- test coverage
- regression risk

Default behavior is read-only.

Return findings as:

CRITICAL
HIGH
MEDIUM
LOW
NIT

Do not approve a module with unresolved CRITICAL or HIGH findings.

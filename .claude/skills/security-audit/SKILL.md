---
name: security-audit
description: Audit SecretWatch implementation for credential leakage, authorization errors, unsafe automation, and secret-handling violations.
---

Mandatory checks:

- raw secrets never persisted
- raw GitHub tokens never logged
- tokens encrypted at rest
- decryption only in memory where needed
- authorization enforced server-side
- admin routes protected
- user data scoped to current user
- flagging actions audited
- admin review gate behavior matches configuration
- rate-limit behavior is respected
- retries do not duplicate flags
- failed jobs are visible
- input validation exists
- sensitive data is excluded from error responses

If a raw secret is found, classify as CRITICAL.

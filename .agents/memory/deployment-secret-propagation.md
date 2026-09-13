---
name: Deployment secret propagation
description: How to distinguish stored credentials from credentials available to the running API.
---

A credential can exist in a secret store while the active API process still has an empty environment. Treat runtime presence as a separate deployment check; do not infer it from a successful secret-store lookup.

**Why:** The admin endpoint returns the same user-facing login error for missing server configuration and rejected credentials, which can send debugging toward the password instead of the process environment.

**How to apply:** Validate required admin variables before PM2 starts, expose a safe configuration-status diagnostic rather than secret values, and reload the process after changing the deployment environment.
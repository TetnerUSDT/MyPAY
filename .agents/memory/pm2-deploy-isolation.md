---
name: PM2 deploy isolation
description: The ownership check required before changing a named PM2 process on a shared server.
---

The deploy wrapper must verify both the process working directory and the executable path before reloading a PM2 process by name. A unique default name reduces collisions, but a configurable name can still overlap with another project.

**Why:** PM2 is commonly shared by multiple applications on one server; a name-only reload can restart an unrelated service.

**How to apply:** Keep deploy actions scoped to one validated process, refuse mismatches, and never use global PM2 commands such as `restart all` or `reload all`.

The PM2 ecosystem must pass the validated persistent upload directory explicitly in its production environment, including the documented default, instead of relying only on shell environment inheritance.

**Why:** A reload can otherwise lose the preflight-selected upload path and make the API silently resolve a different storage location.

**How to apply:** Keep the shell preflight and ecosystem configuration on the same absolute path contract, and cover start plus reload behavior with an end-to-end release check.
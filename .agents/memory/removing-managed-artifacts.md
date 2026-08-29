---
name: Removing managed artifacts
description: How Replit removes an artifact card and its managed workflow when a standalone artifact is no longer needed.
---

Do not try to remove an artifact-owned workflow while its artifact manifest still exists. After all consumers have been migrated and verified, remove the complete artifact directory; Replit then unregisters the artifact card and prunes its managed workflow automatically.

**Why:** Managed workflows reject direct removal, and direct edits or deletion of artifact.toml are blocked by artifact validation. Removing the fully unused artifact directory successfully removed both the card and workflow.

**How to apply:** First prove no imports or workspace references remain, run the surviving app's build and tests, stop the old workflow, then remove the obsolete artifact directory and refresh the artifact/workflow state.
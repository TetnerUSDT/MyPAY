---
name: Playwright on Replit Nix
description: How to diagnose local Playwright Chromium startup failures caused by missing Nix runtime libraries.
---

Playwright can download Chromium successfully while the browser still fails before tests start because native shared libraries are absent from the Replit Nix environment.

**Why:** Browser launch errors surfaced one missing library at a time. Checking the downloaded browser executable with `ldd` exposed the complete remaining set and avoided repeated blind installs.

**How to apply:** When Playwright reports that its browser process closed during launch, inspect the browser executable with `ldd` and add only the reported Nix system dependencies through the package tooling before debugging test code.
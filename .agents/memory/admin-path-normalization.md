---
name: Admin path normalization
description: The contract between ADMIN_URL, Express admin routes, and the frontend admin API client.
---

`ADMIN_URL` is an external configuration value and may include leading or trailing slashes. Normalize those slashes before using the value in Express route templates or browser navigation/request URLs.

**Why:** Treating the same value as both a raw route fragment and a slash-prefixed URL creates double-slash routes and sends the login check to a different endpoint.

**How to apply:** Keep the internal admin path slash-free, return that normalized value from the public config endpoint, and build all server/client URLs by adding the slash exactly once.
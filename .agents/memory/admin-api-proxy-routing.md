---
name: Admin API proxy routing
description: The required routing shape for secret admin pages on Replit artifact routing and Nginx.
---

Keep the admin page at `/<admin-path>/...`, but send its API requests through `/api/<admin-path>/api/...`. The shared `/api` prefix is what both managed artifact routing and the production reverse proxy forward to Express.

**Why:** A direct `/<admin-path>/api/...` request can fall through the frontend SPA and return `index.html` with HTTP 200 instead of an API JSON response, which the login screen reports as a false credential error.

**How to apply:** Preserve the server's existing private admin route namespace with an API-side rewrite, and build frontend admin request URLs under `/api`. Test the response content type as well as the status code.
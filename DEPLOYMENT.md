# SwiftX production deployment

The production process is split into two parts:

1. `deploy.sh` installs dependencies, builds the API and frontend, and starts
   the API with the isolated PM2 process name from `SWIFTX_PM2_NAME`.
2. Nginx serves `artifacts/swiftx/dist/public` and forwards `/api` and
   `/uploads` to the API's loopback port.

The repository cannot know the production hostname or the absolute checkout
path, so the Nginx configuration is a template. Render it on the server after
the checkout path and public hostname are known.

## First deployment

From the project root on the production server:

```bash
cp .env.example .env
# Edit .env and set the production database, authentication, and PROJECT_URL.
./deploy.sh --env-file .env
```

`PORT` (or `SWIFTX_API_PORT`) is the API port. The API binds to that port on
loopback and is not intended to be exposed directly to the internet.

## Configure Nginx

Install Nginx using the server's package manager, then render and enable the
provided site template. Replace the example values with the actual checkout
path, public hostname, and the same port used in `.env`:

```bash
export SWIFTX_ROOT=/srv/swiftx
export SWIFTX_DOMAIN=pay.example.com
export SWIFTX_API_PORT=10014

envsubst '${SWIFTX_DOMAIN} ${SWIFTX_ROOT} ${SWIFTX_API_PORT}' \
  < deploy/nginx/swiftx.conf.template \
  | sudo tee /etc/nginx/sites-available/swiftx.conf >/dev/null

sudo ln -sfn /etc/nginx/sites-available/swiftx.conf \
  /etc/nginx/sites-enabled/swiftx.conf
sudo nginx -t
sudo systemctl reload nginx
```

If the server already terminates TLS in Nginx, add the certificate-managed
`listen 443 ssl` server settings to the rendered site. If TLS is terminated by
another load balancer, keep Nginx on its configured internal listener and
preserve the `X-Forwarded-Proto` header.

The template provides these public routes:

| Public URL | Upstream behavior |
| --- | --- |
| `/api` and `/api/*` | Proxied unchanged to `127.0.0.1:$PORT` |
| `/uploads` and `/uploads/*` | Proxied unchanged to the API's upload handler |
| `/healthz` | Proxied to the API's native `/api/healthz` endpoint |
| Everything else | Served from `artifacts/swiftx/dist/public` with `/index.html` SPA fallback |

## Verify the deployment

After the API is running and Nginx has been reloaded, run the repeatable
public-routing smoke check. It reads the public origin from `PROJECT_URL` in
the selected environment file:

```bash
./scripts/smoke-public-routing.sh --env-file .env
```

The check fails with a clear error and a non-zero exit status if any of these
routes is unreachable or handled by the wrong upstream:

- `/healthz` returns JSON with `"status":"ok"`.
- `/api/healthz` returns the API's native health JSON.
- `/wallet` returns the frontend HTML, including the SPA root element.
- `/uploads/assets/start-bg.webp` returns an image response rather than
  the frontend's HTML fallback.

To check a different origin or representative asset without changing `.env`,
pass `--url`, `--client-route`, or `--upload-path` explicitly. For example:

```bash
./scripts/smoke-public-routing.sh \
  --url https://pay.example.com \
  --client-route / \
  --upload-path /uploads/icons/cat-logo.png
```

Check the isolated API process with:

```bash
pm2 status swiftx-api
pm2 logs swiftx-api
```

Do not use a global `pm2 restart all`; `deploy.sh` and `pm2-start.sh` refuse
to overwrite a process owned by another project.
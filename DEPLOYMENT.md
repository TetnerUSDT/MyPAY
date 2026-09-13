# SwiftX production deployment

The production process has two coordinated parts:

1. `deploy.sh` installs dependencies, builds the API and frontend, applies the
   rendered Nginx site, and starts the API with the isolated PM2 process name
   from `SWIFTX_PM2_NAME`.
2. Nginx serves `artifacts/swiftx/dist/public` and forwards `/api` and
   `/uploads` to the API's loopback port. Each release validates the rendered
   site with `nginx -t`, reloads Nginx only after that succeeds, and then runs
   the public-routing smoke check.

Production uploads are stored in `/var/lib/swiftx/uploads` by default. This is
outside the release checkout, so replacing the checkout cannot remove uploaded
assets or KYC documents. Set `SWIFTX_UPLOADS_DIR` to a different absolute,
persistent directory if the server uses another storage mount.

Every deployment preflight checks that this directory is absolute, outside
`artifacts/api-server`, already exists, and is writable by the deploy user.
The check runs before dependency installation, builds, or PM2 changes. A
failure stops the release while the current API remains running. Use
`./deploy.sh --dry-run --env-file .env` to validate the environment and print
the exact upload directory without creating or changing it.

The repository cannot know the production hostname or the absolute checkout
path, so the Nginx configuration is a template. Render it on the server after
the checkout path and public hostname are known. During a normal release,
`deploy.sh` uses the checkout path automatically and derives the Nginx
`server_name` from `PROJECT_URL`. Set `SWIFTX_DOMAIN` in `.env` when the site
needs multiple hostnames. `SWIFTX_NGINX_CONFIG` and
`SWIFTX_NGINX_ENABLED_CONFIG` can override the default Nginx site paths.

## First deployment

From the project root on the production server:

```bash
cp .env.example .env
# Edit .env and set the production database, authentication, and PROJECT_URL.
./deploy.sh --env-file .env
```

`PORT` (or `SWIFTX_API_PORT`) is the API port. The API binds to that port on
loopback and is not intended to be exposed directly to the internet.

Create the persistent directory before the first API start and give it to the
same OS user that runs PM2:

```bash
export SWIFTX_UPLOADS_DIR=/var/lib/swiftx/uploads
sudo install -d -m 0750 "$SWIFTX_UPLOADS_DIR"
sudo chown "$(id -un):$(id -gn)" "$SWIFTX_UPLOADS_DIR"
```

If PM2 runs under a different user, replace the `chown` arguments with that
user and group. Put the same `SWIFTX_UPLOADS_DIR` assignment in the
production `.env` file used by `deploy.sh`.

The directory must be created before running `deploy.sh`; the deploy scripts
do not create it as a fallback. This prevents a release from going live with
an upload path that only fails when the first file is written.

### Migrate existing uploads

For an existing installation, copy the current checkout's uploads while the
old API remains online. The copy is additive and does not delete files from
either location:

```bash
export SWIFTX_ROOT=/srv/swiftx
export SWIFTX_UPLOADS_DIR=/var/lib/swiftx/uploads

sudo install -d -m 0750 "$SWIFTX_UPLOADS_DIR"
sudo chown "$(id -un):$(id -gn)" "$SWIFTX_UPLOADS_DIR"

# Initial copy; the old API can continue serving uploads during this step.
rsync -a --ignore-existing \
  "$SWIFTX_ROOT/artifacts/api-server/public/uploads/" \
  "$SWIFTX_UPLOADS_DIR/"
```

Add `SWIFTX_UPLOADS_DIR=/var/lib/swiftx/uploads` to the production `.env`,
then run the same `rsync` command one more time immediately before deploying.
The second pass captures files uploaded during the first pass. Finally run
`./deploy.sh --env-file .env`; the PM2 reload switches the API to the
persistent directory without deleting the old checkout. Keep the old
`public/uploads` directory until the new deployment has been verified.

## Configure Nginx

Install Nginx using the server's package manager before the first release.
`deploy.sh` renders and enables the provided site template on every release,
then validates and reloads it. The following commands remain available for
initial setup or manual recovery when a release cannot complete:

```bash
export SWIFTX_ROOT=/srv/swiftx
export SWIFTX_DOMAIN=pay.example.com
export SWIFTX_API_PORT=10014
export SWIFTX_UPLOADS_DIR=/var/lib/swiftx/uploads

envsubst '${SWIFTX_DOMAIN} ${SWIFTX_ROOT} ${SWIFTX_API_PORT} ${SWIFTX_UPLOADS_DIR}' \
  < deploy/nginx/swiftx.conf.template \
  | sudo tee /etc/nginx/sites-available/swiftx.conf >/dev/null

sudo ln -sfn /etc/nginx/sites-available/swiftx.conf \
  /etc/nginx/sites-enabled/swiftx.conf
sudo nginx -t
sudo systemctl reload nginx
```

The manual sequence must keep the same order: render/install the site, run
`sudo nginx -t`, and reload only after the validation succeeds. If a release
stops at the proxy validation step, the currently running Nginx master is not
reloaded with the invalid configuration; correct the rendered site and rerun
the validation and reload commands above.

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

After the API is running and the newly rendered Nginx site has passed
validation and reload, `deploy.sh` automatically runs the repeatable
public-routing smoke check. It reads the public origin from `PROJECT_URL` in
the selected environment file. A failed route stops the release before it
prints `Deploy complete.` The check is also available for recovery and
verification without rebuilding or restarting the API:

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
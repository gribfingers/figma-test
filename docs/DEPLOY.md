# Deploying to Hetzner + Coolify

The repository ships `docker-compose.yml`, `backend/Dockerfile`, and
`frontend/Dockerfile` — standard multi-stage builds for Node/Vite/Nginx.
This project has already been deployed once following these exact
steps; the notes below reflect what actually worked, including one gotcha.

## Step 1 — Server

1. Sign up at [hetzner.com/cloud](https://www.hetzner.com/cloud) (a
   card is required).
2. Create a server: **CPX22** (2 vCPU / 4 GB RAM, ~$23/mo excl. VAT),
   **Ubuntu** image, the region closest to your users. Attach an SSH key
   during creation — without one you'll only get a mailed root
   password.
3. Note the server's IPv4 address.

## Step 2 — Coolify

```bash
ssh root@<SERVER_IP>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Takes a couple of minutes. Afterwards open `http://<SERVER_IP>:8000` —
Coolify's first-run wizard to create an admin account.

## Step 3 — Connect the repository

In the Coolify dashboard:
1. Under **Servers**, when adding the resource's server choose
   **"This machine"** — Coolify itself runs on this same box, no need
   to provision or connect a separate server.
2. **New Project** → **New Resource** → **Public Git Repository**
   (not the standalone "Docker Compose" card — that one expects an
   inline compose file with no git repo, but ours references local
   Dockerfiles via `build:` paths that need the actual repo checked
   out).
3. Repository URL: `https://github.com/gribfingers/figma-test`,
   branch `main`. Click **Check repository**.
4. Set **Build pack** to **Docker Compose**. Set **Compose file** to
   `/docker-compose.yml` (note: `.yml`, not `.yaml` — Coolify defaults
   to `.yaml` and won't find the file otherwise).
5. Click **Continue**, then on the app's **General** page click
   **Reload compose** to confirm both `backend` and `frontend` services
   show up under "Show deployable compose".

## Step 4 — Domain (important gotcha)

Coolify's own reverse proxy (Traefik) already binds host ports 80/443,
so if `docker-compose.yml` publishes the frontend directly on `80:80`,
the deploy fails with `port is already allocated`. This repo's compose
file uses `expose: ["80"]` instead — the frontend container listens
internally but isn't bound to a host port directly.

To make it reachable:
1. Open **Domains** in the app's left menu → **Add domain**.
2. **Service:** `frontend` (not `backend` — the backend should stay
   internal; the frontend's nginx already proxies `/api/*` to it inside
   the Docker network).
3. Click **Generate domain** — Coolify creates a free `*.sslip.io`
   address with automatic HTTPS. Save.
4. Back in **General → Build pipeline**, click **Reload compose**, then
   **Deploy**.

The plain server IP (`http://<SERVER_IP>`) will return 404 — Traefik
routes by the `Host` header, so only the generated domain works.

## Step 5 — Seed demo data (once)

Via Coolify's **Terminal** tab for the `backend` service, or SSH:

```bash
docker compose exec backend node dist/seed.js
```

Or create flights directly through the API:

```bash
curl -X POST https://<your-domain>/api/flights \
  -H 'Content-Type: application/json' \
  -d '{"flight_number":"1234","carrier_code":"SU","origin":"SVO","destination":"LED","std":"2026-08-23T14:00:00Z","aircraft_type":"A320"}'
```

## What's next

- **Updates:** push to `main`, then click **Deploy** in Coolify (or wire
  up a GitHub webhook under the app's **Webhooks** page, in the
  **Automation** section of its left menu, for auto-deploy on push).
- **Backups:** the `backend_data` named volume is the only thing worth
  backing up (the SQLite file with flights and passengers).
- **Before any real-world use:** add authentication for the agent
  workstations (see the warning in `README.md`) — right now the domain
  is public with no login.

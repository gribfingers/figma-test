# Cheap hosting for this project

Stack — Node/Express backend + static React frontend + SQLite (easy to
swap for managed Postgres). Options below, from cheap to free, as of
2026.

## Recommendation: VPS (Hetzner) + Docker/Coolify

The most predictable-cost option for this stack is a single VPS running
both the backend and the frontend's static files, with no separate
database billing and no bandwidth surprises.

- **Hetzner Cloud**, CPX22 plan (2 vCPU / 4 GB RAM) — **~$23/mo**
  (excl. VAT) at current pricing; there's a cheaper CPX12 (1 vCPU / 2 GB)
  around $13/mo, but 4 GB of RAM gives headroom for Node plus the
  frontend build. (An earlier draft of this doc quoted €4–5/mo based on
  a different plan — the actual price for CPX22 as deployed is the
  figure above; always check current pricing in the Hetzner console
  before committing.)
- On top — **[Coolify](https://coolify.io)** (a free, self-hosted PaaS,
  installed with one command) — gives git-push deploys, HTTPS via Let's
  Encrypt, container restarts, no manual nginx setup.
- Backend and frontend run in Docker containers on the same server;
  the SQLite file lives on the server's persistent disk (or move to
  Postgres in a sibling container if you need stronger backup
  guarantees).

Why this is cheaper than a specialised PaaS: with Render/Railway/Fly.io
the final bill is almost always higher than the advertised rate because
of separate database and egress billing — on a VPS all of that is
already included in the flat price.

## Alternative without managing a server — Railway (~$5/mo)

If you'd rather not administer a server:

- **[Railway](https://railway.app)**, Hobby plan — from **$5/mo**
  (the included usage is usually enough for a demo/pilot project:
  backend + Postgres in one project, deploy from GitHub, no Docker
  needed).
- Downside — usage-based billing above the included limit, with no hard
  spending cap; for production, set up budget alerts.

## Free option — Oracle Cloud "Always Free"

- Oracle Cloud has historically offered a permanently free ARM VM (up
  to 4 OCPU / 24 GB RAM at the time this doc was written) — comfortably
  enough for the whole stack. Downsides: a more involved initial account
  setup, and the exact free-tier availability varies by region and
  changes over time — verify current terms before relying on it in
  production.

## Not recommended for this stack

- **Vercel/Netlify alone** — great for static frontend hosting, but
  there's nowhere to run the SQLite-backed backend (serverless functions
  have no persistent filesystem) — you'd end up splitting frontend and
  backend across different providers and moving to an external Postgres
  (Neon/Supabase), which adds operational complexity for a small project
  without saving money.
- **Render Hobby** — the free web service tier "sleeps" when idle (not
  acceptable for a boarding-gate workstation, where instant response
  matters), and the paid tier with a database and traffic usually costs
  more than a VPS.

## Bottom line

For a working prototype/pilot — **Hetzner CPX22 + Coolify**: roughly
$23/mo, full control, a predictable bill, the whole stack (backend +
frontend + DB) on one machine. If zero upfront cost matters more than
convenience and you don't mind a more involved setup — **Oracle Cloud
Always Free**.

The `Dockerfile`/`docker-compose.yml` for this setup are already in the
repository — step-by-step deploy instructions are in
[`docs/DEPLOY.md`](DEPLOY.md).

Sources (2026 pricing overview):
- [Render vs Railway vs Fly.io: 2026 Pricing Showdown](https://expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown/)
- [7 Fly.io Alternatives in 2026](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/)
- [Platforms with a real free tier for developers in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)

# Datadog Clone

A production-scale clone of Datadog covering Metrics, Logs, APM, RUM, Synthetics, Monitors, Dashboards, SLOs, Incidents, Security, CI Visibility, Cost, Watchdog, Notebooks, Infrastructure, and Log configuration. Built with FastAPI + Postgres (TimescaleDB) on the backend and Next.js 15 (React 19) on the frontend.

## Quick start

```bash
# 1. Copy env template (default Postgres password is "change_me_strong_random" —
#    edit .env before exposing the stack to anything beyond localhost)
cp .env.example .env

# 2. Boot the docker stack — postgres + api + web, with Alembic migrations
#    auto-applied on api boot.
task datadog:up           # or:  docker compose up -d --build

# 3. Seed the demo topology + telemetry catalog.
task datadog:seed         # or:  cd apps/api && uv run python -m scripts.seed_db

# 4. Open the app.
open http://localhost:3001
```

Health check: `curl http://localhost:8001/health` returns `{"status":"ok"}` (liveness). For seed state, hit `/state`, and for migration readiness `/ready`.

## Default ports

| Service | Docker (compose) | Local dev (`pnpm dev:*`) |
|---|---|---|
| Web (Next.js)    | `http://localhost:3001` | `http://localhost:3000` |
| API (FastAPI)    | `http://localhost:8001` | `http://localhost:8000` |
| Postgres         | `localhost:5432`         | — (use docker for db) |

## Default seed users

Two users are inserted by `POST /admin/seed` (admin-gated — requires `X-Admin-Key`) or by booting `docker-compose.fresh.yml`:

| Email | Password | Notes |
|---|---|---|
| `playwright-e2e@example.com` | `password123` | Used by Playwright bootstrap. |
| `bob@grader.local`           | `password123` | Demo account for manual review. |

In production, **set `ADMIN_API_KEY` to a real secret and disable `TEST_AUTH_ENABLED`** — both are off by default in `.env.example`.

## Repo layout

```
apps/
├── api/                FastAPI backend (uv-managed, Alembic migrations)
│   ├── app/            Routers grouped by feature surface (auth, metrics, …)
│   ├── alembic/        Schema migrations (22 versions)
│   ├── scripts/        seed_db.py
│   └── tests/          pytest smoke + integration tests
├── web/                Next.js 15 (app router) frontend
│   ├── src/app/        File-based routes — 73 page.tsx files
│   ├── src/features/   Per-feature API client + React Query hooks
│   └── e2e/            Playwright suite (fixtures, POMs, specs, COVERAGE.md)
└── desktop/            Electron shell (skeleton)

docker-compose.yml          Default stack (named volume, persistent data)
docker-compose.fresh.yml    Ephemeral stack (tmpfs db, TEST_AUTH_ENABLED=true)
docker-compose.local.yml    Override for connecting api/web to host services

Taskfile.yml                Per-app task surface (datadog:up, datadog:seed, …)
Makefile                    Scaffold + pipeline targets (capture/formalize/…)
```

## Common tasks

```bash
task --list                       # list every datadog:* task
task datadog:up                   # build + start + seed
task datadog:down                 # stop + remove containers + volumes
task datadog:seed                 # reseed (idempotent unless --force)
task datadog:dev-backend          # uvicorn --reload against docker postgres
task datadog:dev-frontend         # next dev
task datadog:test-unit            # pytest apps/api/tests
task datadog:test-e2e             # playwright test
task datadog:validate             # repo-structure + lint + tests
```

## Admin endpoints (gated)

When `ADMIN_API_KEY` is set, the following return JSON; unset → 404.

| Endpoint | Purpose |
|---|---|
| `POST /admin/seed`               | Insert seed users + canned fixtures. |
| `POST /admin/reset`              | Drop telemetry data + reseed. **Destructive — gate carefully.** |
| `POST /admin/clear-telemetry`    | Truncate metric/log/span tables only. |
| `POST /admin/backfill`           | Re-run the N-day telemetry backfill. |
| `POST /admin/reseed-topology`    | Truncate + reseed topology fixtures. |
| `POST /admin/inject-spike`       | Trigger a synthetic anomaly. |

All require `X-Admin-Key: <ADMIN_API_KEY>` header.

## Documentation

- `FEATURES.md` — feature surface manifest, one section per Datadog area.
- `apps/web/e2e/COVERAGE.md` — Playwright spec contract.
- `apps/web/e2e/HANDBOOK.md` — e2e onboarding (fixtures, POMs, conventions).
- `apps/api/README.md` — backend developer notes (TBD).

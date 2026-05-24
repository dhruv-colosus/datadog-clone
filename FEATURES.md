# Features

Feature manifest for the Datadog clone. Each section names the surface, the primary route(s) under `apps/web/src/app/`, and the FastAPI router under `apps/api/app/`.

## Auth

User registration, password-based login, session cookies, sign-out. Two-user seed via `POST /admin/seed`.

- Routes: `/auth/sign-in`, `/auth/sign-up`
- Backend: `apps/api/app/auth/router.py`

## Dashboard

Overview landing page after login. Configurable widget grid with drag-and-drop, lists view, and shared (public) dashboard URLs.

- Routes: `/dashboard`, `/dashboard/[id]`, `/dashboard/lists`, `/public/p/dashboard/[id]`
- Backend: `apps/api/app/dashboards/router.py`

## Metrics

Catalog of host/service metrics, ad-hoc explorer with tag filtering and timeseries rendering.

- Routes: `/metrics`, `/metric/explore`
- Backend: `apps/api/app/metrics/router.py`

## Logs

Log explorer with facet filtering, log pipelines (parsers, processors), indexes, archiving, standard attributes, generate-metrics, rehydrations, data access controls, flex-logs controls.

- Routes: `/logs`, `/logs/pipelines`, `/logs/pipelines/[id]`, `/logs/pipelines/{archiving,data-access,flex-logs-controls,generate-metrics,indexes,rehydrations,standard-attributes}`, `/logs/configuration/facets`
- Backend: `apps/api/app/logs/router.py`, `apps/api/app/log_config/router.py`

## APM (Application Performance Monitoring)

Service catalog, service map, distributed trace search, single-trace flame graph, per-service detail.

- Routes: `/apm`, `/apm/home`, `/apm/services`, `/apm/services/[id]`, `/apm/service-map`, `/apm/traces`, `/apm/traces/[traceId]`
- Backend: `apps/api/app/apm/router.py`

## RUM (Real User Monitoring)

Real-user telemetry explorer, session replay, summary dashboards.

- Routes: `/rum`, `/rum/explorer`, `/rum/session-replay`, `/rum/session-replay/[id]`, `/rum/summary`
- Backend: `apps/api/app/rum/router.py`

## Synthetics

Synthetic API + browser tests, scheduled runs, event log, editors for API + browser tests.

- Routes: `/synthetics`, `/synthetics/tests`, `/synthetics/tests/new`, `/synthetics/tests/new/scratch`, `/synthetics/tests/[id]`, `/synthetics/tests/[id]/edit`, `/synthetics/events`
- Backend: `apps/api/app/synthetics/router.py`

## Monitors

Monitor CRUD (metric, log, anomaly, watchdog, composite), monitor manage view, monitor detail with status timeline, configuration.

- Routes: `/monitor`, `/monitor/manage`, `/monitor/create`, `/monitor/configure`, `/monitor/[id]`
- Backend: `apps/api/app/monitors/router.py`

## SLOs (Service Level Objectives)

SLO CRUD, error-budget tracking, SLO management view.

- Routes: `/slo`, `/slo/manage`, `/slo/create`, `/slo/[id]`
- Backend: `apps/api/app/slos/router.py`

## Incidents

Incident response surface — incident list, timeline, postmortem fields.

- Routes: `/incidents`, `/incidents/[id]`
- Backend: `apps/api/app/incidents/router.py`

## Security

Cloud security posture — security signals, detection rules CRUD, data security (sensitive data findings).

- Routes: `/security`, `/security/signals`, `/security/signals/[id]`, `/security/rules`, `/security/rules/new`, `/security/rules/[id]`, `/security/data-security`, `/security/data-security/findings`
- Backend: `apps/api/app/security/router.py`

## CI Visibility

CI pipeline + test-service observability, per-execution drill-down.

- Routes: `/ci`, `/ci/pipelines`, `/ci/pipeline-executions`, `/ci/pipeline-executions/[id]`, `/ci/test-services`
- Backend: `apps/api/app/ci/router.py`

## Cost

Cloud cost explorer.

- Routes: `/cost`, `/cost/explorer`
- Backend: `apps/api/app/cost/router.py`

## Watchdog

Automatic anomaly detection insights.

- Routes: `/watchdog`, `/watchdog/insights/[id]`
- Backend: `apps/api/app/watchdog/router.py`

## Notebooks

Collaborative analysis notebooks with TipTap rich text editor, sharing, templates.

- Routes: `/notebook`, `/notebook/list`, `/notebook/[id]`, `/notebook/[id]/[slug]`, `/notebook/template/[id]`
- Backend: `apps/api/app/notebooks/router.py`

## Infrastructure

Host inventory, container view, infrastructure map (topology graph).

- Routes: `/infrastructure`, `/infrastructure/map`
- Backend: `apps/api/app/infra/router.py`

## Software (Service Catalog)

Service catalog view of registered services with ownership and metadata.

- Routes: `/software`
- Backend: `apps/api/app/apm/router.py` (shared with APM)

## Views (saved searches)

Per-user saved views shared across surfaces (logs, RUM, APM, security).

- Routes: surfaced inline on each explorer page.
- Backend: `apps/api/app/views/router.py`

## Admin

Gated admin endpoints — seed, reset, backfill, spike injection, telemetry clear. See `README.md` → "Admin endpoints".

- Backend: `apps/api/app/admin/router.py` (requires `X-Admin-Key` header)

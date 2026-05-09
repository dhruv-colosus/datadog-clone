from fastapi import APIRouter

from app.admin.router import router as admin_router
from app.apm.router import router as apm_router
from app.auth.router import router as auth_router
from app.ci.router import router as ci_router
from app.cost.router import router as cost_router
from app.log_config.router import (
    facets_router as log_facets_router,
    pipelines_router as log_pipelines_router,
    scrubber_router as scrubber_router,
    settings_router as log_settings_router,
)
from app.dashboards.router import (
    public_router as dashboards_public_router,
    router as dashboards_router,
)
from app.health.router import router as health_router
from app.incidents.router import router as incidents_router
from app.infra.router import router as infra_router
from app.logs.router import router as logs_router
from app.monitors.router import router as monitors_router
from app.notebooks.router import router as notebooks_router
from app.notebooks.templates_router import router as notebook_templates_router
from app.rum.router import router as rum_router
from app.security.router import router as security_router
from app.slos.router import router as slos_router
from app.synthetics.router import router as synthetics_router
from app.telemetry.router import router as metrics_router
from app.views.router import router as views_router
from app.watchdog.router import router as watchdog_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(health_router)
api_router.include_router(metrics_router)
api_router.include_router(logs_router)
api_router.include_router(apm_router)
api_router.include_router(infra_router)
api_router.include_router(dashboards_router)
api_router.include_router(dashboards_public_router)
api_router.include_router(monitors_router)
api_router.include_router(notebooks_router)
api_router.include_router(notebook_templates_router)
api_router.include_router(rum_router)
api_router.include_router(slos_router)
api_router.include_router(synthetics_router)
api_router.include_router(views_router)
api_router.include_router(watchdog_router)
api_router.include_router(incidents_router)
api_router.include_router(security_router)
api_router.include_router(ci_router)
api_router.include_router(cost_router)
api_router.include_router(log_pipelines_router)
api_router.include_router(log_facets_router)
api_router.include_router(scrubber_router)
api_router.include_router(log_settings_router)

from fastapi import APIRouter

from app.admin.router import router as admin_router
from app.apm.router import router as apm_router
from app.auth.router import router as auth_router
from app.dashboards.router import (
    public_router as dashboards_public_router,
    router as dashboards_router,
)
from app.health.router import router as health_router
from app.infra.router import router as infra_router
from app.logs.router import router as logs_router
from app.monitors.router import router as monitors_router
from app.telemetry.router import router as metrics_router
from app.views.router import router as views_router

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
api_router.include_router(views_router)

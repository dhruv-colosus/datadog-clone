from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import service as admin_service
from app.api.deps import get_db
from app.core.config import get_settings
from app.telemetry import backfill as telemetry_backfill
from app.telemetry import seed_topology as telemetry_seed_topology
from app.telemetry import spike_injector as telemetry_spikes
from app.telemetry.pool import get_pool

settings = get_settings()

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_key(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> None:
    """Gate /admin/* endpoints behind ADMIN_API_KEY.

    - If ADMIN_API_KEY is unset/empty, the entire /admin/* surface returns 404,
      so production builds with no key configured don't expose these endpoints.
    - If set, the caller must send a matching X-Admin-Key header.
    """
    configured = settings.admin_api_key
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    if x_admin_key != configured:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin key",
        )


@router.post("/reset")
async def reset(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cleared = await admin_service.truncate_all(db)
    return {"ok": True, "cleared": cleared}


@router.post("/seed")
async def seed(
    reset: bool = True,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    counts = await admin_service.seed_all(db, reset=reset)
    return {"ok": True, **counts}


@router.post("/inject-spike")
async def inject_spike(
    metric: str = Query(...),
    service: str | None = Query(default=None),
    host: str | None = Query(default=None),
    magnitude: float = Query(default=5.0),
    decay_seconds: float = Query(default=90.0),
    _: None = Depends(require_admin_key),
) -> dict:
    """Inject a manual spike on `(metric, service?, host?)`. Persists to spike_log."""
    try:
        n = await telemetry_spikes.inject_manual_spike(
            metric=metric,
            service=service,
            host=host,
            magnitude=magnitude,
            decay_seconds=decay_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "spikes_injected": n}


@router.post("/clear-telemetry")
async def clear_telemetry(
    _: None = Depends(require_admin_key),
) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE metric_points")
        await conn.execute("TRUNCATE log_lines")
        await conn.execute("TRUNCATE spans")
        await conn.execute("TRUNCATE spike_log")
    return {"ok": True, "cleared": ["metric_points", "log_lines", "spans", "spike_log"]}


@router.post("/backfill")
async def admin_backfill(
    days: int | None = Query(default=None, ge=1, le=30),
    _: None = Depends(require_admin_key),
) -> dict:
    counts = await telemetry_backfill.run_backfill(days=days)
    return {"ok": True, **counts}


@router.post("/reseed-topology")
async def admin_reseed_topology(
    _: None = Depends(require_admin_key),
) -> dict:
    summary = await telemetry_seed_topology.reseed_topology()
    return {"ok": True, **summary}

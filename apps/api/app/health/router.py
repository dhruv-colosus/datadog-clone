from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.models import User

router = APIRouter(tags=["health"])


async def _alembic_revision(db: AsyncSession) -> str | None:
    try:
        result = await db.execute(text("SELECT version_num FROM alembic_version"))
        row = result.first()
        return row[0] if row else None
    except Exception:
        return None


@router.get("/ready")
async def ready(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Readiness probe — succeeds when the DB is reachable and migrations
    have been applied. Distinct from /health (liveness)."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "reason": f"db unreachable: {exc.__class__.__name__}"}

    revision = await _alembic_revision(db)
    if revision is None:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "reason": "migrations not applied"}

    return {"status": "ready", "db": "ok", "migration": revision}


@router.get("/state")
async def state(db: AsyncSession = Depends(get_db)) -> dict:
    """Returns DB seeding state — whether it's empty, seeded, and counts of
    the primary entities. Unauthenticated; counts are not sensitive."""
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    revision = await _alembic_revision(db)

    return {
        "users_count": int(users_count),
        "is_empty": int(users_count) == 0,
        "is_seeded": int(users_count) >= 1,
        "schema_version": revision,
    }

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import service as admin_service
from app.api.deps import get_db
from app.core.config import get_settings

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

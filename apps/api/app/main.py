import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Boot order: seed topology if empty → backfill if empty → start runner."""
    from app.telemetry import backfill, seed_topology
    from app.telemetry.pool import close_pool, get_pool
    from app.telemetry.runner import runner_loop

    # Touch the pool so connection issues surface at boot, not first request.
    await get_pool()

    runner_task: asyncio.Task | None = None
    try:
        await seed_topology.seed_if_empty()
        if settings.backfill_on_boot:
            await backfill.run_backfill_if_empty()
        if settings.generator_enabled:
            runner_task = asyncio.create_task(runner_loop(), name="telemetry.runner")
            logger.info("telemetry: runner task started")
        else:
            logger.info("telemetry: GENERATOR_ENABLED=false — runner skipped")
        yield
    finally:
        if runner_task:
            runner_task.cancel()
            try:
                await runner_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        await close_pool()


app = FastAPI(title="Datadog API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

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
    from app.monitors.evaluator import evaluator_loop as monitors_eval_loop
    from app.synthetics.scheduler import scheduler_loop as synthetics_loop
    from app.telemetry import backfill, seed_topology
    from app.telemetry.pool import close_pool, get_pool
    from app.telemetry.runner import runner_loop
    from app.ci.seed import seed_if_empty as ci_seed
    from app.cost.seed import seed_if_empty as cost_seed
    from app.incidents.seed import seed_if_empty as incidents_seed
    from app.log_config.runtime import refresh_caches as log_config_refresh, refresh_loop as log_config_loop
    from app.log_config.seed import seed_if_empty as log_config_seed
    from app.security.seed import seed_if_empty as security_seed
    from app.watchdog.generator import watchdog_loop
    from app.watchdog.seed import seed_if_empty as watchdog_seed

    # Touch the pool so connection issues surface at boot, not first request.
    await get_pool()

    runner_task: asyncio.Task | None = None
    synthetics_task: asyncio.Task | None = None
    monitors_task: asyncio.Task | None = None
    watchdog_task: asyncio.Task | None = None
    log_config_task: asyncio.Task | None = None
    try:
        await seed_topology.seed_if_empty()
        await backfill.run_backfill_if_empty()
        await watchdog_seed()
        await incidents_seed()
        await security_seed()
        await ci_seed()
        await cost_seed()
        await log_config_seed()
        await log_config_refresh()
        if settings.generator_enabled:
            runner_task = asyncio.create_task(runner_loop(), name="telemetry.runner")
            logger.info("telemetry: runner task started")
        else:
            logger.info("telemetry: GENERATOR_ENABLED=false — runner skipped")

        synthetics_task = asyncio.create_task(
            synthetics_loop(), name="synthetics.scheduler"
        )
        logger.info("synthetics: scheduler task started")

        monitors_task = asyncio.create_task(
            monitors_eval_loop(), name="monitors.evaluator"
        )
        logger.info("monitors: evaluator task started")

        watchdog_task = asyncio.create_task(watchdog_loop(), name="watchdog.generator")
        logger.info("watchdog: generator task started")

        log_config_task = asyncio.create_task(
            log_config_loop(), name="log_config.refresh",
        )
        logger.info("log_config: refresh task started")

        yield
    finally:
        for task in (
            runner_task,
            synthetics_task,
            monitors_task,
            watchdog_task,
            log_config_task,
        ):
            if task:
                task.cancel()
                try:
                    await task
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

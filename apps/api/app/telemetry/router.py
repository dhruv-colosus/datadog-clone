"""Metrics endpoints — match the contract in `apps/web/src/features/metrics/api.ts`."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.telemetry import queries


router = APIRouter(prefix="/metrics", tags=["metrics"])


class FilterModel(BaseModel):
    id: str
    tag: str
    operator: str = "in"
    values: list[str]


class FunctionStep(BaseModel):
    id: str
    kind: str
    method: str | None = None
    intervalSeconds: int | None = None


class MetricQueryModel(BaseModel):
    id: str
    alias: str = ""
    metricName: str
    filters: list[FilterModel] = Field(default_factory=list)
    groupBy: list[str] = Field(default_factory=list)
    aggregator: str = "avg"
    functions: list[FunctionStep] = Field(default_factory=list)
    displayName: str | None = None
    enabled: bool = True


class TimeRangeModel(BaseModel):
    preset: str = "1h"
    fromMs: int
    toMs: int


class SeriesRequest(BaseModel):
    queries: list[MetricQueryModel]
    range: TimeRangeModel


@router.get("/names")
async def get_metric_names(
    prefix: str | None = None,
    _: User = Depends(get_current_user),
) -> list[str]:
    return await queries.metric_names(prefix=prefix)


@router.get("/tag-keys")
async def get_metric_tag_keys(
    metric: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[str]:
    return await queries.metric_tag_keys(metric=metric)


@router.get("/tag-values")
async def get_metric_tag_values(
    tag: str = Query(...),
    metric: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[str]:
    return await queries.metric_tag_values(metric=metric, tag=tag)


@router.post("/series")
async def post_metric_series(
    body: SeriesRequest,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for q in body.queries:
        if not q.enabled or not q.metricName:
            continue
        spec = queries.MetricQuerySpec(
            id=q.id,
            metric_name=q.metricName,
            aggregator=q.aggregator,
            filters=[
                queries.MetricFilter(
                    tag=f.tag, operator=f.operator, values=f.values,
                )
                for f in q.filters
            ],
            group_by=q.groupBy,
            alias=q.alias,
        )
        series = await queries.query_metric_series(
            spec=spec,
            from_ms=body.range.fromMs,
            to_ms=body.range.toMs,
        )
        out.extend(series)
    return out

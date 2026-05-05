"""watchdog stories

Auto-detected anomaly stories: each row is a Watchdog "Story" — an anomaly,
outlier, deployment regression, or deviation that the system noticed in
metrics, logs, or spans. Stories have a narrative + chart evidence so users
can triage them quickly.

Revision ID: b1c2d3e4f5a6
Revises: ae1b9c4d8f33
Create Date: 2026-05-05 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "ae1b9c4d8f33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "watchdog_stories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        # kind: anomaly | outlier | deployment_regression | deviation
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("narrative", sa.Text, nullable=False),
        # severity: high | medium | low
        sa.Column("severity", sa.Text, nullable=False, server_default="medium"),
        # status: active | acknowledged | resolved
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("host", sa.Text, nullable=True),
        sa.Column("metric", sa.Text, nullable=True),
        # evidence: { points: [{ts, value, expected?}], upper, lower, baseline, ... }
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "ended_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "kind IN ('anomaly', 'outlier', 'deployment_regression', 'deviation')",
            name="watchdog_stories_kind_check",
        ),
        sa.CheckConstraint(
            "severity IN ('high', 'medium', 'low')",
            name="watchdog_stories_severity_check",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'acknowledged', 'resolved')",
            name="watchdog_stories_status_check",
        ),
    )
    op.create_index(
        "ix_watchdog_started",
        "watchdog_stories",
        [sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_watchdog_service_started",
        "watchdog_stories",
        ["service", sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_watchdog_status_started",
        "watchdog_stories",
        ["status", sa.text("started_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("watchdog_stories")

"""slos

Service Level Objectives — three measurement types per Datadog:
- metric: ratio of "good" to "good + bad" metric counts
- monitor: uptime aggregated across one or more monitors
- time_slice: custom time-window threshold on a single metric expression

The full SLI definition (queries, monitor IDs, threshold) lives in the JSONB
`source` column so we can evolve types without further migrations. `target_pct`
and `time_window_days` are first-class columns so list-page filters/sorts
remain SQL-cheap. `warning_pct` is optional — Datadog mirrors it as the
warning threshold on the burn-down graph.

Revision ID: 6a7b2e9d1c34
Revises: 5e9f3d2a1b08
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "6a7b2e9d1c34"
down_revision: Union[str, None] = "5e9f3d2a1b08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "slos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "owner_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # measurement type: "metric" | "monitor" | "time_slice"
        sa.Column("type", sa.Text, nullable=False, server_default="metric"),
        # full SLI definition — shape varies by type:
        # metric:    { goodQuery, totalQuery, useBadEvents, badQuery }
        # monitor:   { monitorIds: number[] }
        # time_slice:{ query, comparator, threshold }
        sa.Column(
            "source",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("target_pct", sa.Numeric(7, 4), nullable=False, server_default="99.9"),
        sa.Column("warning_pct", sa.Numeric(7, 4), nullable=True),
        sa.Column("time_window_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column(
            "services",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "teams",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "favorite",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("FALSE"),
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
            "type IN ('metric', 'monitor', 'time_slice')",
            name="slos_type_check",
        ),
        sa.CheckConstraint(
            "target_pct > 0 AND target_pct <= 100",
            name="slos_target_pct_check",
        ),
    )
    op.create_index(
        "ix_slos_owner_updated",
        "slos",
        ["owner_id", sa.text("updated_at DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_slos_source_gin "
        "ON slos USING GIN (source)"
    )

    # Burn rate alerts attached to an SLO. Each row defines a window + threshold
    # multiple of the budget burn that, if exceeded, would trigger.
    op.create_table(
        "slo_burn_rate_alerts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "slo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("slos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        # short-window minutes, e.g. 5; long-window minutes, e.g. 60
        sa.Column("short_window_min", sa.Integer, nullable=False),
        sa.Column("long_window_min", sa.Integer, nullable=False),
        # multiple of the allowed budget burn (e.g. 14.4 for the 1h burn rate)
        sa.Column("burn_threshold", sa.Numeric(8, 3), nullable=False),
        sa.Column(
            "severity",
            sa.Text,
            nullable=False,
            server_default="warn",
        ),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "severity IN ('warn', 'alert')",
            name="slo_burn_rate_alerts_severity_check",
        ),
    )
    op.create_index(
        "ix_slo_burn_rate_alerts_slo",
        "slo_burn_rate_alerts",
        ["slo_id"],
    )


def downgrade() -> None:
    op.drop_table("slo_burn_rate_alerts")
    op.drop_table("slos")

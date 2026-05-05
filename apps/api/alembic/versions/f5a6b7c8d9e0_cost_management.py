"""cost management — cost_events + container allocations

Cost events stored daily per (provider, account, service, region, resource_type).
Container cost allocations stored daily per (cluster, namespace, workload, pod).

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-05-05 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cost_events",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("provider", sa.Text, nullable=False),
        sa.Column("account", sa.Text, nullable=False),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("region", sa.Text, nullable=False),
        sa.Column("resource_type", sa.Text, nullable=False),
        sa.Column("cost_usd", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.PrimaryKeyConstraint(
            "ts", "provider", "account", "service", "region", "resource_type",
            name="cost_events_pkey",
        ),
        sa.CheckConstraint(
            "provider IN ('aws','azure','gcp')",
            name="cost_events_provider_check",
        ),
    )
    op.create_index("ix_cost_events_ts", "cost_events", [sa.text("ts DESC")])
    op.create_index(
        "ix_cost_events_service_ts",
        "cost_events",
        ["service", sa.text("ts DESC")],
    )
    op.create_index(
        "ix_cost_events_region_ts",
        "cost_events",
        ["region", sa.text("ts DESC")],
    )

    op.create_table(
        "cost_allocations",
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("cluster", sa.Text, nullable=False),
        sa.Column("namespace", sa.Text, nullable=False),
        sa.Column("workload", sa.Text, nullable=False),
        sa.Column("pod", sa.Text, nullable=False, server_default=""),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("cost_usd", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint(
            "day", "cluster", "namespace", "workload", "pod",
            name="cost_allocations_pkey",
        ),
    )


def downgrade() -> None:
    op.drop_table("cost_allocations")
    op.drop_table("cost_events")

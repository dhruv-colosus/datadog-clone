"""rum

Real User Monitoring — applications + event hypertable.

Datadog's RUM data model is a tree of (session → views → events). We flatten
it: every observation (a view, action, error, resource, long_task) lands in
one row of `rum_events`, tagged with `session_id` + `view_id`. The most-
queried dimensions get first-class columns (browser, country, url, perf
metrics) so the UI's `GROUP BY` queries stay SQL-cheap; everything else lives
in `attributes` JSONB.

Revision ID: 7b8c4f0d2e51
Revises: 6a7b2e9d1c34
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "7b8c4f0d2e51"
down_revision: Union[str, None] = "6a7b2e9d1c34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rum_applications",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("type", sa.Text, nullable=False, server_default="react"),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("env", sa.Text, nullable=False, server_default="prod"),
        sa.Column("client_token", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "rum_events",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("application_id", sa.Text, nullable=False),
        sa.Column("session_id", sa.Text, nullable=False),
        sa.Column("view_id", sa.Text, nullable=False),
        # event kind: view | action | error | resource | long_task
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("env", sa.Text, nullable=False),
        sa.Column("version", sa.Text, nullable=False),
        sa.Column("user_id", sa.Text, nullable=True),
        sa.Column("user_name", sa.Text, nullable=True),
        sa.Column("user_email", sa.Text, nullable=True),
        sa.Column("geo_country", sa.Text, nullable=True),
        sa.Column("geo_city", sa.Text, nullable=True),
        sa.Column("browser_name", sa.Text, nullable=True),
        sa.Column("browser_version", sa.Text, nullable=True),
        sa.Column("os_name", sa.Text, nullable=True),
        sa.Column("device_type", sa.Text, nullable=True),
        sa.Column("view_url", sa.Text, nullable=True),
        sa.Column("view_path", sa.Text, nullable=True),
        sa.Column("view_referrer", sa.Text, nullable=True),
        # view event metrics — populated only when event_type='view'
        sa.Column("loading_time_ms", sa.Integer, nullable=True),
        sa.Column("lcp_ms", sa.Integer, nullable=True),
        sa.Column("fcp_ms", sa.Integer, nullable=True),
        sa.Column("inp_ms", sa.Integer, nullable=True),
        sa.Column("cls", sa.Numeric(10, 4), nullable=True),
        sa.Column("time_spent_ms", sa.Integer, nullable=True),
        # error event
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("error_source", sa.Text, nullable=True),
        sa.Column("error_stack", sa.Text, nullable=True),
        # action event
        sa.Column("action_type", sa.Text, nullable=True),
        sa.Column("action_name", sa.Text, nullable=True),
        # resource / long_task
        sa.Column("resource_url", sa.Text, nullable=True),
        sa.Column("resource_method", sa.Text, nullable=True),
        sa.Column("resource_status", sa.SmallInteger, nullable=True),
        sa.Column("resource_duration_ms", sa.Integer, nullable=True),
        sa.Column("long_task_duration_ms", sa.Integer, nullable=True),
        # session-level rolling counters duplicated on view_end events for
        # cheap session-list aggregation
        sa.Column("session_view_count", sa.SmallInteger, nullable=True),
        sa.Column("session_action_count", sa.SmallInteger, nullable=True),
        sa.Column("session_error_count", sa.SmallInteger, nullable=True),
        sa.Column("session_frustration_count", sa.SmallInteger, nullable=True),
        sa.Column("session_time_spent_ms", sa.Integer, nullable=True),
        sa.Column("session_is_active", sa.Boolean, nullable=True),
        sa.Column(
            "attributes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute(
        "SELECT create_hypertable('rum_events', 'ts', "
        "chunk_time_interval => INTERVAL '6 hour', if_not_exists => TRUE)"
    )
    op.create_index(
        "ix_rum_events_app_ts", "rum_events",
        ["application_id", sa.text("ts DESC")],
    )
    op.create_index(
        "ix_rum_events_session_ts", "rum_events",
        ["session_id", sa.text("ts ASC")],
    )
    op.create_index(
        "ix_rum_events_event_type_ts", "rum_events",
        ["event_type", sa.text("ts DESC")],
    )
    op.create_index(
        "ix_rum_events_view_path", "rum_events", ["view_path"],
        postgresql_where=sa.text("event_type = 'view'"),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rum_events_attributes_gin "
        "ON rum_events USING GIN (attributes)"
    )
    op.execute(
        "SELECT add_retention_policy('rum_events', INTERVAL '14 days', "
        "if_not_exists => TRUE)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rum_events CASCADE")
    op.drop_table("rum_applications")

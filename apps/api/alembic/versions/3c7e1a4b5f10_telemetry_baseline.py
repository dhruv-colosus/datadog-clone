"""telemetry_baseline

TimescaleDB extension, hypertables for metric_points / log_lines / spans,
spike_log, and topology_* / catalog tables.

Revision ID: 3c7e1a4b5f10
Revises: 2a4f1c8b9e22
Create Date: 2026-05-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "3c7e1a4b5f10"
down_revision: Union[str, None] = "2a4f1c8b9e22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")

    # ------------------------------------------------------------------
    # Telemetry hypertables
    # ------------------------------------------------------------------
    op.create_table(
        "metric_points",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("value", sa.Float(precision=53), nullable=False),
        sa.Column("host", sa.Text, nullable=True),
        sa.Column("service", sa.Text, nullable=True),
        sa.Column("env", sa.Text, nullable=True),
        sa.Column("metric_type", sa.SmallInteger, nullable=False),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute(
        "SELECT create_hypertable('metric_points', 'ts', "
        "chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE)"
    )
    op.create_index("ix_metric_points_name_ts", "metric_points", ["name", sa.text("ts DESC")])
    op.create_index(
        "ix_metric_points_service_name_ts", "metric_points",
        ["service", "name", sa.text("ts DESC")],
    )
    op.create_index(
        "ix_metric_points_host_name_ts", "metric_points",
        ["host", "name", sa.text("ts DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metric_points_tags_gin "
        "ON metric_points USING GIN (tags)"
    )
    op.execute(
        "SELECT add_retention_policy('metric_points', INTERVAL '14 days', if_not_exists => TRUE)"
    )

    op.create_table(
        "log_lines",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("host", sa.Text, nullable=False),
        sa.Column("env", sa.Text, nullable=False),
        sa.Column("status", sa.SmallInteger, nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column(
            "attributes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("trace_id", sa.Text, nullable=True),
        sa.Column("span_id", sa.Text, nullable=True),
    )
    op.execute(
        "SELECT create_hypertable('log_lines', 'ts', "
        "chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE)"
    )
    op.create_index("ix_log_lines_service_ts", "log_lines", ["service", sa.text("ts DESC")])
    op.create_index("ix_log_lines_status_ts", "log_lines", ["status", sa.text("ts DESC")])
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_log_lines_trace_id "
        "ON log_lines (trace_id) WHERE trace_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_log_lines_attributes_gin "
        "ON log_lines USING GIN (attributes)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_log_lines_ts_brin "
        "ON log_lines USING BRIN (ts)"
    )
    op.execute(
        "SELECT add_retention_policy('log_lines', INTERVAL '7 days', if_not_exists => TRUE)"
    )

    op.create_table(
        "spans",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("trace_id", sa.Text, nullable=False),
        sa.Column("span_id", sa.Text, nullable=False),
        sa.Column("parent_span_id", sa.Text, nullable=True),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("operation", sa.Text, nullable=False),
        sa.Column("resource", sa.Text, nullable=False),
        sa.Column("duration_us", sa.BigInteger, nullable=False),
        sa.Column("status", sa.SmallInteger, nullable=False),
        sa.Column("http_method", sa.Text, nullable=True),
        sa.Column("http_status", sa.SmallInteger, nullable=True),
        sa.Column("host", sa.Text, nullable=True),
        sa.Column("env", sa.Text, nullable=False),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute(
        "SELECT create_hypertable('spans', 'ts', "
        "chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE)"
    )
    op.create_index("ix_spans_trace_id", "spans", ["trace_id"])
    op.create_index("ix_spans_service_ts", "spans", ["service", sa.text("ts DESC")])
    op.create_index("ix_spans_operation_ts", "spans", ["operation", sa.text("ts DESC")])
    op.create_index("ix_spans_status_ts", "spans", ["status", sa.text("ts DESC")])
    op.execute(
        "SELECT add_retention_policy('spans', INTERVAL '7 days', if_not_exists => TRUE)"
    )

    # spike_log — regular table
    op.create_table(
        "spike_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("metric_name", sa.Text, nullable=False),
        sa.Column("host", sa.Text, nullable=True),
        sa.Column("service", sa.Text, nullable=True),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("magnitude", sa.Float, nullable=False),
        sa.Column("decay_seconds", sa.Float, nullable=False),
        sa.Column(
            "source", sa.Text, nullable=False,
            server_default=sa.text("'auto'"),
        ),
    )
    op.create_index("ix_spike_log_started_at", "spike_log", [sa.text("started_at DESC")])
    op.create_index(
        "ix_spike_log_active", "spike_log",
        ["metric_name", "host"], postgresql_where=sa.text("ended_at IS NULL"),
    )

    # ------------------------------------------------------------------
    # Topology / catalog tables
    # ------------------------------------------------------------------
    op.create_table(
        "topology_services",
        sa.Column("name", sa.Text, primary_key=True),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("language", sa.Text, nullable=True),
        sa.Column("team", sa.Text, nullable=False),
        sa.Column("tier", sa.SmallInteger, nullable=False),
        sa.Column("repo_url", sa.Text, nullable=False, server_default=""),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
    )
    op.create_table(
        "topology_teams",
        sa.Column("name", sa.Text, primary_key=True),
        sa.Column("slack_channel", sa.Text, nullable=False),
        sa.Column("oncall_email", sa.Text, nullable=False),
    )
    op.create_table(
        "topology_hosts",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("hostname", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("service", sa.Text, nullable=True),
        sa.Column("env", sa.Text, nullable=False),
        sa.Column("region", sa.Text, nullable=False),
        sa.Column("availability_zone", sa.Text, nullable=False),
        sa.Column("os", sa.Text, nullable=False),
        sa.Column("cpu_cores", sa.Integer, nullable=False),
        sa.Column("memory_gb", sa.Float, nullable=False),
        sa.Column("filesystem_gb", sa.Float, nullable=False),
        sa.Column("ip_address", sa.Text, nullable=False),
        sa.Column("ipv6_address", sa.Text, nullable=False),
        sa.Column("mac_address", sa.Text, nullable=False),
        sa.Column("kernel_release", sa.Text, nullable=False),
        sa.Column("kernel_version", sa.Text, nullable=False),
        sa.Column("docker_version", sa.Text, nullable=False),
        sa.Column("agent_version", sa.Text, nullable=False),
        sa.Column("apps", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("kube_cluster_name", sa.Text, nullable=True),
        sa.Column("kube_namespace", sa.Text, nullable=True),
        sa.Column("version", sa.Text, nullable=False),
        sa.Column("team", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
    )
    op.create_index("ix_topology_hosts_env", "topology_hosts", ["env"])
    op.create_index("ix_topology_hosts_service", "topology_hosts", ["service"])

    op.create_table(
        "topology_containers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("host_id", sa.Text, sa.ForeignKey("topology_hosts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("image", sa.Text, nullable=False),
        sa.Column("runtime", sa.Text, nullable=False),
        sa.Column("started_seconds_ago", sa.Integer, nullable=False),
    )
    op.create_index("ix_topology_containers_host", "topology_containers", ["host_id"])

    op.create_table(
        "topology_processes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("host_id", sa.Text, sa.ForeignKey("topology_hosts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pid", sa.Integer, nullable=False),
        sa.Column("command", sa.Text, nullable=False),
        sa.Column("parent_pid", sa.Integer, nullable=True),
        sa.Column("started_seconds_ago", sa.Integer, nullable=False),
    )
    op.create_index("ix_topology_processes_host", "topology_processes", ["host_id"])

    op.create_table(
        "topology_dependencies",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("caller", sa.Text, nullable=False),
        sa.Column("callee", sa.Text, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("weight", sa.Float, nullable=False, server_default="1.0"),
    )
    op.create_index(
        "ix_topology_dependencies_caller_callee",
        "topology_dependencies",
        ["caller", "callee"],
        unique=True,
    )

    op.create_table(
        "metric_catalog",
        sa.Column("name", sa.Text, primary_key=True),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("unit", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("applicable_services", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("applicable_roles", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("baseline", sa.Float, nullable=False),
        sa.Column("daily_amplitude", sa.Float, nullable=False),
        sa.Column("noise", sa.Float, nullable=False),
    )

    op.create_table(
        "tag_catalog",
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("values", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
    )

    op.create_table(
        "log_templates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("level", sa.Text, nullable=False),
        sa.Column("weight", sa.Float, nullable=False),
        sa.Column("template", sa.Text, nullable=False),
    )
    op.create_index("ix_log_templates_service_level", "log_templates", ["service", "level"])

    op.create_table(
        "operations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("resource_pool", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("base_latency_ms", sa.Float, nullable=False),
        sa.Column("latency_sigma", sa.Float, nullable=False),
        sa.Column("error_rate", sa.Float, nullable=False),
        sa.Column("is_entry", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("http_method_pool", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
    )
    op.create_index("ix_operations_service", "operations", ["service"])


def downgrade() -> None:
    for tbl in (
        "operations", "log_templates", "tag_catalog", "metric_catalog",
        "topology_dependencies", "topology_processes", "topology_containers",
        "topology_hosts", "topology_teams", "topology_services",
        "spike_log",
    ):
        op.drop_table(tbl)
    op.execute("DROP TABLE IF EXISTS spans CASCADE")
    op.execute("DROP TABLE IF EXISTS log_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS metric_points CASCADE")
    # Leave the timescaledb extension in place — other databases may depend on it.

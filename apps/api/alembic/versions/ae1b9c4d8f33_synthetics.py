"""synthetics tests + results

API synthetic tests — periodic HTTP probes with configurable assertions.
The full request shape (method, headers, body, query, timeout) and the
list of assertions live in JSONB so we can evolve the schema without
further migrations. Results are stored in a separate table and capped
to ~1000 rows per test by the runner.

Revision ID: ae1b9c4d8f33
Revises: 9d3e7a5b2c10
Create Date: 2026-05-05 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "ae1b9c4d8f33"
down_revision: Union[str, None] = "9d3e7a5b2c10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "synthetic_tests",
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
        # subtype: "http" (default) | "ssl" | "dns" | "tcp" | "udp" | "icmp" |
        # "websocket" | "grpc". Only "http" is fully evaluated for now.
        sa.Column("subtype", sa.Text, nullable=False, server_default="http"),
        sa.Column("method", sa.Text, nullable=False, server_default="GET"),
        sa.Column("url", sa.Text, nullable=False),
        # request: { headers: [{key,value}], body: string, bodyType, query, timeoutMs }
        sa.Column(
            "request",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        # assertions: [{ type, target, operator, expected }]
        # type: status_code | response_time | header | body | body_size
        sa.Column(
            "assertions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "locations",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default=sa.text("'{aws:us-east-1}'::text[]"),
        ),
        # interval in seconds; 60s minimum
        sa.Column(
            "frequency_seconds",
            sa.Integer,
            nullable=False,
            server_default="300",
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("environment", sa.Text, nullable=True),
        sa.Column("team", sa.Text, nullable=True),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column(
            "favorite",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        # last_status: "OK" | "ALERT" | "NO DATA"
        sa.Column(
            "last_status",
            sa.Text,
            nullable=False,
            server_default="NO DATA",
        ),
        sa.Column(
            "last_run_at",
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
            "frequency_seconds >= 60",
            name="synthetic_tests_frequency_check",
        ),
        sa.CheckConstraint(
            "last_status IN ('OK', 'ALERT', 'NO DATA')",
            name="synthetic_tests_last_status_check",
        ),
    )
    op.create_index(
        "ix_synthetic_tests_owner_updated",
        "synthetic_tests",
        ["owner_id", sa.text("updated_at DESC")],
    )

    op.create_table(
        "synthetic_results",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "test_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("synthetic_tests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "executed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("location", sa.Text, nullable=False),
        # status: OK | ALERT
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("status_code", sa.Integer, nullable=True),
        # total response time
        sa.Column("response_time_ms", sa.Integer, nullable=True),
        # network timing breakdown: { dnsMs, connectionMs, sslMs, ttfbMs, downloadMs }
        sa.Column(
            "timings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        # assertion outcomes: [{ type, target, operator, expected, actual, passed }]
        sa.Column(
            "assertion_results",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "response_headers",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("response_size_bytes", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_synthetic_results_test_executed",
        "synthetic_results",
        ["test_id", sa.text("executed_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("synthetic_results")
    op.drop_table("synthetic_tests")

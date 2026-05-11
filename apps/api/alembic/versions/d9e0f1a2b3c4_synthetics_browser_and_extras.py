"""synthetics: add test_type, browser_config, auth, retry, alert, monitor

Extends `synthetic_tests` so it can model the full Datadog Synthetics UI:
API tests (HTTP/gRPC/SSL/DNS/etc), browser tests with recorded steps,
authentication, retry policy, alert condition, scheduled downtimes,
and the per-monitor notification message template.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-05-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, None] = "c8d9e0f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Top-level test type ("api" | "browser" | "multistep"). The
    # existing `subtype` column stays around for API test variants
    # (http, grpc, ssl, dns, …).
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "test_type",
            sa.Text,
            nullable=False,
            server_default="api",
        ),
    )

    # Browser test config: starting URL, browsers, devices, recorded steps.
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "browser_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    # Auth config: { type: 'none'|'basic'|'bearer'|'api_key'|'hmac', ... }
    # NB: backslash-escape the colons inside the JSON literal — SQLAlchemy's
    # text() otherwise reads `:type` as a bind param.
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "auth",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{\"type\"\\:\"none\"}'::jsonb"),
        ),
    )

    # Retry policy: { count: int, intervalMs: int }
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "retry_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text(
                "'{\"count\"\\:0,\"intervalMs\"\\:300}'::jsonb"
            ),
        ),
    )

    # Alert condition: { failingMinutes, fromLocations, totalLocations }
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "alert_condition",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text(
                "'{\"failingMinutes\"\\:0,\"fromLocations\"\\:1}'::jsonb"
            ),
        ),
    )

    # Monitor message template (notification copy).
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "monitor_message",
            sa.Text,
            nullable=False,
            server_default="",
        ),
    )

    # Scheduled downtimes: list of { startMs, endMs, reason }.
    op.add_column(
        "synthetic_tests",
        sa.Column(
            "downtimes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.create_check_constraint(
        "synthetic_tests_test_type_check",
        "synthetic_tests",
        "test_type IN ('api', 'browser', 'multistep')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "synthetic_tests_test_type_check", "synthetic_tests", type_="check"
    )
    op.drop_column("synthetic_tests", "downtimes")
    op.drop_column("synthetic_tests", "monitor_message")
    op.drop_column("synthetic_tests", "alert_condition")
    op.drop_column("synthetic_tests", "retry_config")
    op.drop_column("synthetic_tests", "auth")
    op.drop_column("synthetic_tests", "browser_config")
    op.drop_column("synthetic_tests", "test_type")

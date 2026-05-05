"""security — detection rules + signals queue

Detection rules scope events with a query and emit signals when their cases
match. Signals are severity-ranked alerts in a triage queue (open /
under_review / archived).

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-05 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "detection_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # rule_type: log_signature | threshold | new_term | anomaly
        sa.Column("rule_type", sa.Text, nullable=False, server_default="log_signature"),
        # source: logs | spans | audit
        sa.Column("source", sa.Text, nullable=False, server_default="logs"),
        sa.Column("query", sa.Text, nullable=False, server_default=""),
        # cases: [{name, condition: "count > 10", severity}]
        sa.Column(
            "cases",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "severity_default",
            sa.Text,
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "mitre_tactics",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
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
        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "rule_type IN ('log_signature','threshold','new_term','anomaly')",
            name="detection_rules_type_check",
        ),
        sa.CheckConstraint(
            "source IN ('logs','spans','audit')",
            name="detection_rules_source_check",
        ),
        sa.CheckConstraint(
            "severity_default IN ('critical','high','medium','low','info')",
            name="detection_rules_sev_check",
        ),
    )

    op.create_table(
        "security_signals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("detection_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("severity", sa.Text, nullable=False, server_default="medium"),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column("archive_reason", sa.Text, nullable=True),
        sa.Column("affected_service", sa.Text, nullable=True),
        sa.Column("affected_host", sa.Text, nullable=True),
        sa.Column("affected_user", sa.Text, nullable=True),
        sa.Column(
            "source_event_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "mitre_tactics",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "triaged_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "triaged_by",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "severity IN ('critical','high','medium','low','info')",
            name="security_signals_sev_check",
        ),
        sa.CheckConstraint(
            "status IN ('open','under_review','archived')",
            name="security_signals_status_check",
        ),
        sa.CheckConstraint(
            "archive_reason IS NULL OR archive_reason IN "
            "('tp_malicious','tp_benign','fp_other')",
            name="security_signals_archive_reason_check",
        ),
    )
    op.create_index(
        "ix_signals_status_created",
        "security_signals",
        ["status", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_signals_severity_created",
        "security_signals",
        ["severity", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_signals_rule_created",
        "security_signals",
        ["rule_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("security_signals")
    op.drop_table("detection_rules")

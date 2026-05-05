"""incidents — declare, timeline, tasks, postmortems

Full incident lifecycle: each incident is a top-level record with severity,
status, commander/comms roles, affected_services. The timeline is an
append-only event log. Tasks track action items. Postmortems are 1:1 with
their incident and produced from a template.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-05 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("display_id", sa.Text, nullable=False, unique=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("severity", sa.Text, nullable=False, server_default="SEV-3"),
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("root_cause", sa.Text, nullable=True),
        sa.Column("customer_impact", sa.Text, nullable=True),
        sa.Column("detected_via", sa.Text, nullable=True),
        sa.Column(
            "affected_services",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "commander_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "comms_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "resolved_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "completed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "severity IN ('SEV-1','SEV-2','SEV-3','SEV-4','SEV-5')",
            name="incidents_severity_check",
        ),
        sa.CheckConstraint(
            "status IN ('active','stable','resolved','completed')",
            name="incidents_status_check",
        ),
    )
    op.create_index(
        "ix_incidents_status_created",
        "incidents",
        ["status", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_incidents_severity_created",
        "incidents",
        ["severity", sa.text("created_at DESC")],
    )

    op.create_table(
        "incident_timeline",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # kind: state_change | comment | integration | task_added | role_assigned | severity_change
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column(
            "actor_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_label", sa.Text, nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_incident_timeline_incident_occurred",
        "incident_timeline",
        ["incident_id", sa.text("occurred_at ASC")],
    )

    op.create_table(
        "incident_tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column(
            "assignee_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assignee_label", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "completed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('open','in_progress','done')",
            name="incident_tasks_status_check",
        ),
    )
    op.create_index(
        "ix_incident_tasks_incident_created",
        "incident_tasks",
        ["incident_id", sa.text("created_at DESC")],
    )

    op.create_table(
        "incident_postmortems",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("status", sa.Text, nullable=False, server_default="draft"),
        sa.Column(
            "template_used",
            sa.Text,
            nullable=False,
            server_default="five-whys",
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
            "status IN ('draft','published')",
            name="incident_postmortems_status_check",
        ),
    )

    # Sequence for human-readable display IDs (INC-1234)
    op.execute("CREATE SEQUENCE IF NOT EXISTS incident_display_seq START 1000;")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS incident_display_seq;")
    op.drop_table("incident_postmortems")
    op.drop_table("incident_tasks")
    op.drop_table("incident_timeline")
    op.drop_table("incidents")

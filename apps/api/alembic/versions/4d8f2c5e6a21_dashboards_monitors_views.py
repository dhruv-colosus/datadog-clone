"""dashboards_monitors_views

User-authored tables: dashboards (with embedded share JSONB), monitors (CRUD
only — evaluator deferred), saved_views.

Revision ID: 4d8f2c5e6a21
Revises: 3c7e1a4b5f10
Create Date: 2026-05-03 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "4d8f2c5e6a21"
down_revision: Union[str, None] = "3c7e1a4b5f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
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
        sa.Column("kind", sa.Text, nullable=False, server_default="dashboard"),
        sa.Column("icon", sa.Text, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "layout",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "widgets",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "template_vars",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "share",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("popularity", sa.Integer, nullable=False, server_default="0"),
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
    )
    op.create_index(
        "ix_dashboards_owner_updated", "dashboards",
        ["owner_id", sa.text("updated_at DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_dashboards_widgets_gin "
        "ON dashboards USING GIN (widgets)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_dashboards_share_gin "
        "ON dashboards USING GIN (share)"
    )

    op.create_table(
        "monitors",
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
        sa.Column("type", sa.Text, nullable=False, server_default="metric"),
        sa.Column(
            "query",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "thresholds",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("recovery_message", sa.Text, nullable=True),
        sa.Column("impact", sa.Text, nullable=True),
        sa.Column(
            "runbook_steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("priority", sa.SmallInteger, nullable=True),
        sa.Column("team", sa.Text, nullable=True),
        sa.Column("muted", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
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
    )
    op.create_index("ix_monitors_owner_updated", "monitors", ["owner_id", sa.text("updated_at DESC")])

    op.create_table(
        "saved_views",
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
        sa.Column("kind", sa.Text, nullable=False),  # metrics | logs | apm
        sa.Column("name", sa.Text, nullable=False),
        sa.Column(
            "state",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("team", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_saved_views_owner_kind", "saved_views", ["owner_id", "kind"])


def downgrade() -> None:
    op.drop_table("saved_views")
    op.drop_table("monitors")
    op.drop_table("dashboards")

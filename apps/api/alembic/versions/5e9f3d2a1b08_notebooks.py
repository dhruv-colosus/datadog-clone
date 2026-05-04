"""notebooks

Notion-style notebooks: ordered list of cells (markdown text + widget) stored
as JSONB. Mirrors the dashboards table shape but with `cells` instead of
`widgets` + `layout`.

Revision ID: 5e9f3d2a1b08
Revises: 4d8f2c5e6a21
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "5e9f3d2a1b08"
down_revision: Union[str, None] = "4d8f2c5e6a21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notebooks",
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
        sa.Column("type", sa.Text, nullable=False, server_default="investigation"),
        sa.Column(
            "cells",
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
    )
    op.create_index(
        "ix_notebooks_owner_updated",
        "notebooks",
        ["owner_id", sa.text("updated_at DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notebooks_cells_gin "
        "ON notebooks USING GIN (cells)"
    )


def downgrade() -> None:
    op.drop_table("notebooks")

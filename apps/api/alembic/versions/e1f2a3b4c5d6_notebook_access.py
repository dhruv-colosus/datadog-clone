"""notebook_access

Adds an `access` column to notebooks so they can be shared with the org or
kept private. Values: 'private' (only owner), 'org' (everyone can view/edit).

Revision ID: e1f2a3b4c5d6
Revises: d9e0f1a2b3c4
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notebooks",
        sa.Column(
            "access",
            sa.Text,
            nullable=False,
            server_default="private",
        ),
    )
    op.create_index(
        "ix_notebooks_access",
        "notebooks",
        ["access"],
    )


def downgrade() -> None:
    op.drop_index("ix_notebooks_access", table_name="notebooks")
    op.drop_column("notebooks", "access")

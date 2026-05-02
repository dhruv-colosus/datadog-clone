"""replace_google_id_with_password_hash

Revision ID: 2a4f1c8b9e22
Revises: 1e92573eb44b
Create Date: 2026-05-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a4f1c8b9e22"
down_revision: Union[str, None] = "1e92573eb44b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.add_column(
        "users",
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
            server_default="",
        ),
    )
    op.alter_column("users", "password_hash", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "password_hash")
    op.add_column(
        "users",
        sa.Column(
            "google_id",
            sa.String(length=128),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_google_id", "users", ["google_id"], unique=True
    )

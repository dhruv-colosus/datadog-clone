"""monitor status + muted_until

Add `status` text column (Alert/Warn/OK/No Data) and `muted_until`
timestamptz so monitors can support resolve and time-bounded mute.

Revision ID: 9d3e7a5b2c10
Revises: 8c9d5e1f3a42
Create Date: 2026-05-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d3e7a5b2c10"
down_revision: Union[str, None] = "8c9d5e1f3a42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "monitors",
        sa.Column(
            "status",
            sa.Text,
            nullable=False,
            server_default="No Data",
        ),
    )
    op.add_column(
        "monitors",
        sa.Column(
            "muted_until",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("monitors", "muted_until")
    op.drop_column("monitors", "status")

"""process resource usage

Add cpu_percent + rss_mib to topology_processes so the infrastructure UI's
Processes tab can show real per-process CPU and memory next to the command.

Revision ID: 8c9d5e1f3a42
Revises: 7b8c4f0d2e51
Create Date: 2026-05-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c9d5e1f3a42"
down_revision: Union[str, None] = "7b8c4f0d2e51"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "topology_processes",
        sa.Column("cpu_percent", sa.Float, nullable=False, server_default="0"),
    )
    op.add_column(
        "topology_processes",
        sa.Column("rss_mib", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("topology_processes", "rss_mib")
    op.drop_column("topology_processes", "cpu_percent")

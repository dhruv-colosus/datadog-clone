"""logs pipelines + facets + sensitive-data scrubbers

Pipelines transform incoming logs (filter -> processors -> attributes mutated).
Facets register attribute paths for the Logs Explorer left panel. Scrubbers
match sensitive patterns and replace them inline; matches are recorded as
findings under Security > Data Security.

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-05-05 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "log_pipelines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("filter_query", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "processors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "is_nested",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        sa.Column(
            "parent_pipeline_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "is_integration",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        sa.Column("integration_name", sa.Text, nullable=True),
        sa.Column(
            "modified_by",
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
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_log_pipelines_order",
        "log_pipelines",
        ["order_index"],
    )

    op.create_table(
        "log_facets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("path", sa.Text, nullable=False, unique=True),
        sa.Column("display_name", sa.Text, nullable=False),
        sa.Column("facet_kind", sa.Text, nullable=False, server_default="qualitative"),
        sa.Column("data_type", sa.Text, nullable=False, server_default="string"),
        sa.Column("group_name", sa.Text, nullable=False, server_default="General"),
        sa.Column(
            "hidden",
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
        sa.CheckConstraint(
            "facet_kind IN ('qualitative','quantitative')",
            name="log_facets_kind_check",
        ),
        sa.CheckConstraint(
            "data_type IN ('string','integer','double','boolean')",
            name="log_facets_dtype_check",
        ),
    )

    op.create_table(
        "scrubber_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("pattern_kind", sa.Text, nullable=False, server_default="library"),
        sa.Column("library_pattern_id", sa.Text, nullable=True),
        sa.Column("custom_regex", sa.Text, nullable=True),
        sa.Column(
            "replacement_strategy",
            sa.Text,
            nullable=False,
            server_default="redact",
        ),
        sa.Column(
            "scope_namespaces",
            postgresql.ARRAY(sa.Text),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "enabled",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("TRUE"),
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
            "pattern_kind IN ('library','custom')",
            name="scrubber_rules_pattern_check",
        ),
        sa.CheckConstraint(
            "replacement_strategy IN ('redact','hash','partial_redact')",
            name="scrubber_rules_replacement_check",
        ),
    )

    op.create_table(
        "scrubber_findings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scrubber_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("log_id", sa.Text, nullable=True),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("excerpt_redacted", sa.Text, nullable=False),
        sa.Column("pattern_matched", sa.Text, nullable=False),
    )
    op.create_index(
        "ix_scrubber_findings_rule_occurred",
        "scrubber_findings",
        ["rule_id", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_scrubber_findings_occurred",
        "scrubber_findings",
        [sa.text("occurred_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("scrubber_findings")
    op.drop_table("scrubber_rules")
    op.drop_table("log_facets")
    op.drop_table("log_pipelines")

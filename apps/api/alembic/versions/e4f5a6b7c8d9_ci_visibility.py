"""ci visibility — pipelines, executions, jobs, test runs, TIA stats

Synthetic CI pipeline data tied to the canonical 8 services. Pipelines have
executions; executions decompose into a job tree (stage → job → step → command);
each execution emits test runs; daily TIA stats roll up per service.

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-05 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ci_pipelines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("repo", sa.Text, nullable=False),
        sa.Column("default_branch", sa.Text, nullable=False, server_default="main"),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("team", sa.Text, nullable=True),
        sa.Column("avg_duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "ci_pipeline_executions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "pipeline_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ci_pipelines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("commit_sha", sa.Text, nullable=False),
        sa.Column("branch", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("triggered_by", sa.Text, nullable=True),
        sa.Column("trigger_type", sa.Text, nullable=False, server_default="push"),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("queue_time_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "finished_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("error_domain", sa.Text, nullable=True),
        sa.CheckConstraint(
            "status IN ('success','failure','canceled','running')",
            name="ci_pipeline_executions_status_check",
        ),
        sa.CheckConstraint(
            "trigger_type IN ('push','pr','manual','schedule')",
            name="ci_pipeline_executions_trigger_check",
        ),
    )
    op.create_index(
        "ix_ci_executions_pipeline_started",
        "ci_pipeline_executions",
        ["pipeline_id", sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_ci_executions_started",
        "ci_pipeline_executions",
        [sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_ci_executions_status_started",
        "ci_pipeline_executions",
        ["status", sa.text("started_at DESC")],
    )

    op.create_table(
        "ci_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "execution_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ci_pipeline_executions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_job_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "finished_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("logs_excerpt", sa.Text, nullable=True),
        sa.CheckConstraint(
            "kind IN ('stage','job','step','command')",
            name="ci_jobs_kind_check",
        ),
        sa.CheckConstraint(
            "status IN ('success','failure','canceled','skipped','running')",
            name="ci_jobs_status_check",
        ),
    )
    op.create_index(
        "ix_ci_jobs_execution_started",
        "ci_jobs",
        ["execution_id", sa.text("started_at ASC")],
    )

    op.create_table(
        "ci_test_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "execution_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ci_pipeline_executions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("suite", sa.Text, nullable=False),
        sa.Column("test_name", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("skipped_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('passed','failed','skipped','flaky')",
            name="ci_test_runs_status_check",
        ),
    )
    op.create_index(
        "ix_ci_test_runs_execution",
        "ci_test_runs",
        ["execution_id"],
    )

    op.create_table(
        "ci_test_impact_stats",
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("service", sa.Text, nullable=False),
        sa.Column("total_tests", sa.Integer, nullable=False, server_default="0"),
        sa.Column("skipped_by_itr", sa.Integer, nullable=False, server_default="0"),
        sa.Column("time_saved_ms", sa.BigInteger, nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("day", "service"),
    )


def downgrade() -> None:
    op.drop_table("ci_test_impact_stats")
    op.drop_table("ci_test_runs")
    op.drop_table("ci_jobs")
    op.drop_table("ci_pipeline_executions")
    op.drop_table("ci_pipelines")

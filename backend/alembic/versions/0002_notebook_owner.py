"""add owner_id to notebooks

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-26
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notebooks", sa.Column("owner_id", sa.String(length=255), nullable=True))
    op.create_index("ix_notebooks_owner_id", "notebooks", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_notebooks_owner_id", table_name="notebooks")
    op.drop_column("notebooks", "owner_id")

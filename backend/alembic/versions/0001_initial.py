"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-25
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

EMBEDDING_DIM = 1536

source_type_enum = pg.ENUM(
    "pdf", "text", "website", "youtube", "vtt", name="sourcetype", create_type=False
)
source_status_enum = pg.ENUM(
    "uploading", "extracting", "chunking", "embedding", "ready", "failed",
    name="sourcestatus", create_type=False,
)
role_enum = pg.ENUM("user", "assistant", name="role", create_type=False)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    bind = op.get_bind()
    source_type_enum.create(bind, checkfirst=True)
    source_status_enum.create(bind, checkfirst=True)
    role_enum.create(bind, checkfirst=True)

    op.create_table(
        "notebooks",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sources",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "notebook_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column("type", source_type_enum, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", source_status_enum, nullable=False, server_default="uploading"),
        sa.Column("status_detail", sa.Text, nullable=True),
        sa.Column("origin", sa.Text, nullable=False),
        sa.Column("file_path", sa.Text, nullable=True),
        sa.Column("meta", sa.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "chunks",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "notebook_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column(
            "source_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("sources.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("page", sa.Integer, nullable=True),
        sa.Column("timestamp_start", sa.Float, nullable=True),
        sa.Column("timestamp_end", sa.Float, nullable=True),
        sa.Column("section", sa.String(500), nullable=True),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
    )

    # ANN index for cosine similarity search.
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    # Full text search index (BM25-ish) used by the hybrid retrieval step.
    op.execute(
        "CREATE INDEX ix_chunks_fts ON chunks USING GIN (to_tsvector('english', content))"
    )

    op.create_table(
        "messages",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "notebook_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "citations",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column("chunk_id", pg.UUID(as_uuid=True), sa.ForeignKey("chunks.id", ondelete="CASCADE")),
        sa.Column("marker_index", sa.Integer, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("citations")
    op.drop_table("messages")
    op.execute("DROP INDEX IF EXISTS ix_chunks_fts")
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding")
    op.drop_table("chunks")
    op.drop_table("sources")
    op.drop_table("notebooks")
    role_enum.drop(op.get_bind(), checkfirst=True)
    source_status_enum.drop(op.get_bind(), checkfirst=True)
    source_type_enum.drop(op.get_bind(), checkfirst=True)

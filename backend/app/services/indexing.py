"""
Orchestrates the full ingestion pipeline for one source:

    extracting -> chunking -> embedding -> ready (or failed)

Status is written to the DB after every stage so the frontend's polling
(or websocket, see api/sources.py) always reflects real progress, and so
a crash mid-pipeline leaves a source in a clearly-labeled failed state
rather than silently stuck.
"""
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chunking.chunker import chunk_units
from app.core.db import AsyncSessionLocal
from app.embeddings.embedder import embed_texts
from app.extractors.registry import get_extractor
from app.models.models import Chunk, Source, SourceStatus

logger = logging.getLogger(__name__)


async def _set_status(db: AsyncSession, source: Source, status: SourceStatus, detail: str | None = None):
    source.status = status
    source.status_detail = detail
    await db.commit()


async def run_indexing_pipeline(source_id) -> None:
    """Entry point used by both the Celery worker and the inline
    (no-Celery) fallback path. Owns its own DB session since it may run
    in a separate worker process."""
    async with AsyncSessionLocal() as db:
        source = (await db.execute(select(Source).where(Source.id == source_id))).scalar_one_or_none()
        if source is None:
            logger.warning("Source %s not found, skipping indexing", source_id)
            return

        try:
            await _set_status(db, source, SourceStatus.extracting)
            logger.info("Source %s: extracting (%s)", source_id, source.type)
            extractor = get_extractor(source.type)
            try:
                units = await extractor.extract(source)
            except FileNotFoundError as e:
                await _set_status(db, source, SourceStatus.failed, f"File not found: {str(e)}")
                logger.warning("Source %s file not found, marked as failed", source_id)
                return


            if not units:
                await _set_status(db, source, SourceStatus.failed, "No extractable content found.")
                return

            await _set_status(db, source, SourceStatus.chunking)
            logger.info("Source %s: extracted %d unit(s), chunking", source_id, len(units))
            prepared = chunk_units(units)
            if not prepared:
                await _set_status(db, source, SourceStatus.failed, "Chunking produced no content.")
                return

            await _set_status(db, source, SourceStatus.embedding)
            logger.info("Source %s: chunked into %d piece(s), embedding", source_id, len(prepared))
            embeddings = await embed_texts([c.text for c in prepared])

            # Replace any previous chunks (covers re-index).
            await db.execute(delete(Chunk).where(Chunk.source_id == source.id))
            for prep, emb in zip(prepared, embeddings):
                db.add(
                    Chunk(
                        notebook_id=source.notebook_id,
                        source_id=source.id,
                        content=prep.text,
                        chunk_index=prep.chunk_index,
                        page=prep.page,
                        timestamp_start=prep.timestamp_start,
                        timestamp_end=prep.timestamp_end,
                        section=prep.section,
                        embedding=emb,
                    )
                )
            source.meta = {**source.meta, "chunk_count": len(prepared)}
            await _set_status(db, source, SourceStatus.ready)
            logger.info("Source %s: ready (%d chunks)", source_id, len(prepared))

        except Exception as e:  # noqa: BLE001
            logger.exception("Indexing failed for source %s", source_id)
            await _set_status(db, source, SourceStatus.failed, str(e)[:500])

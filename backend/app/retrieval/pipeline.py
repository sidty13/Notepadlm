"""
Modern retrieval pipeline:

    raw question
        -> rewrite_query (standalone, de-referenced query using chat history)
        -> hybrid search (pgvector cosine  +  Postgres full-text/BM25-ish)
        -> reciprocal rank fusion to merge the two ranked lists
        -> rerank (cross-encoder-style LLM rerank over the fused top-N)
        -> top TOP_K_FINAL chunks returned with full citation metadata

Every step is notebook-scoped: no query ever touches another notebook's
chunks, enforced via `Chunk.notebook_id == notebook_id` in every SQL
statement below.
"""
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.embeddings.embedder import embed_query
from app.generation.llm import rewrite_query as llm_rewrite_query
from app.generation.llm import rerank_chunks as llm_rerank_chunks
from app.models.models import Chunk, Source


@dataclass
class RetrievedChunk:
    chunk: Chunk
    source: Source
    score: float


async def rewrite_query(question: str, history: list[dict]) -> str:
    """Turns a follow-up question ('what about the second one?') into a
    standalone query using recent chat history. Falls back to the raw
    question if rewriting fails for any reason."""
    if not history:
        return question
    try:
        return await llm_rewrite_query(question, history)
    except Exception:
        return question


async def _vector_search(db: AsyncSession, notebook_id, query_embedding, k: int) -> list[tuple]:
    stmt = (
        select(Chunk, Chunk.embedding.cosine_distance(query_embedding).label("dist"))
        .where(Chunk.notebook_id == notebook_id, Chunk.embedding.is_not(None))
        .order_by("dist")
        .limit(k)
    )
    rows = (await db.execute(stmt)).all()
    return [(row[0], 1 - row[1]) for row in rows]  # convert distance -> similarity


async def _bm25_search(db: AsyncSession, notebook_id, query: str, k: int) -> list[tuple]:
    """Postgres full-text search over chunk content, scoped to the notebook."""
    sql = text(
        """
        SELECT id, ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :q)) AS rank
        FROM chunks
        WHERE notebook_id = :nb
          AND to_tsvector('english', content) @@ plainto_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT :k
        """
    )
    rows = (await db.execute(sql, {"q": query, "nb": str(notebook_id), "k": k})).all()
    if not rows:
        return []
    ids = [r[0] for r in rows]
    chunks = (await db.execute(select(Chunk).where(Chunk.id.in_(ids)))).scalars().all()
    by_id = {c.id: c for c in chunks}
    return [(by_id[r[0]], float(r[1])) for r in rows if r[0] in by_id]


def _reciprocal_rank_fusion(*ranked_lists: list[tuple], k: int = 60) -> dict:
    """Standard RRF: score = sum(1 / (k + rank)) across lists."""
    fused: dict = {}
    for ranked in ranked_lists:
        for rank, (chunk, _score) in enumerate(ranked):
            fused[chunk.id] = fused.get(chunk.id, {"chunk": chunk, "score": 0.0})
            fused[chunk.id]["score"] += 1.0 / (k + rank + 1)
    return fused


async def retrieve(
    db: AsyncSession, notebook_id, question: str, history: list[dict]
) -> tuple[list[RetrievedChunk], str]:
    standalone_query = await rewrite_query(question, history)

    query_embedding = await embed_query(standalone_query)
    vector_hits = await _vector_search(db, notebook_id, query_embedding, settings.TOP_K_VECTOR)
    bm25_hits = await _bm25_search(db, notebook_id, standalone_query, settings.TOP_K_BM25)

    fused = _reciprocal_rank_fusion(vector_hits, bm25_hits)
    candidates = sorted(fused.values(), key=lambda x: x["score"], reverse=True)
    candidate_chunks = [c["chunk"] for c in candidates][: max(settings.TOP_K_FINAL * 3, 15)]

    if settings.USE_RERANKER and candidate_chunks:
        try:
            candidate_chunks = await llm_rerank_chunks(
                standalone_query, candidate_chunks, top_n=settings.TOP_K_FINAL
            )
        except Exception:
            candidate_chunks = candidate_chunks[: settings.TOP_K_FINAL]
    else:
        candidate_chunks = candidate_chunks[: settings.TOP_K_FINAL]

    # Attach source objects (needed for citation display).
    source_ids = {c.source_id for c in candidate_chunks}
    sources = (
        (await db.execute(select(Source).where(Source.id.in_(source_ids)))).scalars().all()
    )
    sources_by_id = {s.id: s for s in sources}

    results = [
        RetrievedChunk(chunk=c, source=sources_by_id[c.source_id], score=0.0)
        for c in candidate_chunks
        if c.source_id in sources_by_id
    ]
    return results, standalone_query

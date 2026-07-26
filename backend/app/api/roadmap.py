"""
Bonus 1: Personalized learning roadmap.

Given a notebook's sources (built for YouTube videos/playlists but works
with any source type), asks the LLM to group them into a week-by-week
roadmap of concepts, referencing which source(s) teach each concept.
Kept intentionally simple (single LLM call over source titles + a
sample of their content) rather than a bespoke curriculum-planning
pipeline, per the assignment's "simplified but working" guidance.
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_notebook
from app.core.config import settings
from app.core.db import get_db
from app.generation.llm import get_client
from app.models.models import Chunk, Notebook, Source, SourceStatus
from app.schemas.schemas import RoadmapRequest

router = APIRouter(prefix="/notebooks/{notebook_id}/roadmap", tags=["roadmap"])

_ROADMAP_PROMPT = """You are an expert curriculum designer. Given the sources below (with a short
content sample from each), design a week-by-week learning roadmap that sequences them from
foundational to advanced. Group related sources under weekly themes.

Return ONLY valid JSON in this exact shape:
{{
  "weeks": [
    {{
      "week": 1,
      "theme": "Neural network basics",
      "items": [
        {{"source_id": "...", "source_title": "...", "why": "one sentence on what this teaches and why it's here"}}
      ]
    }}
  ]
}}

Sources:
{sources_block}
"""


@router.post("")
async def generate_roadmap(
    notebook_id: uuid.UUID,
    payload: RoadmapRequest,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    stmt = select(Source).where(Source.notebook_id == notebook_id, Source.status == SourceStatus.ready)
    if payload.source_ids:
        stmt = stmt.where(Source.id.in_(payload.source_ids))
    sources = (await db.execute(stmt)).scalars().all()
    if not sources:
        raise HTTPException(400, "No ready sources found to build a roadmap from.")

    blocks = []
    for s in sources:
        sample_chunk = (
            await db.execute(
                select(Chunk).where(Chunk.source_id == s.id).order_by(Chunk.chunk_index).limit(1)
            )
        ).scalar_one_or_none()
        sample = sample_chunk.content[:400] if sample_chunk else ""
        blocks.append(f"- id: {s.id}\n  title: {s.title}\n  type: {s.type.value}\n  sample: {sample}")

    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": _ROADMAP_PROMPT.format(sources_block="\n".join(blocks))}],
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(502, "The model returned an unparseable roadmap. Please try again.")
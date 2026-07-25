"""
Powers the "open original source from a citation" experience.

- PDF: returns the file itself; frontend's PDF viewer jumps to
  chunk.page and highlights using the returned text snippet.
- Website: returns the origin URL + the section heading + chunk text so
  the frontend can open the URL and use text-fragment highlighting
  (#:~:text=...) or an in-app preview.
- YouTube: returns a deep link with &t=<seconds>.
- Text/VTT: returns char offsets / cue text for in-app highlighting.
"""
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import Chunk, Source, SourceType

router = APIRouter(prefix="/notebooks/{notebook_id}/chunks", tags=["viewer"])


@router.get("/{chunk_id}/view")
async def view_chunk_source(
    notebook_id: uuid.UUID, chunk_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    chunk = await db.get(Chunk, chunk_id)
    if not chunk or chunk.notebook_id != notebook_id:
        raise HTTPException(404, "Chunk not found")
    source = await db.get(Source, chunk.source_id)

    base = {
        "source_id": str(source.id),
        "source_type": source.type.value,
        "title": source.title,
        "chunk_text": chunk.content,
    }

    if source.type == SourceType.pdf:
        return {
            **base,
            "mode": "pdf",
            "page": chunk.page,
            "file_url": f"/api/notebooks/{notebook_id}/sources/{source.id}/file",
        }

    if source.type == SourceType.website:
        fragment = quote(chunk.content[:120])
        return {
            **base,
            "mode": "website",
            "section": chunk.section,
            "url": f"{source.origin}#:~:text={fragment}",
        }

    if source.type == SourceType.youtube:
        t = int(chunk.timestamp_start or 0)
        video_id = (chunk.content and source.meta.get("video_id")) or None
        origin = source.origin
        sep = "&" if "?" in origin else "?"
        return {
            **base,
            "mode": "youtube",
            "timestamp": t,
            "url": f"{origin}{sep}t={t}",
        }

    if source.type == SourceType.vtt:
        return {
            **base,
            "mode": "transcript",
            "timestamp_start": chunk.timestamp_start,
            "timestamp_end": chunk.timestamp_end,
        }

    # text
    return {**base, "mode": "text"}

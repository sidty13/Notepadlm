import json
import re
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_owned_notebook
from app.core.db import get_db
from app.generation.llm import stream_answer
from app.models.models import Chunk, Citation, Message, Notebook, Role
from app.retrieval.pipeline import retrieve
from app.schemas.schemas import ChatRequest, ChunkOut, MessageOut, SourceOut

router = APIRouter(prefix="/notebooks/{notebook_id}", tags=["chat"])

_CITATION_RE = re.compile(r"\[(\d+)]")


@router.get("/messages", response_model=list[MessageOut])
async def list_messages(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    rows = (
        await db.execute(
            select(Message)
            .where(Message.notebook_id == notebook_id)
            .options(selectinload(Message.citations).selectinload(Citation.chunk).selectinload(Chunk.source))
            .order_by(Message.created_at)
        )
    ).scalars().all()
    out = []
    for m in rows:
        citations = [
            {
                "marker_index": c.marker_index,
                "chunk": ChunkOut.model_validate(c.chunk),
                "source": SourceOut.model_validate(c.chunk.source),
            }
            for c in sorted(m.citations, key=lambda c: c.marker_index)
        ]
        out.append(
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
                citations=citations,
            )
        )
    return out


@router.post("/chat")
async def chat(
    notebook_id: uuid.UUID,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    """
    Streams the answer as Server-Sent Events. Event types:
      - {"type": "context", "chunks": [...]}   sent first, so the UI can
        pre-render citation targets before/while text streams in
      - {"type": "token", "text": "..."}       repeated for each token
      - {"type": "done", "message_id": "..."}  final event
    """
    history_rows = (
        await db.execute(
            select(Message).where(Message.notebook_id == notebook_id).order_by(Message.created_at)
        )
    ).scalars().all()
    history = [{"role": m.role.value, "content": m.content} for m in history_rows]

    user_msg = Message(notebook_id=notebook_id, role=Role.user, content=payload.question)
    db.add(user_msg)
    await db.commit()

    retrieved, standalone_query = await retrieve(db, notebook_id, payload.question, history)

    async def event_gen():
        context_payload = {
            "type": "context",
            "standalone_query": standalone_query,
            "chunks": [
                {
                    "marker_index": i + 1,
                    "chunk": ChunkOut.model_validate(r.chunk).model_dump(mode="json"),
                    "source": SourceOut.model_validate(r.source).model_dump(mode="json"),
                }
                for i, r in enumerate(retrieved)
            ],
        }
        yield f"data: {json.dumps(context_payload)}\n\n"

        full_text = ""
        if not retrieved:
            full_text = (
                "This notebook doesn't have any indexed, ready sources yet, "
                "so I don't have anything grounded to answer from. Add a source "
                "and wait for it to finish indexing, then ask again."
            )
            yield f"data: {json.dumps({'type': 'token', 'text': full_text})}\n\n"
        else:
            async for token in stream_answer(payload.question, history, retrieved):
                full_text += token
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"

        # Persist assistant message + citations, matching [n] markers found
        # in the generated text to the retrieved chunks.
        assistant_msg = Message(notebook_id=notebook_id, role=Role.assistant, content=full_text)
        db.add(assistant_msg)
        await db.flush()

        cited_indices = {int(m) for m in _CITATION_RE.findall(full_text)}
        for i, r in enumerate(retrieved):
            marker = i + 1
            if marker in cited_indices:
                db.add(Citation(message_id=assistant_msg.id, chunk_id=r.chunk.id, marker_index=marker))
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_msg.id)})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
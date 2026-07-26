"""
Quiz + flashcard generation from a notebook's sources.

Same pattern as roadmap.py: pull a content sample from each ready source,
ask the LLM for structured JSON, validate it against QuizResponse so the
frontend gets a guaranteed shape (unlike roadmap/podcast, which pass raw
JSON through — this one is worth the extra validation since a malformed
question/option array would break the quiz UI, not just look off).
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_notebook
from app.core.config import settings
from app.core.db import get_db
from app.generation.llm import get_client
from app.models.models import Chunk, Notebook, Source, SourceStatus
from app.schemas.schemas import QuizRequest, QuizResponse

router = APIRouter(prefix="/notebooks/{notebook_id}/quiz", tags=["quiz"])

_QUIZ_PROMPT = """You are an expert instructor. Based on the source material below, create study
material that tests real understanding, not just recall of exact wording.

Create exactly {num_questions} multiple-choice questions, each with exactly 4 options where
exactly one is correct. Vary difficulty and cover different sources/concepts. Include a one
sentence explanation of why the correct answer is right.

Also create exactly {num_flashcards} flashcards covering key terms, facts, and concepts a
student should be able to recall — front is a term/question, back is a concise answer.

Return ONLY valid JSON in this exact shape:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_index": 0,
      "explanation": "..."
    }}
  ],
  "flashcards": [
    {{"front": "...", "back": "..."}}
  ]
}}

Source material:
{material}
"""


@router.post("", response_model=QuizResponse)
async def generate_quiz(
    notebook_id: uuid.UUID,
    payload: QuizRequest,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
) -> QuizResponse:
    stmt = select(Source).where(Source.notebook_id == notebook_id, Source.status == SourceStatus.ready)
    if payload.source_ids:
        stmt = stmt.where(Source.id.in_(payload.source_ids))
    sources = (await db.execute(stmt)).scalars().all()
    if not sources:
        raise HTTPException(400, "No ready sources found to build a quiz from.")

    material_parts = []
    for s in sources:
        chunks = (
            await db.execute(
                select(Chunk).where(Chunk.source_id == s.id).order_by(Chunk.chunk_index).limit(6)
            )
        ).scalars().all()
        sample = " ".join(c.content for c in chunks)[:3000]
        material_parts.append(f"### {s.title}\n{sample}")

    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=3000,
        messages=[
            {
                "role": "user",
                "content": _QUIZ_PROMPT.format(
                    num_questions=payload.num_questions,
                    num_flashcards=payload.num_flashcards,
                    material="\n\n".join(material_parts),
                ),
            }
        ],
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        parsed = json.loads(raw)
        return QuizResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError):
        raise HTTPException(502, "The model returned an unparseable quiz. Please try again.")

"""
Bonus 2: Turn a notebook's sources into a two-host podcast MP3.

Pipeline: summarize sources -> generate a two-host conversation script
with an LLM -> synthesize each line with OpenAI TTS (alternating voices)
-> concatenate into a single MP3. No voice training/cloning needed.
"""
import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.generation.llm import get_client
from app.models.models import Chunk, Source, SourceStatus
from app.schemas.schemas import PodcastRequest

router = APIRouter(prefix="/notebooks/{notebook_id}/podcast", tags=["podcast"])

_SCRIPT_PROMPT = """Create a lively two-host podcast script (Host A and Host B) that explains and
discusses the material below in about 12-18 exchanges. Host A introduces topics and asks
questions; Host B explains and adds insight. Keep each line under 45 words, conversational, no
stage directions.

Return ONLY valid JSON: {{"lines": [{{"speaker": "A", "text": "..."}}, ...]}}

Material:
{material}
"""


@router.post("")
async def generate_podcast(notebook_id: uuid.UUID, payload: PodcastRequest, db: AsyncSession = Depends(get_db)):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(400, "OPENAI_API_KEY is not set; TTS is unavailable.")

    stmt = select(Source).where(Source.notebook_id == notebook_id, Source.status == SourceStatus.ready)
    if payload.source_ids:
        stmt = stmt.where(Source.id.in_(payload.source_ids))
    sources = (await db.execute(stmt)).scalars().all()
    if not sources:
        raise HTTPException(400, "No ready sources found to build a podcast from.")

    material_parts = []
    for s in sources:
        chunks = (
            await db.execute(
                select(Chunk).where(Chunk.source_id == s.id).order_by(Chunk.chunk_index).limit(4)
            )
        ).scalars().all()
        sample = " ".join(c.content for c in chunks)[:2500]
        material_parts.append(f"### {s.title}\n{sample}")

    openai_client = get_client()
    resp = await openai_client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=3000,
        messages=[{"role": "user", "content": _SCRIPT_PROMPT.format(material="\n\n".join(material_parts))}],
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        script = json.loads(raw)["lines"]
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(502, "The model returned an unparseable podcast script. Please try again.")

    out_dir = os.path.join(settings.UPLOAD_DIR, str(notebook_id), "podcast")
    os.makedirs(out_dir, exist_ok=True)
    final_path = os.path.join(out_dir, f"{uuid.uuid4()}.mp3")

    segment_paths = []
    for i, line in enumerate(script):
        voice = (
            settings.OPENAI_TTS_VOICE_HOST_A
            if line["speaker"].upper() == "A"
            else settings.OPENAI_TTS_VOICE_HOST_B
        )
        seg_path = os.path.join(out_dir, f"seg_{i:03d}.mp3")
        async with openai_client.audio.speech.with_streaming_response.create(
            model="tts-1", voice=voice, input=line["text"]
        ) as response:
            await response.stream_to_file(seg_path)
        segment_paths.append(seg_path)

    _concatenate_mp3s(segment_paths, final_path)
    for p in segment_paths:
        os.remove(p)

    return {
        "audio_url": f"/api/notebooks/{notebook_id}/podcast/file?path={os.path.basename(final_path)}",
        "script": script,
    }


def _concatenate_mp3s(paths: list[str], out_path: str) -> None:
    """Naive binary concatenation. MP3 frames concatenate acceptably for
    playback purposes without needing ffmpeg as a hard dependency; for
    production-grade seeking/gapless playback, swap in ffmpeg or pydub."""
    with open(out_path, "wb") as out_f:
        for p in paths:
            with open(p, "rb") as in_f:
                out_f.write(in_f.read())


@router.get("/file")
async def get_podcast_file(notebook_id: uuid.UUID, path: str):
    out_dir = os.path.join(settings.UPLOAD_DIR, str(notebook_id), "podcast")
    full_path = os.path.normpath(os.path.join(out_dir, path))
    if not full_path.startswith(os.path.abspath(out_dir)) or not os.path.exists(full_path):
        raise HTTPException(404, "Podcast file not found")
    return FileResponse(full_path, media_type="audio/mpeg")

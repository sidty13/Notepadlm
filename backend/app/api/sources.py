import logging
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_notebook
from app.core.config import settings
from app.core.db import get_db
from app.models.models import Notebook, Source, SourceStatus, SourceType
from app.schemas.schemas import SourceOut, WebsiteOrYoutubeSourceCreate
from app.services.indexing import run_indexing_pipeline

logger = logging.getLogger("notebook_rag")

router = APIRouter(prefix="/notebooks/{notebook_id}/sources", tags=["sources"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

_EXT_TO_TYPE = {".pdf": SourceType.pdf, ".txt": SourceType.text, ".md": SourceType.text, ".vtt": SourceType.vtt}


def _schedule_indexing(background_tasks: BackgroundTasks, source_id: uuid.UUID):
    """Uses Celery if configured/reachable, otherwise falls back to a
    FastAPI BackgroundTask so the app works out-of-the-box without Redis
    for local dev/demoing."""
    try:
        from app.workers.celery_app import index_source_task

        index_source_task.delay(str(source_id))
        logger.info("Dispatched indexing for source %s to Celery", source_id)
    except Exception:
        logger.exception(
            "Could not dispatch source %s to Celery -- falling back to an "
            "inline background task (runs in this API process, blocks its "
            "event loop for the duration)",
            source_id,
        )
        background_tasks.add_task(_run_inline, source_id)


async def _run_inline(source_id: uuid.UUID):
    await run_indexing_pipeline(source_id)


@router.get("", response_model=list[SourceOut])
async def list_sources(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    rows = (
        await db.execute(
            select(Source).where(Source.notebook_id == notebook_id).order_by(Source.created_at.desc())
        )
    ).scalars().all()
    return [SourceOut.model_validate(r) for r in rows]


@router.post("/upload", response_model=SourceOut, status_code=201)
async def upload_file_source(
    notebook_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    """Handles PDF, plain text, and VTT uploads."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    source_type = _EXT_TO_TYPE.get(ext)
    if source_type is None:
        raise HTTPException(400, f"Unsupported file type '{ext}'. Use .pdf, .txt, .md or .vtt")

    dest_dir = os.path.join(settings.UPLOAD_DIR, str(notebook_id))
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, f"{uuid.uuid4()}{ext}")
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    source = Source(
        notebook_id=notebook_id,
        type=source_type,
        title=title or file.filename or "Untitled",
        origin=file.filename or dest_path,
        file_path=dest_path,
        status=SourceStatus.uploading,
        meta={"size_bytes": len(content)},
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    _schedule_indexing(background_tasks, source.id)
    return SourceOut.model_validate(source)


@router.post("/website", response_model=SourceOut, status_code=201)
async def add_website_source(
    notebook_id: uuid.UUID,
    payload: WebsiteOrYoutubeSourceCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    source = Source(
        notebook_id=notebook_id,
        type=SourceType.website,
        title=payload.title or payload.url,
        origin=payload.url,
        status=SourceStatus.uploading,
        meta={},
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    _schedule_indexing(background_tasks, source.id)
    return SourceOut.model_validate(source)


@router.post("/youtube", response_model=SourceOut, status_code=201)
async def add_youtube_source(
    notebook_id: uuid.UUID,
    payload: WebsiteOrYoutubeSourceCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    source = Source(
        notebook_id=notebook_id,
        type=SourceType.youtube,
        title=payload.title or payload.url,
        origin=payload.url,
        status=SourceStatus.uploading,
        meta={},
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    _schedule_indexing(background_tasks, source.id)
    return SourceOut.model_validate(source)


@router.get("/{source_id}/file")
async def get_source_file(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serves the raw uploaded file (currently PDFs) for the source viewer.

    Deliberately not gated behind get_owned_notebook: this URL is loaded by
    a plain <iframe src=...>, which can't attach an Authorization header.
    It's protected by its unguessable notebook_id/source_id path instead,
    same tradeoff as the podcast file endpoint below.
    """
    source = await db.get(Source, source_id)
    if not source or source.notebook_id != notebook_id or not source.file_path:
        raise HTTPException(404, "File not found")
    return FileResponse(source.file_path, media_type="application/pdf", filename=source.title)


@router.get("/{source_id}", response_model=SourceOut)
async def get_source(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    source = await db.get(Source, source_id)
    if not source or source.notebook_id != notebook_id:
        raise HTTPException(404, "Source not found")
    return SourceOut.model_validate(source)


@router.post("/{source_id}/reindex", response_model=SourceOut)
async def reindex_source(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    source = await db.get(Source, source_id)
    if not source or source.notebook_id != notebook_id:
        raise HTTPException(404, "Source not found")
    source.status = SourceStatus.uploading
    source.status_detail = None
    await db.commit()
    _schedule_indexing(background_tasks, source.id)
    return SourceOut.model_validate(source)


@router.delete("/{source_id}", status_code=204)
async def delete_source(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    source = await db.get(Source, source_id)
    if not source or source.notebook_id != notebook_id:
        raise HTTPException(404, "Source not found")
    if source.file_path and os.path.exists(source.file_path):
        os.remove(source.file_path)
    await db.delete(source)  # cascades to chunks (Postgres + ORM)
    await db.commit()

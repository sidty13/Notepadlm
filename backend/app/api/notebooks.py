import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import Notebook, Source
from app.schemas.schemas import NotebookCreate, NotebookOut, NotebookUpdate

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


def _to_out(notebook: Notebook, source_count: int) -> NotebookOut:
    data = NotebookOut.model_validate(notebook).model_dump()
    data["source_count"] = source_count
    return NotebookOut(**data)


@router.get("", response_model=list[NotebookOut])
async def list_notebooks(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Notebook, func.count(Source.id).label("source_count"))
        .outerjoin(Source, Source.notebook_id == Notebook.id)
        .group_by(Notebook.id)
        .order_by(Notebook.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [_to_out(nb, cnt) for nb, cnt in rows]


@router.post("", response_model=NotebookOut, status_code=201)
async def create_notebook(payload: NotebookCreate, db: AsyncSession = Depends(get_db)):
    notebook = Notebook(name=payload.name.strip() or "Untitled notebook", description=payload.description)
    db.add(notebook)
    await db.commit()
    await db.refresh(notebook)
    return NotebookOut.model_validate(notebook)


@router.get("/{notebook_id}", response_model=NotebookOut)
async def get_notebook(notebook_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")
    count = (
        await db.execute(select(func.count(Source.id)).where(Source.notebook_id == notebook_id))
    ).scalar_one()
    return _to_out(notebook, count)


@router.patch("/{notebook_id}", response_model=NotebookOut)
async def update_notebook(notebook_id: uuid.UUID, payload: NotebookUpdate, db: AsyncSession = Depends(get_db)):
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")
    if payload.name is not None:
        notebook.name = payload.name.strip() or notebook.name
    if payload.description is not None:
        notebook.description = payload.description
    await db.commit()
    await db.refresh(notebook)
    return NotebookOut.model_validate(notebook)


@router.delete("/{notebook_id}", status_code=204)
async def delete_notebook(notebook_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")
    await db.delete(notebook)  # cascades to sources/chunks/messages
    await db.commit()
"""
Shared FastAPI dependencies for notebook-scoped routers.

Every route that takes a `notebook_id` path parameter should depend on
`get_owned_notebook` instead of fetching the notebook itself, so ownership
is enforced the same way everywhere (sources, chat, viewer, roadmap,
podcast, quiz, export) instead of being re-implemented -- and possibly
forgotten -- per router.
"""
import uuid

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clerk_auth import get_current_user_id
from app.core.db import get_db
from app.models.models import Notebook

__all__ = ["get_current_user_id", "get_owned_notebook"]


async def get_owned_notebook(
    notebook_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Notebook:
    notebook = await db.get(Notebook, notebook_id)
    # 404 (not 403) for someone else's notebook too, so we don't confirm
    # to an unauthorized caller that a given notebook id exists at all.
    if not notebook or notebook.owner_id != user_id:
        raise HTTPException(404, "Notebook not found")
    return notebook

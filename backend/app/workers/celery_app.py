"""
Celery app so ingestion runs asynchronously: the upload endpoint returns
immediately with status='uploading', and a worker process does
extract -> chunk -> embed in the background while the UI polls/streams
status updates.
"""
import asyncio

from celery import Celery

from app.core.config import settings
from app.core.db import engine
from app.services.indexing import run_indexing_pipeline

celery_app = Celery(
    "notebook_rag",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)
celery_app.conf.task_default_queue = "indexing"


async def _run_and_cleanup(source_id: str) -> None:
    try:
        await run_indexing_pipeline(source_id)
    finally:
        # The SQLAlchemy async engine (and its asyncpg connection pool) is a
        # module-level singleton shared by every task this worker process
        # runs, but each task gets its own event loop via asyncio.run()
        # below. Pooled connections stay bound to the loop that created
        # them; once that loop is destroyed at the end of this task, those
        # connections would be invalid for the next task's (new) loop.
        # Disposing here forces the pool to open fresh connections against
        # whichever loop is current next time -- avoiding "Future attached
        # to a different loop" / "Event loop is closed" errors on any task
        # after the first one in this worker process.
        await engine.dispose()


@celery_app.task(name="index_source")
def index_source_task(source_id: str) -> None:
    asyncio.run(_run_and_cleanup(source_id))
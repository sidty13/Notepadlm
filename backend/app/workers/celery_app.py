"""
Celery app so ingestion runs asynchronously: the upload endpoint returns
immediately with status='uploading', and a worker process does
extract -> chunk -> embed in the background while the UI polls/streams
status updates.
"""
import asyncio

from celery import Celery

from app.core.config import settings
from app.services.indexing import run_indexing_pipeline

celery_app = Celery(
    "notebook_rag",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)
celery_app.conf.task_default_queue = "indexing"


@celery_app.task(name="index_source")
def index_source_task(source_id: str) -> None:
    asyncio.run(run_indexing_pipeline(source_id))

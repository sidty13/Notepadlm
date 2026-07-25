import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.models import Role, SourceStatus, SourceType


# ---- Notebook ----
class NotebookCreate(BaseModel):
    name: str
    description: str | None = None


class NotebookUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class NotebookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    source_count: int = 0


# ---- Source ----
class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    notebook_id: uuid.UUID
    type: SourceType
    title: str
    status: SourceStatus
    status_detail: str | None
    origin: str
    meta: dict
    created_at: datetime


class WebsiteOrYoutubeSourceCreate(BaseModel):
    url: str
    title: str | None = None


# ---- Chunk / citation ----
class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: uuid.UUID
    content: str
    page: int | None
    timestamp_start: float | None
    timestamp_end: float | None
    section: str | None


class CitationOut(BaseModel):
    marker_index: int
    chunk: ChunkOut
    source: SourceOut


# ---- Chat ----
class ChatRequest(BaseModel):
    question: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    role: Role
    content: str
    created_at: datetime
    citations: list[CitationOut] = []


# ---- Bonus: roadmap ----
class RoadmapRequest(BaseModel):
    source_ids: list[uuid.UUID] | None = None  # defaults to all sources in notebook


# ---- Bonus: podcast ----
class PodcastRequest(BaseModel):
    source_ids: list[uuid.UUID] | None = None

# Notebook RAG — AI Research Assistant (Gemini NotebookLM-style)

Multi-source, multi-notebook RAG app: upload PDFs/text/websites/YouTube/VTT into
isolated notebooks, ask grounded questions, get streamed answers with inline
citations you can click to jump back to the exact page/timestamp/section.

## Status

**Backend: functionally complete for Day 1 + Day 2 of the build plan.**
Frontend: not yet built — see "What's left" below.

## Architecture

```
Next.js (frontend, not yet built) ──HTTP/SSE──> FastAPI (backend)
                                                     │
                        ┌────────────────────────────┼───────────────────────┐
                        │                             │                       │
                   Extractors                    Chunking               Retrieval
              (pdf/text/website/                 (token-aware,      (query rewrite ->
               youtube/vtt)                       overlap)           hybrid search ->
                        │                             │               RRF fusion ->
                        └──────────────┬──────────────┘               LLM rerank)
                                       │                                     │
                              PostgreSQL + pgvector                         │
                          (notebooks/sources/chunks/                        │
                           messages/citations)                              │
                                       │                                     │
                                Celery + Redis                      OpenAI GPT (generation,
                             (async ingestion)                    streamed, citations)
```

Every retrieval/storage query is scoped by `notebook_id` — there is no code
path that can leak chunks across notebooks.

### Ingestion pipeline (per source)
`uploading -> extracting -> chunking -> embedding -> ready` (or `failed`),
with status written to Postgres after every stage so the UI can poll and show
granular progress, not just a spinner.

### Retrieval pipeline (per question)
1. **Query rewrite** — follow-up questions ("what about the second one?") are
   turned into standalone queries using recent chat history (OpenAI GPT).
2. **Hybrid search** — pgvector cosine similarity + Postgres full-text search
   (BM25-ish), run in parallel.
3. **Reciprocal rank fusion** — merges the two ranked lists.
4. **LLM rerank** — the model reorders/picks the top candidates for precision.
5. **Grounded generation** — the model streams an answer over the final chunks,
   required to cite `[n]` for every claim; citations are parsed out of the
   streamed text and persisted against the exact chunks used.

### Citations -> source viewer
Every chunk carries the metadata needed to jump back to its origin:
- PDF: page number → opens the PDF at that page
- Website: section heading + text fragment → opens/preview + highlight
- YouTube: start timestamp → deep link with `&t=<seconds>`
- Text: paragraph → highlight
- VTT: cue timestamps → jump to that point in the transcript

## What's built

- `backend/app/models` — Notebook, Source, Chunk, Message, Citation (SQLAlchemy)
- `backend/app/extractors` — pdf, text, website, youtube, vtt
- `backend/app/chunking` — token-aware chunker with overlap
- `backend/app/embeddings` — OpenAI embeddings, batched
- `backend/app/retrieval` — hybrid search + RRF + rerank pipeline
- `backend/app/generation` — OpenAI GPT query rewrite, rerank, streaming answers
- `backend/app/services/indexing.py` — orchestrates the full ingestion pipeline
- `backend/app/workers` — Celery task wrapping the pipeline (with an inline
  FastAPI BackgroundTask fallback if Celery/Redis isn't reachable, so the app
  still works for quick local testing without standing up Redis)
- `backend/app/api` — notebooks (CRUD), sources (upload/website/youtube/reindex/
  delete/file), chat (SSE streaming + citation persistence), viewer (source
  click-through), roadmap (bonus 1), podcast (bonus 2)
- `backend/alembic` — initial migration: pgvector extension, all tables, ANN
  index, full-text GIN index
- `docker-compose.yml` — Postgres+pgvector, Redis, backend, Celery worker,
  frontend (frontend service will build once the Next.js app exists)

All backend files have been syntax-checked and the FastAPI app has been
imported end-to-end (24 routes wire up with no import errors).

## What's left

1. **Frontend (Next.js)** — sidebar/notebook management, source upload modal
   with live status indicators, streaming chat UI with clickable citations,
   source viewer panel (PDF page view, website preview, YouTube embed,
   text/transcript highlight), suggested-questions empty state, roadmap and
   podcast UI for the bonus features.
2. **Deployment** — pick a host (Render/Railway/Fly for backend+worker+Postgres,
   Vercel for frontend), wire env vars, verify pgvector is available on the
   chosen Postgres provider.
3. **Demo video** once the frontend exists.
4. Nice-to-haves if time allows: websocket instead of polling for source
   status, ffmpeg-based podcast concatenation instead of naive MP3 byte
   concatenation, dedicated cross-encoder reranker instead of LLM rerank.

## Running locally

### Option A — Docker (recommended)
```bash
cp backend/.env.example backend/.env
# edit backend/.env and fill in OPENAI_API_KEY
docker compose up --build
```
Backend will be at `http://localhost:8000` (docs at `/docs`), and will run
its own Alembic migration on startup.

### Option B — Manual (backend only, for now)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: point DATABASE_URL/SYNC_DATABASE_URL at a local Postgres with
# the pgvector extension available, and REDIS_URL at a local Redis
# (or skip Redis — uploads will fall back to an inline background task)
alembic upgrade head
uvicorn app.main:app --reload
```

## Environment variables

See `backend/.env.example` for the full list. The one you must set:
- `OPENAI_API_KEY` — used for everything: chat/generation (query rewriting,
  reranking, grounded streaming answers), embeddings, the bonus roadmap
  generation, and podcast script + text-to-speech generation.
  `OPENAI_CHAT_MODEL` defaults to `gpt-4o-mini`; bump it to `gpt-4o` in
  `.env` if you want stronger answers/reranking and don't mind the cost.

## Repo layout

```
backend/
  app/
    api/            FastAPI routers (notebooks, sources, chat, viewer, roadmap, podcast)
    core/            config + db session
    models/          SQLAlchemy models
    schemas/         Pydantic request/response models
    extractors/       one module per source type
    chunking/        token-aware chunker
    embeddings/      embedding client
    retrieval/       hybrid search + fusion + rerank pipeline
    generation/       OpenAI GPT client (rewrite, rerank, streaming answers)
    services/        ingestion orchestration
    workers/         Celery app + task
  alembic/            migrations
  requirements.txt
  Dockerfile
frontend/             (to be built)
docker-compose.yml
```

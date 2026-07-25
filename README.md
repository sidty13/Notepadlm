# Notebook RAG — AI Research Assistant (Gemini NotebookLM-style)

Multi-source, multi-notebook RAG app: upload PDFs/text/websites/YouTube/VTT into
isolated notebooks, ask grounded questions, get streamed answers with inline
citations you can click to jump back to the exact page/timestamp/section.

## Status

**Backend and frontend both functionally complete.** See "What's left" below
for polish items and deployment.

## Architecture

```
Next.js (frontend) ──HTTP/SSE──> FastAPI (backend)
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
  frontend (Next.js, multi-stage Docker build)

All backend files have been syntax-checked and the FastAPI app has been
imported end-to-end (24 routes wire up with no import errors).

- `frontend/` — Next.js 16 (App Router, React 19, Tailwind v4, TypeScript):
  - Notebook library (`/`) and a three-panel workspace (`/notebook/[id]`):
    sources list, streaming chat, and a slide-in source viewer
  - Source upload (file drag/drop, website URL, YouTube URL) with live
    status polling while a source is extracting/chunking/embedding
  - Streaming chat over SSE with inline citation markers; clicking one opens
    the exact page (PDF), timestamp (YouTube/VTT), or section (website) in
    the viewer drawer
  - Roadmap and podcast bonus features as modals, calling the corresponding
    backend endpoints
  - Verified with `tsc --noEmit`, `next build`, and `eslint` (all clean)

## What's left

1. **Deployment** — pick a host (Render/Railway/Fly for backend+worker+Postgres,
   Vercel or the included Dockerfile for the frontend), wire env vars, verify
   pgvector is available on the chosen Postgres provider.
2. **Demo video.**
3. Nice-to-haves if time allows: websocket instead of polling for source
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
its own Alembic migration on startup. Frontend will be at
`http://localhost:3000`.

Note: `NEXT_PUBLIC_API_URL` is inlined into the frontend's JS bundle at
**build** time (Next.js behavior for `NEXT_PUBLIC_*` vars), not read at
container start. If you need the frontend to reach the backend at a
different URL, edit the `args:` under the `frontend` service in
`docker-compose.yml` and rebuild with `docker compose up --build frontend`.

### Option B — Manual

**Backend:**
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

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open `http://localhost:3000`.

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
frontend/
  src/
    app/              routes: library (`/`) and workspace (`/notebook/[id]`)
    components/       SourcesPanel, ChatPanel, SourceViewerDrawer, modals, etc.
    lib/               api client, shared types, formatting helpers
  Dockerfile
docker-compose.yml
```

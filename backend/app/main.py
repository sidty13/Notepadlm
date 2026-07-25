from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, notebooks, podcast, roadmap, sources, viewer
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notebooks.router, prefix=settings.API_PREFIX)
app.include_router(sources.router, prefix=settings.API_PREFIX)
app.include_router(chat.router, prefix=settings.API_PREFIX)
app.include_router(viewer.router, prefix=settings.API_PREFIX)
app.include_router(roadmap.router, prefix=settings.API_PREFIX)
app.include_router(podcast.router, prefix=settings.API_PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

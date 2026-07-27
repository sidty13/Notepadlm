import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, export, notebooks, podcast, quiz, roadmap, sources, viewer
from app.core.config import settings

logger = logging.getLogger("notebook_rag")

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,"https://marginal-phi.vercel.app/"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Starlette's default error path can bypass CORSMiddleware on unhandled
    # exceptions, which the browser then misreports as a CORS error instead
    # of showing the real 500. This handler logs the actual traceback and
    # still returns a JSON response through the normal middleware stack, so
    # devtools shows the true status/body instead of a CORS message.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(notebooks.router, prefix=settings.API_PREFIX)
app.include_router(sources.router, prefix=settings.API_PREFIX)
app.include_router(chat.router, prefix=settings.API_PREFIX)
app.include_router(viewer.router, prefix=settings.API_PREFIX)
app.include_router(roadmap.router, prefix=settings.API_PREFIX)
app.include_router(podcast.router, prefix=settings.API_PREFIX)
app.include_router(quiz.router, prefix=settings.API_PREFIX)
app.include_router(export.router, prefix=settings.API_PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

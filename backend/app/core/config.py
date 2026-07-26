"""
Central application configuration.

All values are loaded from environment variables (see .env.example).
Nothing here should be hard-coded per-deployment.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "Notebook RAG"
    ENV: str = "development"
    API_PREFIX: str = "/api"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/notebook_rag"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/notebook_rag"

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # --- Storage ---
    UPLOAD_DIR: str = "./storage/uploads"

    # --- LLM / Embeddings ---
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536

    # --- Chunking ---
    CHUNK_SIZE_TOKENS: int = 500
    CHUNK_OVERLAP_TOKENS: int = 75

    # --- Retrieval ---
    TOP_K_VECTOR: int = 20
    TOP_K_BM25: int = 20
    TOP_K_FINAL: int = 6
    USE_RERANKER: bool = True

    # --- TTS (bonus: podcast) ---
    OPENAI_TTS_VOICE_HOST_A: str = "alloy"
    OPENAI_TTS_VOICE_HOST_B: str = "echo"

    # --- Auth (Clerk) ---
    # The Frontend API URL for your Clerk app, e.g. "https://your-app.clerk.accounts.dev"
    # (Clerk Dashboard -> Configure -> API Keys -> "Frontend API URL"), or your
    # production Clerk domain once you've set one up. Used to fetch Clerk's JWKS
    # and verify session tokens; leave unset and every request will be rejected.
    CLERK_ISSUER: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
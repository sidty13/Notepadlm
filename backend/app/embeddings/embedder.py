"""
Thin wrapper around the OpenAI embeddings endpoint, batched for
efficiency and retried on transient failures.
"""
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

_BATCH_SIZE = 96


@retry(wait=wait_exponential(multiplier=1, min=2, max=20), stop=stop_after_attempt(4))
async def _embed_batch(texts: list[str]) -> list[list[float]]:
    if _client is None:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/.env to enable embeddings."
        )
    resp = await _client.embeddings.create(model=settings.EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in resp.data]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds a list of strings, batching requests to stay under API limits."""
    out: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        out.extend(await _embed_batch(batch))
    return out


async def embed_query(text: str) -> list[float]:
    return (await _embed_batch([text]))[0]

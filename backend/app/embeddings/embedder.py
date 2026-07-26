"""
Thin wrapper around the OpenAI embeddings endpoint, batched for
efficiency and retried on transient failures.
"""
import asyncio

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

_BATCH_SIZE = 96
# Cap concurrent in-flight batches so a very long source (e.g. a multi-hour
# video with hundreds of chunks) doesn't fire off dozens of simultaneous
# requests and trip OpenAI's rate limits.
_MAX_CONCURRENT_BATCHES = 5


@retry(wait=wait_exponential(multiplier=1, min=2, max=20), stop=stop_after_attempt(4))
async def _embed_batch(texts: list[str]) -> list[list[float]]:
    if _client is None:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/.env to enable embeddings."
        )
    resp = await _client.embeddings.create(model=settings.EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in resp.data]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds a list of strings, batching requests to stay under API limits
    and running batches concurrently (bounded) instead of one at a time --
    this is the main lever for cutting ingestion time on long sources."""
    batches = [texts[i : i + _BATCH_SIZE] for i in range(0, len(texts), _BATCH_SIZE)]
    if not batches:
        return []

    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_BATCHES)

    async def _bounded(batch: list[str]) -> list[list[float]]:
        async with semaphore:
            return await _embed_batch(batch)

    results = await asyncio.gather(*(_bounded(b) for b in batches))
    out: list[list[float]] = []
    for r in results:
        out.extend(r)
    return out


async def embed_query(text: str) -> list[float]:
    return (await _embed_batch([text]))[0]
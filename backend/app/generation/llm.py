"""
All LLM calls live here: query rewriting, reranking, and the final
grounded, streaming answer generation.

Uses OpenAI's chat completions API (gpt-4o-mini by default) since the
app already requires an OpenAI key for embeddings — no separate
Anthropic key needed. Swap OPENAI_CHAT_MODEL in .env if you want a
stronger/cheaper model.
"""
import json
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.core.config import settings

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


def _require_client() -> AsyncOpenAI:
    if _client is None:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/.env to enable the LLM."
        )
    return _client


def get_client() -> AsyncOpenAI:
    """Public accessor used by other modules (roadmap, podcast) that need
    direct access to the chat model client."""
    return _require_client()


async def rewrite_query(question: str, history: list[dict]) -> str:
    """Condenses chat history + a follow-up question into one standalone
    query, e.g. 'what about the second one?' -> 'What does source 2 say
    about transformer attention?'"""
    client = _require_client()
    history_text = "\n".join(f"{h['role']}: {h['content']}" for h in history[-6:])
    resp = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": (
                    "Rewrite the final user question as a standalone search query, "
                    "resolving pronouns and references using the conversation below. "
                    "Return ONLY the rewritten query, nothing else.\n\n"
                    f"Conversation:\n{history_text}\n\nFinal question: {question}"
                ),
            }
        ],
    )
    return resp.choices[0].message.content.strip()


async def rerank_chunks(query: str, chunks: list, top_n: int) -> list:
    """LLM-based reranker: asks the model to pick and order the most
    relevant chunk ids for the query. Cheaper/simpler than standing up a
    dedicated cross-encoder, while still meaningfully improving precision
    over raw hybrid-search order."""
    client = _require_client()
    numbered = "\n\n".join(f"[{i}] {c.content[:600]}" for i, c in enumerate(chunks))
    resp = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=100,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Query: {query}\n\nCandidate passages:\n{numbered}\n\n"
                    f"Return ONLY a JSON array of the {top_n} most relevant passage "
                    "indices, most relevant first. Example: [3, 0, 7]"
                ),
            }
        ],
    )
    try:
        raw = resp.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        indices = json.loads(raw)
        return [chunks[i] for i in indices if 0 <= i < len(chunks)][:top_n]
    except (json.JSONDecodeError, IndexError, ValueError):
        return chunks[:top_n]


def _build_context_block(retrieved: list) -> str:
    parts = []
    for i, r in enumerate(retrieved, start=1):
        loc = _describe_location(r)
        parts.append(f"[{i}] (Source: {r.source.title}, {loc})\n{r.chunk.content}")
    return "\n\n---\n\n".join(parts)


def _describe_location(r) -> str:
    c = r.chunk
    if c.page is not None:
        return f"page {c.page}"
    if c.timestamp_start is not None:
        m, s = divmod(int(c.timestamp_start), 60)
        return f"{m}:{s:02d}"
    if c.section:
        return f"section '{c.section}'"
    return "excerpt"


SYSTEM_PROMPT = """You are a research assistant answering questions using ONLY the provided
source excerpts. Rules:
1. Ground every factual claim in the numbered excerpts below, and cite the excerpt
   number immediately after the claim like this: [1]. Use multiple citations if a
   claim draws on multiple excerpts, e.g. [1][3].
2. If the excerpts don't contain the answer, say so plainly instead of guessing.
3. Never invent a citation number that isn't in the excerpt list.
4. Write in clear, well-formatted markdown (short paragraphs, bullet points where useful).
5. Do not repeat the excerpts verbatim at length; synthesize in your own words.
"""


async def stream_answer(
    question: str, history: list[dict], retrieved: list
) -> AsyncIterator[str]:
    client = _require_client()
    context = _build_context_block(retrieved)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend({"role": h["role"], "content": h["content"]} for h in history[-8:])
    messages.append(
        {
            "role": "user",
            "content": f"Source excerpts:\n\n{context}\n\nQuestion: {question}",
        }
    )

    stream = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        max_tokens=1500,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta
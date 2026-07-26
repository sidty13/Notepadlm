"""
Token-aware chunker with overlap.

Strategy: extractors already split content into natural units (a PDF
page, a website section, a 30s transcript window). Here we further
split/merge those units into ~CHUNK_SIZE_TOKENS pieces with
CHUNK_OVERLAP_TOKENS of overlap, so:
  - very long units (a dense PDF page) get split into multiple chunks
  - very short units (a single transcript cue) get merged with
    neighbours to avoid embedding tiny, low-signal chunks
while always preserving the citation metadata (page/timestamp/section)
of whichever unit(s) contributed the text.
"""
from dataclasses import dataclass

import tiktoken

from app.core.config import settings
from app.extractors.base import ExtractedUnit

_enc = None


def _get_encoder():
    # Loaded lazily (rather than at import time) so app startup never
    # depends on tiktoken's BPE file being fetchable over the network;
    # the fetch cost is only paid the first time chunking actually runs.
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


@dataclass
class PreparedChunk:
    text: str
    chunk_index: int
    page: int | None = None
    timestamp_start: float | None = None
    timestamp_end: float | None = None
    section: str | None = None


def _n_tokens(text: str) -> int:
    return len(_get_encoder().encode(text))


def chunk_units(units: list[ExtractedUnit]) -> list[PreparedChunk]:
    enc = _get_encoder()
    chunks: list[PreparedChunk] = []
    idx = 0

    buffer_text = ""
    buffer_tokens = 0
    buffer_meta: ExtractedUnit | None = None

    def flush():
        nonlocal buffer_text, buffer_tokens, buffer_meta, idx
        if buffer_text.strip():
            chunks.append(
                PreparedChunk(
                    text=buffer_text.strip(),
                    chunk_index=idx,
                    page=buffer_meta.page if buffer_meta else None,
                    timestamp_start=buffer_meta.timestamp_start if buffer_meta else None,
                    timestamp_end=buffer_meta.timestamp_end if buffer_meta else None,
                    section=buffer_meta.section if buffer_meta else None,
                )
            )
            idx += 1
        buffer_text, buffer_tokens, buffer_meta = "", 0, None

    for unit in units:
        tokens = enc.encode(unit.text)

        # Unit fits comfortably inside remaining budget -> merge into buffer.
        if buffer_tokens + len(tokens) <= settings.CHUNK_SIZE_TOKENS:
            if not buffer_text:
                buffer_meta = unit
            buffer_text += ("\n\n" if buffer_text else "") + unit.text
            buffer_tokens += len(tokens)
            continue

        # Unit doesn't fit -> flush what we have, then split the unit itself
        # if it alone exceeds the chunk size.
        flush()
        if len(tokens) <= settings.CHUNK_SIZE_TOKENS:
            buffer_text, buffer_tokens, buffer_meta = unit.text, len(tokens), unit
            continue

        step = settings.CHUNK_SIZE_TOKENS - settings.CHUNK_OVERLAP_TOKENS
        for start in range(0, len(tokens), step):
            piece_tokens = tokens[start : start + settings.CHUNK_SIZE_TOKENS]
            piece_text = enc.decode(piece_tokens)
            chunks.append(
                PreparedChunk(
                    text=piece_text.strip(),
                    chunk_index=idx,
                    page=unit.page,
                    timestamp_start=unit.timestamp_start,
                    timestamp_end=unit.timestamp_end,
                    section=unit.section,
                )
            )
            idx += 1
            if start + settings.CHUNK_SIZE_TOKENS >= len(tokens):
                break

    flush()
    return chunks
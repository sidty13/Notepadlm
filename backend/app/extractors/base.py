"""
Every extractor turns a raw source (file path or URL) into a list of
ExtractedUnit — a page/section/segment of text plus the metadata needed
for citations later. Chunking happens downstream in app/chunking, so
extractors should NOT do token-level splitting themselves; they just
produce the natural units of the source (a PDF page, an HTML section,
a transcript cue).
"""
from dataclasses import dataclass, field


@dataclass
class ExtractedUnit:
    text: str
    page: int | None = None
    timestamp_start: float | None = None
    timestamp_end: float | None = None
    section: str | None = None
    meta: dict = field(default_factory=dict)


class BaseExtractor:
    async def extract(self, source) -> list[ExtractedUnit]:
        raise NotImplementedError
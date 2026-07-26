import webvtt

from app.extractors.base import BaseExtractor, ExtractedUnit


def _to_seconds(ts: str) -> float:
    # webvtt timestamps look like "00:01:23.456"
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


class VttExtractor(BaseExtractor):
    """One ExtractedUnit per cue -> exact 'jump to chunk' + highlight."""

    async def extract(self, source) -> list[ExtractedUnit]:
        units: list[ExtractedUnit] = []
        for caption in webvtt.read(source.file_path):
            text = caption.text.strip()
            if not text:
                continue
            units.append(
                ExtractedUnit(
                    text=text,
                    timestamp_start=_to_seconds(caption.start),
                    timestamp_end=_to_seconds(caption.end),
                )
            )
        return units
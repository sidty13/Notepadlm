from app.extractors.base import BaseExtractor, ExtractedUnit


class TextExtractor(BaseExtractor):
    """
    Splits on blank lines into paragraph-ish units. Character offsets are
    recorded so the source viewer can highlight the exact span later.
    """

    async def extract(self, source) -> list[ExtractedUnit]:
        with open(source.file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()

        units: list[ExtractedUnit] = []
        offset = 0
        for para in raw.split("\n\n"):
            stripped = para.strip()
            start = raw.find(para, offset)
            if stripped:
                units.append(
                    ExtractedUnit(
                        text=stripped,
                        meta={"char_start": start, "char_end": start + len(para)},
                    )
                )
            offset = start + len(para)
        return units
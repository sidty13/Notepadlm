from pypdf import PdfReader

from app.extractors.base import BaseExtractor, ExtractedUnit


class PdfExtractor(BaseExtractor):
    """One ExtractedUnit per PDF page -> powers 'open PDF at page N'."""

    async def extract(self, source) -> list[ExtractedUnit]:
        reader = PdfReader(source.file_path)
        units: list[ExtractedUnit] = []
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            units.append(ExtractedUnit(text=text, page=i + 1, meta={"page_count": len(reader.pages)}))
        return units
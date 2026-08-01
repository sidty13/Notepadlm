from pypdf import PdfReader
import os


from app.extractors.base import BaseExtractor, ExtractedUnit


class PdfExtractor(BaseExtractor):
    """One ExtractedUnit per PDF page -> powers 'open PDF at page N'."""

    async def extract(self, source) -> list[ExtractedUnit]:
        if not source.file_path or not os.path.exists(source.file_path):
            raise FileNotFoundError(f"PDF file not found: {source.file_path}")

        reader = PdfReader(source.file_path)
        units: list[ExtractedUnit] = []
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            units.append(ExtractedUnit(text=text, page=i + 1, meta={"page_count": len(reader.pages)}))
        return units

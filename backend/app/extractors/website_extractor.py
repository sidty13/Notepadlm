import httpx
from bs4 import BeautifulSoup

from app.extractors.base import BaseExtractor, ExtractedUnit

# Tags that carry no useful reading content.
_STRIP_TAGS = ["script", "style", "nav", "footer", "header", "form", "noscript", "svg"]


class WebsiteExtractor(BaseExtractor):
    """
    One ExtractedUnit per heading-delimited section of the page, so
    citations can say "Section: Introduction" and the viewer can
    highlight that section's text specifically.
    """

    async def extract(self, source) -> list[ExtractedUnit]:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(source.origin, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(_STRIP_TAGS):
            tag.decompose()

        body = soup.body or soup
        units: list[ExtractedUnit] = []
        current_section = "Introduction"
        buffer: list[str] = []

        def flush():
            text = "\n".join(buffer).strip()
            if text:
                units.append(ExtractedUnit(text=text, section=current_section))
            buffer.clear()

        for el in body.find_all(["h1", "h2", "h3", "p", "li"]):
            if el.name in ("h1", "h2", "h3"):
                flush()
                current_section = el.get_text(strip=True) or current_section
            else:
                txt = el.get_text(" ", strip=True)
                if txt:
                    buffer.append(txt)
        flush()

        if not units:
            # Fallback: whole page as one unit.
            text = body.get_text(" ", strip=True)
            if text:
                units.append(ExtractedUnit(text=text, section="Page"))

        return units

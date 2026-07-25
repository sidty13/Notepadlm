from app.extractors.base import BaseExtractor
from app.extractors.pdf_extractor import PdfExtractor
from app.extractors.text_extractor import TextExtractor
from app.extractors.vtt_extractor import VttExtractor
from app.extractors.website_extractor import WebsiteExtractor
from app.extractors.youtube_extractor import YoutubeExtractor
from app.models.models import SourceType

_REGISTRY: dict[SourceType, BaseExtractor] = {
    SourceType.pdf: PdfExtractor(),
    SourceType.text: TextExtractor(),
    SourceType.website: WebsiteExtractor(),
    SourceType.youtube: YoutubeExtractor(),
    SourceType.vtt: VttExtractor(),
}


def get_extractor(source_type: SourceType) -> BaseExtractor:
    return _REGISTRY[source_type]

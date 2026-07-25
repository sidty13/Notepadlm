import re

from youtube_transcript_api import YouTubeTranscriptApi

from app.extractors.base import BaseExtractor, ExtractedUnit

_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{11})"
)


def extract_video_id(url_or_id: str) -> str:
    if len(url_or_id) == 11 and "/" not in url_or_id:
        return url_or_id
    m = _ID_RE.search(url_or_id)
    if not m:
        raise ValueError(f"Could not parse a YouTube video id from: {url_or_id}")
    return m.group(1)


class YoutubeExtractor(BaseExtractor):
    """
    Groups raw transcript cues into ~30s windows so each unit carries a
    start/end timestamp -> powers 'jump to 5:21' citations and deep links
    with &t=321.
    """

    WINDOW_SECONDS = 30

    async def extract(self, source) -> list[ExtractedUnit]:
        video_id = extract_video_id(source.origin)
        transcript = YouTubeTranscriptApi.get_transcript(video_id)

        units: list[ExtractedUnit] = []
        window_text: list[str] = []
        window_start = None

        for cue in transcript:
            if window_start is None:
                window_start = cue["start"]
            window_text.append(cue["text"])
            elapsed = cue["start"] - window_start
            if elapsed >= self.WINDOW_SECONDS:
                units.append(
                    ExtractedUnit(
                        text=" ".join(window_text).strip(),
                        timestamp_start=window_start,
                        timestamp_end=cue["start"] + cue.get("duration", 0),
                        meta={"video_id": video_id},
                    )
                )
                window_text, window_start = [], None

        if window_text:
            last = transcript[-1]
            units.append(
                ExtractedUnit(
                    text=" ".join(window_text).strip(),
                    timestamp_start=window_start,
                    timestamp_end=last["start"] + last.get("duration", 0),
                    meta={"video_id": video_id},
                )
            )
        return units

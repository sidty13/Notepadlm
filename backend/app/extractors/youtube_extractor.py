import asyncio
import re
import xml.etree.ElementTree as ElementTree
from youtube_transcript_api.proxies import WebshareProxyConfig
from app.core.config import settings

from youtube_transcript_api import (
    IpBlocked,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeTranscriptApi,
)

from app.extractors.base import BaseExtractor, ExtractedUnit

_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{11})"
)

# youtube_transcript_api makes a blocking network call; cap how long we'll
# wait so a throttled/blocked request (common from cloud/datacenter IPs)
# fails fast with a clear status instead of leaving the source stuck in
# "extracting" indefinitely.
_TRANSCRIPT_TIMEOUT_SECONDS = 45

_BLOCKED_MESSAGE = (
    "YouTube blocked this transcript request. This happens when YouTube "
    "flags the server's IP address (common for cloud/VPS/datacenter hosts, "
    "and increasingly for some home connections too) -- it's not specific "
    "to this video or a bug in the app. Retrying later sometimes works; a "
    "more reliable fix is routing requests through a proxy (the "
    "youtube-transcript-api README covers this), or -- easiest -- download "
    "the video's subtitles yourself and upload them here as a .vtt file "
    "instead of a YouTube link."
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

       def _fetch() -> list[dict]:
            if settings.WEBSHARE_PROXY_USERNAME and settings.WEBSHARE_PROXY_PASSWORD:
                api = YouTubeTranscriptApi(
                    proxy_config=WebshareProxyConfig(
                        proxy_username=settings.WEBSHARE_PROXY_USERNAME,
                        proxy_password=settings.WEBSHARE_PROXY_PASSWORD,
                    )
                )
            else:
                api = YouTubeTranscriptApi()
            return api.fetch(video_id).to_raw_data()

        try:
            transcript = await asyncio.wait_for(
                asyncio.to_thread(_fetch),
                timeout=_TRANSCRIPT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as e:
            raise RuntimeError(
                f"Timed out fetching the transcript after {_TRANSCRIPT_TIMEOUT_SECONDS}s. "
                + _BLOCKED_MESSAGE
            ) from e
        except (IpBlocked, RequestBlocked, ElementTree.ParseError) as e:
            # Older library versions (and occasionally the new one) surface
            # blocking as a raw XML parse error on an empty response body
            # rather than a typed exception -- treat both the same way.
            raise RuntimeError(_BLOCKED_MESSAGE) from e
        except TranscriptsDisabled as e:
            raise RuntimeError(
                "This video has captions/transcripts disabled by the uploader, "
                "so there's nothing to fetch. Try a different video, or upload "
                "a .vtt file if you have the subtitles some other way."
            ) from e
        except NoTranscriptFound as e:
            raise RuntimeError(
                "No English transcript is available for this video (it may only "
                "have captions in another language). Upload a .vtt file instead "
                "if you have a transcript in another language or format."
            ) from e
        except VideoUnavailable as e:
            raise RuntimeError(
                "This video is unavailable (private, deleted, or region-locked)."
            ) from e

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

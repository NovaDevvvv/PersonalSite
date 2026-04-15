from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError


DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=pdrGJjFAw2"
FALLBACK_VIDEO_URL = "https://www.youtube.com/watch?v=vObY1I1C2Y4"
YOUTUBE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")


def format_duration(seconds: int | None) -> str:
    if seconds is None:
        return "Unknown"

    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02}:{seconds:02}"
    return f"{minutes}:{seconds:02}"


def extract_video_id(video_url: str) -> str | None:
    if YOUTUBE_ID_PATTERN.fullmatch(video_url):
        return video_url

    parsed = urlparse(video_url)
    if parsed.netloc.endswith("youtu.be"):
        candidate = parsed.path.strip("/")
        return candidate if YOUTUBE_ID_PATTERN.fullmatch(candidate) else None

    if parsed.path == "/watch":
        candidate = parse_qs(parsed.query).get("v", [None])[0]
        return candidate if candidate and YOUTUBE_ID_PATTERN.fullmatch(candidate) else None

    return None


def normalize_video_url(video_url: str) -> tuple[str, bool]:
    video_id = extract_video_id(video_url)
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}", False
    return FALLBACK_VIDEO_URL, True


def build_download_filename(title: str, uploader: str, extension: str = "mp4") -> str:
    def sanitize(value: str) -> str:
        sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip()
        return sanitized or "Unknown"

    normalized_extension = extension.lower().strip(".") or "mp4"
    return f"{sanitize(title)} - {sanitize(uploader)}.{normalized_extension}"


def fetch_video_info(video_url: str) -> dict[str, str]:
    normalized_url, used_fallback = normalize_video_url(video_url)
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "extract_flat": False,
    }

    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(normalized_url, download=False)

    if not info:
        raise DownloadError("No metadata returned by yt-dlp")

    return {
        "title": info.get("title") or "Unknown",
        "length": format_duration(info.get("duration")),
        "uploader": info.get("uploader") or info.get("channel") or "Unknown",
        "videoUrl": normalized_url,
        "usedFallback": used_fallback,
    }
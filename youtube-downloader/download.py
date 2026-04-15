from __future__ import annotations

import os
import re
import tempfile
import threading
import uuid
from dataclasses import dataclass
from hashlib import sha256

import yt_dlp
from yt_dlp.utils import DownloadError

downloadInstances: list[dict[str, str]] = []
downloadJobs: dict[str, dict] = {}
downloadJobsLock = threading.Lock()


# =========================
# Data Models
# =========================

@dataclass(frozen=True)
class DownloadRequest:
    url: str
    title: str
    uploader: str
    output_format: str  # mp4, mp3, etc
    audio_codec: str
    video_codec: str
    quality: str


@dataclass(frozen=True)
class DownloadResult:
    content: bytes
    filename: str
    mimetype: str
    integrity_sha256: str
    backend: str


# =========================
# Helpers
# =========================

def _sanitize_filename(value: str) -> str:
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', value).strip()
    return sanitized or 'Unknown'


def _build_download_filename(request: DownloadRequest) -> str:
    ext = request.output_format.lower().strip('.') or 'bin'
    title = _sanitize_filename(request.title)
    uploader = _sanitize_filename(request.uploader)
    return f'{title} - {uploader}.{ext}'


def _guess_mimetype(ext: str) -> str:
    return {
        "flac": "audio/flac",
        "m4a": "audio/mp4",
        "mkv": "video/x-matroska",
        "mp4": "video/mp4",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "webm": "video/webm",
    }.get(ext.lower(), "application/octet-stream")


def _build_format_selector(request: DownloadRequest) -> str:
    """
    Build a resilient yt-dlp format selector based on request.
    Avoids 'Requested format not available' errors.
    """

    fmt = request.output_format.lower()

    if fmt in ["mp3", "m4a", "wav", "flac"]:
        return "bestaudio/best"

    if fmt == "mp4":
        return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]"

    if fmt == "webm":
        return "bv*[ext=webm]+ba[ext=webm]/b[ext=webm]"

    if fmt == "mkv":
        return "bv*+ba/b"

    # fallback (safe default)
    return "bv*+ba/b"


def _find_instance(job_id: str) -> dict | None:
    with downloadJobsLock:
        return downloadJobs.get(job_id)


def _update_instance(job_id: str, **changes) -> None:
    with downloadJobsLock:
        instance = downloadJobs.get(job_id)
        if instance is not None:
            instance.update(changes)


# =========================
# Main Download Function
# =========================

def download(request: DownloadRequest) -> DownloadResult:
    job_id = uuid.uuid4().hex
    instance = {
        'id': job_id,
        'url': request.url,
        'filename': '',
        'backend': 'yt-dlp',
        'progress': '0%',
        'integrity': '',
        'status': 'downloading',
        'error': None,
        'result': None,
    }
    with downloadJobsLock:
        downloadInstances.append(instance)
        downloadJobs[job_id] = instance

    def progress_hook(d):
        if d['status'] == 'downloading':
            instance['progress'] = d.get('_percent_str', '0%').strip()
        elif d['status'] == 'finished':
            instance['progress'] = '100%'

    filename = _build_download_filename(request)

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            outtmpl = os.path.join(tmpdir, '%(title)s.%(ext)s')

            ydl_opts = {
                'format': _build_format_selector(request),
                'outtmpl': outtmpl,
                'progress_hooks': [progress_hook],
                'quiet': True,

                # REQUIRED for modern YouTube
                'js_runtimes': {'node': {}},

                # improves compatibility
                'noplaylist': True,
                'merge_output_format': request.output_format,
            }

            # Audio conversion
            if request.output_format in ['mp3', 'm4a', 'wav', 'flac']:
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': request.output_format,
                    'preferredquality': '192',
                }]

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(request.url, download=True)

                downloaded_path = ydl.prepare_filename(info)

                # Fix extension after postprocessing
                base, _ = os.path.splitext(downloaded_path)
                final_path = f"{base}.{request.output_format}"

                if not os.path.exists(final_path):
                    final_path = downloaded_path  # fallback

            with open(final_path, 'rb') as f:
                content = f.read()

    except DownloadError as e:
        instance['status'] = 'error'
        instance['progress'] = '0%'
        raise RuntimeError(f"yt-dlp failed: {str(e)}")

    except Exception as e:
        instance['status'] = 'error'
        raise RuntimeError(f"Unexpected failure: {str(e)}")

    integrity_sha256 = sha256(content).hexdigest()

    instance.update({
        'filename': filename,
        'integrity': integrity_sha256,
        'progress': '100%',
        'status': 'complete',
    })

    result = DownloadResult(
        content=content,
        filename=filename,
        mimetype=_guess_mimetype(request.output_format),
        integrity_sha256=integrity_sha256,
        backend='yt-dlp',
    )
    instance['result'] = result
    return result


def start_download_job(request: DownloadRequest) -> str:
    job_id = uuid.uuid4().hex
    instance = {
        'id': job_id,
        'url': request.url,
        'filename': '',
        'backend': 'yt-dlp',
        'progress': '0%',
        'integrity': '',
        'status': 'queued',
        'error': None,
        'result': None,
    }

    with downloadJobsLock:
        downloadInstances.append(instance)
        downloadJobs[job_id] = instance

    def run_job():
        _update_instance(job_id, status='downloading')

        def progress_hook(d):
            if d['status'] == 'downloading':
                _update_instance(job_id, progress=d.get('_percent_str', '0%').strip())
            elif d['status'] == 'finished':
                _update_instance(job_id, progress='100%')

        filename = _build_download_filename(request)

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                outtmpl = os.path.join(tmpdir, '%(title)s.%(ext)s')

                ydl_opts = {
                    'format': _build_format_selector(request),
                    'outtmpl': outtmpl,
                    'progress_hooks': [progress_hook],
                    'quiet': True,
                    'js_runtimes': {'node': {}},
                    'noplaylist': True,
                    'merge_output_format': request.output_format,
                }

                if request.output_format in ['mp3', 'm4a', 'wav']:
                    ydl_opts['postprocessors'] = [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': request.output_format,
                        'preferredquality': '192',
                    }]

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(request.url, download=True)

                    downloaded_path = ydl.prepare_filename(info)
                    base, _ = os.path.splitext(downloaded_path)
                    final_path = f"{base}.{request.output_format}"

                    if not os.path.exists(final_path):
                        final_path = downloaded_path

                with open(final_path, 'rb') as f:
                    content = f.read()

            integrity_sha256 = sha256(content).hexdigest()
            result = DownloadResult(
                content=content,
                filename=filename,
                mimetype=_guess_mimetype(request.output_format),
                integrity_sha256=integrity_sha256,
                backend='yt-dlp',
            )
            _update_instance(
                job_id,
                filename=filename,
                integrity=integrity_sha256,
                progress='100%',
                status='complete',
                result=result,
            )
        except DownloadError as exc:
            _update_instance(job_id, status='error', progress='0%', error=f'yt-dlp failed: {str(exc)}')
        except Exception as exc:
            _update_instance(job_id, status='error', error=f'Unexpected failure: {str(exc)}')

    threading.Thread(target=run_job, daemon=True).start()
    return job_id


def get_download_status(job_id: str) -> dict | None:
    instance = _find_instance(job_id)
    if instance is None:
        return None

    return {
        'id': instance['id'],
        'url': instance['url'],
        'filename': instance['filename'],
        'backend': instance['backend'],
        'progress': instance['progress'],
        'integrity': instance['integrity'],
        'status': instance['status'],
        'error': instance['error'],
    }


def get_download_result(job_id: str) -> DownloadResult | None:
    instance = _find_instance(job_id)
    if instance is None:
        return None
    return instance['result']
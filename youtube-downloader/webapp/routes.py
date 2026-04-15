from __future__ import annotations

from io import BytesIO

import download as download_service
from flask import Blueprint, current_app, request, send_file, send_from_directory
from yt_dlp.utils import DownloadError

from .services.video_info import DEFAULT_VIDEO_URL, fetch_video_info
from .utils.http import no_cache_json


site_blueprint = Blueprint("site", __name__)


@site_blueprint.get("/")
def index():
    return send_from_directory(current_app.config["APP_ROOT"], "index.html")


@site_blueprint.get("/watch")
def watch():
    return send_from_directory(current_app.config["APP_ROOT"], "index.html")


@site_blueprint.get("/api/runtime-config")
def runtime_config():
    return no_cache_json({"spiralSettings": current_app.config["SPIRAL_SETTINGS"]})


@site_blueprint.get("/api/video-info")
def video_info():
    video_url = request.args.get("url", DEFAULT_VIDEO_URL)

    try:
        payload = fetch_video_info(video_url)
    except DownloadError as exc:
        return no_cache_json({"error": str(exc)}, 502)
    except Exception as exc:  # pragma: no cover
        return no_cache_json({"error": f"Unexpected error: {exc}"}, 500)

    return no_cache_json(payload)


@site_blueprint.get("/api/fake-download")
def fake_download():
    video_url = request.args.get("url", DEFAULT_VIDEO_URL)
    output_format = request.args.get("format", "mp4").lower()
    audio_codec = request.args.get("audioCodec", "aac")
    video_codec = request.args.get("videoCodec", "h264")
    quality = request.args.get("quality", "source")

    try:
        payload = fetch_video_info(video_url)
    except DownloadError as exc:
        return no_cache_json({"error": str(exc)}, 502)
    except Exception as exc:  # pragma: no cover
        return no_cache_json({"error": f"Unexpected error: {exc}"}, 500)

    download_result = download_service.download(
        download_service.DownloadRequest(
            url=payload["videoUrl"],
            title=payload["title"],
            uploader=payload["uploader"],
            output_format=output_format,
            audio_codec=audio_codec,
            video_codec=video_codec,
            quality=quality,
        )
    )

    response = send_file(
        BytesIO(download_result.content),
        mimetype=download_result.mimetype,
        as_attachment=True,
        download_name=download_result.filename,
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Download-Backend"] = download_result.backend
    response.headers["X-Content-SHA256"] = download_result.integrity_sha256
    return response


@site_blueprint.post("/api/fake-download/start")
def start_fake_download():
    payload = request.get_json(silent=True) or {}
    video_url = payload.get("url", DEFAULT_VIDEO_URL)
    output_format = str(payload.get("format", "mp4")).lower()
    audio_codec = str(payload.get("audioCodec", "aac"))
    video_codec = str(payload.get("videoCodec", "h264"))
    quality = str(payload.get("quality", "source"))

    try:
        video_payload = fetch_video_info(video_url)
    except DownloadError as exc:
        return no_cache_json({"error": str(exc)}, 502)
    except Exception as exc:  # pragma: no cover
        return no_cache_json({"error": f"Unexpected error: {exc}"}, 500)

    job_id = download_service.start_download_job(
        download_service.DownloadRequest(
            url=video_payload["videoUrl"],
            title=video_payload["title"],
            uploader=video_payload["uploader"],
            output_format=output_format,
            audio_codec=audio_codec,
            video_codec=video_codec,
            quality=quality,
        )
    )

    return no_cache_json({"jobId": job_id}, 202)


@site_blueprint.get("/api/fake-download/status/<job_id>")
def fake_download_status(job_id: str):
    status = download_service.get_download_status(job_id)
    if status is None:
        return no_cache_json({"error": "Download job not found"}, 404)
    return no_cache_json(status)


@site_blueprint.get("/api/fake-download/file/<job_id>")
def fake_download_file(job_id: str):
    status = download_service.get_download_status(job_id)
    if status is None:
        return no_cache_json({"error": "Download job not found"}, 404)
    if status["status"] != "complete":
        return no_cache_json({"error": "Download job not complete"}, 409)

    download_result = download_service.get_download_result(job_id)
    if download_result is None:
        return no_cache_json({"error": "Download payload missing"}, 500)

    response = send_file(
        BytesIO(download_result.content),
        mimetype=download_result.mimetype,
        as_attachment=True,
        download_name=download_result.filename,
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Download-Backend"] = download_result.backend
    response.headers["X-Content-SHA256"] = download_result.integrity_sha256
    return response
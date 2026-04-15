from __future__ import annotations

from pathlib import Path

from flask import Flask

from .routes import site_blueprint


def create_app(spiral_settings: dict | None = None) -> Flask:
    base_dir = Path(__file__).resolve().parent.parent
    app = Flask(__name__, static_folder=str(base_dir), static_url_path="")
    app.config["APP_ROOT"] = base_dir
    app.config["SPIRAL_SETTINGS"] = spiral_settings or {
        "fps": 30,
        "loopDurationSeconds": 1,
        "maxPixelRatio": 1.25,
        "pixelSize": 10,
        "renderScale": 0.5,
    }
    app.register_blueprint(site_blueprint)
    return app
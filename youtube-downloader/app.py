from webapp import create_app


SPIRAL_SETTINGS = {
    "fps": 30,
    "loopDurationSeconds": 1,
    "maxPixelRatio": 1.25,
    "pixelSize": 2,
    "renderScale": 0.5,
}

app = create_app(spiral_settings=SPIRAL_SETTINGS)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, ssl_context="adhoc")
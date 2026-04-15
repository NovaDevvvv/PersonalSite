import {
  DEFAULT_SPIRAL_SETTINGS,
  INVALID_URL_TEXT,
  LOADING_FRAMES,
  METADATA_FAILED_TEXT,
  READY_TO_DOWNLOAD_TEXT,
  VERIFYING_DURATION_MS,
  VERIFYING_TEXT,
} from "./config.js";
import { DownloadOptionsPanel } from "./components/download-options-panel.js";
import { LoadingIndicator } from "./components/loading-indicator.js";
import { SpiralRenderer } from "./components/spiral-renderer.js";
import { VideoMetadataPanel } from "./components/video-metadata-panel.js";


const AUDIO_ONLY_FORMATS = new Set(["mp3", "m4a", "wav", "flac"]);
const STATIC_BACKEND_TEXT = "[ BACKEND REQUIRES REAL HOSTING ]";


const canvas = document.getElementById("spiral");
const loadingText = document.getElementById("loadingText");
const videoInfo = document.getElementById("videoInfo");
const downloadOptions = document.getElementById("downloadOptions");

const loadingIndicator = new LoadingIndicator(loadingText, LOADING_FRAMES);
const videoMetadataPanel = new VideoMetadataPanel(videoInfo);
const downloadOptionsPanel = new DownloadOptionsPanel(downloadOptions);

let metadataStarted = false;
let spiralRenderer;
let introTimerId = null;
let verificationComplete = false;
let activeVideoUrl = null;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRequestedVideoUrl() {
  const currentUrl = new URL(window.location.href);
  const videoId = currentUrl.searchParams.get("v")?.trim();

  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  if (currentUrl.pathname === "/watch") {
    return null;
  }

  return null;
}

async function loadRuntimeConfig() {
  return DEFAULT_SPIRAL_SETTINGS;
}

async function loadVideoInfo() {
  const requestedVideoUrl = getRequestedVideoUrl();
  if (!requestedVideoUrl) {
    loadingIndicator.setText(INVALID_URL_TEXT);
    return;
  }

  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(requestedVideoUrl)}&format=json`, {
      headers: {
        accept: "application/json",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Metadata request failed with ${response.status}`);
    }

    activeVideoUrl = requestedVideoUrl;
    videoMetadataPanel.show({
      title: payload.title || "Unknown",
      length: "Unknown",
      uploader: payload.author_name || payload.provider_name || "Unknown",
    });
    downloadOptionsPanel.show();
    loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
  } catch (error) {
    console.error(error);
    const videoId = new URL(requestedVideoUrl).searchParams.get("v") || "Unknown";
    activeVideoUrl = requestedVideoUrl;
    videoMetadataPanel.show({
      title: `Video ${videoId}`,
      length: "Unknown",
      uploader: "Unknown",
    });
    downloadOptionsPanel.show();
    loadingIndicator.setText(METADATA_FAILED_TEXT);
    await wait(1200);
    loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
  }
}

async function startTrackedDownload(options) {
  if (!activeVideoUrl) {
    loadingIndicator.setText(METADATA_FAILED_TEXT);
    return;
  }

  console.info("Static Pages mode download request", {
    url: activeVideoUrl,
    ...options,
    audioOnly: AUDIO_ONLY_FORMATS.has(options.format),
  });
  loadingIndicator.setText(STATIC_BACKEND_TEXT);
}

function startExperience() {
  spiralRenderer?.start();

  if (!verificationComplete) {
    loadingIndicator.setText(VERIFYING_TEXT);

    if (introTimerId === null) {
      introTimerId = window.setTimeout(() => {
        introTimerId = null;
        verificationComplete = true;
        loadingIndicator.lockedText = null;
        loadingIndicator.element.textContent = LOADING_FRAMES[0];
        loadingIndicator.resume();

        if (!metadataStarted) {
          metadataStarted = true;
          void loadVideoInfo();
        }
      }, VERIFYING_DURATION_MS);
    }

    return;
  }

  loadingIndicator.resume();

  if (!metadataStarted) {
    metadataStarted = true;
    void loadVideoInfo();
  }
}

function stopExperience() {
  spiralRenderer?.stop();
  loadingIndicator.pause();

  if (introTimerId !== null) {
    window.clearTimeout(introTimerId);
    introTimerId = null;
  }
}

window.addEventListener("resize", () => spiralRenderer?.resize());

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopExperience();
  } else {
    startExperience();
  }
});

downloadOptionsPanel.onSubmit(async (options) => {
  await startTrackedDownload(options);
});

loadRuntimeConfig().then((spiralSettings) => {
  try {
    spiralRenderer = new SpiralRenderer(canvas, spiralSettings);
  } catch (error) {
    console.error(error);
    loadingIndicator.setText("[ WEBGL REQUIRED ]");
    return;
  }

  startExperience();
});
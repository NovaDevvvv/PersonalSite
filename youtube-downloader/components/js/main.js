import {
  CHECKING_INTEGRITY_TEXT,
  DEFAULT_SPIRAL_SETTINGS,
  DOWNLOAD_COMPLETE_TEXT,
  DOWNLOAD_START_TEXT,
  FALLBACK_DOWNLOAD_TEXT,
  FALLBACK_NOTICE_TEXT,
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
let activeDownloadJobId = null;
let activeDownloadPollId = null;

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
  try {
    const response = await fetch("/api/runtime-config", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error("Runtime config request failed");
    }

    const payload = await response.json();
    return { ...DEFAULT_SPIRAL_SETTINGS, ...(payload.spiralSettings || {}) };
  } catch (error) {
    console.error(error);
    return DEFAULT_SPIRAL_SETTINGS;
  }
}

async function loadVideoInfo() {
  const requestedVideoUrl = getRequestedVideoUrl();
  if (!requestedVideoUrl) {
    loadingIndicator.setText(INVALID_URL_TEXT);
    return;
  }

  try {
    const response = await fetch(`/api/video-info?url=${encodeURIComponent(requestedVideoUrl)}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Metadata request failed");
    }

    activeVideoUrl = payload.videoUrl;
    videoMetadataPanel.show(payload);
    downloadOptionsPanel.show();
    if (payload.usedFallback) {
      loadingIndicator.setText(FALLBACK_NOTICE_TEXT);
      await wait(1200);
      loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
      return;
    }

    loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
  } catch (error) {
    console.error(error);
    loadingIndicator.setText(METADATA_FAILED_TEXT);
  }
}

async function startTrackedDownload(options) {
  if (!activeVideoUrl) {
    loadingIndicator.setText(METADATA_FAILED_TEXT);
    return;
  }

  if (activeDownloadJobId) {
    return;
  }

  const initialText = AUDIO_ONLY_FORMATS.has(options.format) ? FALLBACK_DOWNLOAD_TEXT : DOWNLOAD_START_TEXT;

  activeDownloadJobId = "pending";
  downloadOptionsPanel.hide();
  loadingIndicator.setText(initialText);

  try {
    const response = await fetch("/api/fake-download/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      body: JSON.stringify({
        url: activeVideoUrl,
        format: options.format,
        audioCodec: options.audioCodec,
        videoCodec: options.videoCodec,
        quality: options.quality,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Download start failed");
    }

    activeDownloadJobId = payload.jobId;
    pollDownloadProgress(activeDownloadJobId, initialText);
  } catch (error) {
    console.error(error);
    activeDownloadJobId = null;
    loadingIndicator.setText(METADATA_FAILED_TEXT);
  }
}

function stopDownloadPolling() {
  if (activeDownloadPollId !== null) {
    window.clearTimeout(activeDownloadPollId);
    activeDownloadPollId = null;
  }
}

async function pollDownloadProgress(jobId, progressTemplate) {
  try {
    const response = await fetch(`/api/fake-download/status/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Download status failed");
    }

    if (payload.status === "error") {
      throw new Error(payload.error || "Download failed");
    }

    const progressText = payload.progress || "0%";
    loadingIndicator.setText(progressTemplate.replace("0%", progressText));

    if (payload.status === "complete") {
      loadingIndicator.setText(CHECKING_INTEGRITY_TEXT);
      triggerTrackedDownload(jobId);
      loadingIndicator.setText(DOWNLOAD_COMPLETE_TEXT);
      activeDownloadJobId = null;
      stopDownloadPolling();
      return;
    }

    activeDownloadPollId = window.setTimeout(() => {
      void pollDownloadProgress(jobId, progressTemplate);
    }, 350);
  } catch (error) {
    console.error(error);
    activeDownloadJobId = null;
    stopDownloadPolling();
    loadingIndicator.setText(METADATA_FAILED_TEXT);
  }
}

function triggerTrackedDownload(jobId) {
  if (!jobId) {
    loadingIndicator.setText(METADATA_FAILED_TEXT);
    return;
  }

  const link = document.createElement("a");
  link.href = `/api/fake-download/file/${encodeURIComponent(jobId)}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
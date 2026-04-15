const DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=pdrGJjFAw2";
const FALLBACK_VIDEO_URL = "https://www.youtube.com/watch?v=vObY1I1C2Y4";
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const DEFAULT_SPIRAL_SETTINGS = {
  fps: 30,
  loopDurationSeconds: 1,
  maxPixelRatio: 1.25,
  pixelSize: 10,
  renderScale: 0.5,
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/runtime-config") {
        return jsonResponse({ spiralSettings: DEFAULT_SPIRAL_SETTINGS });
      }

      if (url.pathname === "/api/video-info") {
        const requestedUrl = url.searchParams.get("url") || DEFAULT_VIDEO_URL;
        const payload = await fetchVideoInfo(requestedUrl);
        return jsonResponse(payload);
      }

      if (url.pathname === "/api/fake-download/start" && request.method === "POST") {
        const payload = await request.json();
        const requestedUrl = String(payload?.url || DEFAULT_VIDEO_URL);
        const videoInfo = await fetchVideoInfo(requestedUrl);
        const jobPayload = {
          url: videoInfo.videoUrl,
          title: videoInfo.title,
          uploader: videoInfo.uploader,
          format: String(payload?.format || "mp4").toLowerCase(),
          audioCodec: String(payload?.audioCodec || "aac"),
          videoCodec: String(payload?.videoCodec || "h264"),
          quality: String(payload?.quality || "source"),
          createdAt: new Date().toISOString(),
        };

        return jsonResponse({ jobId: encodeJobPayload(jobPayload) }, 202);
      }

      if (url.pathname.startsWith("/api/fake-download/status/")) {
        const jobId = decodeURIComponent(url.pathname.split("/").pop() || "");
        const job = decodeJobPayload(jobId);
        return jsonResponse({
          id: jobId,
          url: job.url,
          filename: buildManifestFilename(job),
          backend: "cloudflare-worker",
          progress: "100%",
          integrity: "worker-manifest",
          status: "complete",
          error: null,
        });
      }

      if (url.pathname.startsWith("/api/fake-download/file/")) {
        const jobId = decodeURIComponent(url.pathname.split("/").pop() || "");
        const job = decodeJobPayload(jobId);
        const manifest = buildManifest(job);
        return textFileResponse(manifest, buildManifestFilename(job));
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
    }
  },
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function textFileResponse(content, filename) {
  return new Response(content, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Download-Backend": "cloudflare-worker",
    },
  });
}

async function fetchVideoInfo(inputUrl) {
  const [videoUrl, usedFallback] = normalizeVideoUrl(inputUrl);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

  let title = "Unknown";
  let uploader = "Unknown";

  try {
    const response = await fetch(oembedUrl, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Metadata request failed with ${response.status}`);
    }

    const payload = await response.json();
    title = payload.title || title;
    uploader = payload.author_name || payload.provider_name || uploader;
  } catch {
    const videoId = new URL(videoUrl).searchParams.get("v") || "Unknown";
    title = `Video ${videoId}`;
  }

  return {
    title,
    length: "Unknown",
    uploader,
    videoUrl,
    usedFallback,
  }; 
}

function normalizeVideoUrl(inputUrl) {
  const candidate = String(inputUrl || "").trim();
  const directId = extractVideoId(candidate);

  if (directId) {
    return [`https://www.youtube.com/watch?v=${directId}`, false];
  }

  if (!candidate) {
    return [DEFAULT_VIDEO_URL, true];
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      return [candidate, false];
    }
  } catch {
  }

  return [FALLBACK_VIDEO_URL, true];
}

function extractVideoId(rawValue) {
  const value = String(rawValue || "").trim();
  if (YOUTUBE_ID_PATTERN.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const queryVideoId = parsed.searchParams.get("v");
    if (queryVideoId && YOUTUBE_ID_PATTERN.test(queryVideoId)) {
      return queryVideoId;
    }

    if (parsed.hostname.endsWith("youtu.be")) {
      const shortId = parsed.pathname.replace(/^\//, "").slice(0, 11);
      return YOUTUBE_ID_PATTERN.test(shortId) ? shortId : null;
    }

    const shortsMatch = parsed.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) {
      return shortsMatch[1];
    }
  } catch {
    const directMatch = value.match(/(?:v=|be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (directMatch) {
      return directMatch[1];
    }
  }

  return null;
}

function encodeJobPayload(payload) {
  return toBase64Url(JSON.stringify(payload));
}

function decodeJobPayload(encoded) {
  if (!encoded) {
    throw new Error("Missing download job id");
  }

  const decoded = fromBase64Url(encoded);
  return JSON.parse(decoded);
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function sanitizeFilename(value) {
  const sanitized = String(value || "Unknown").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
  return sanitized || "Unknown";
}

function buildManifestFilename(job) {
  return `${sanitizeFilename(job.title)} - ${sanitizeFilename(job.uploader)}.txt`;
}

function buildManifest(job) {
  return [
    "novaa.dev worker export",
    `title: ${job.title}`,
    `uploader: ${job.uploader}`,
    `source: ${job.url}`,
    `format: ${job.format}`,
    `audioCodec: ${job.audioCodec}`,
    `videoCodec: ${job.videoCodec}`,
    `quality: ${job.quality}`,
    `createdAt: ${job.createdAt}`,
    "note: This Cloudflare Worker provides the backend contract used by the original frontend. It exports the request details as a file instead of downloading and transcoding YouTube media inside the worker runtime.",
  ].join("\n");
}
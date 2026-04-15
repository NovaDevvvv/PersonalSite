const VERIFYING_TEXT = "[ VERIFYING YOU ARE A HUMAN ]";
const VERIFYING_DURATION_MS = 1400;
const LOADING_FRAMES = ["[ LOADING. ]", "[ LOADING.. ]", "[ LOADING... ]"];
const PREPARING_TEXT = "[ PREPARING DOWNLOAD ]";
const MANIFEST_TEXT = "[ EXPORT READY ]";
const INVALID_URL_TEXT = "[ INVALID VIDEO URL ]";
const METADATA_FAILED_TEXT = "[ METADATA FAILED ]";
const READY_TO_DOWNLOAD_TEXT = "[ PLEASE CHOOSE DOWNLOAD OPTIONS ]";
const PASTE_LINK_TEXT = "[ PASTE A YOUTUBE LINK ]";
const STATIC_MODE_LABEL = "GitHub Pages Static Mode";
const DEFAULT_SPIRAL_SETTINGS = {
	fps: 30,
	loopDurationSeconds: 1,
	maxPixelRatio: 1.25,
	pixelSize: 10,
	renderScale: 0.5,
};

const AUDIO_ONLY_FORMATS = new Set(["mp3", "m4a", "wav", "flac"]);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const canvas = document.getElementById("spiral");
const loadingText = document.getElementById("loadingText");
const videoInfo = document.getElementById("videoInfo");
const downloadOptions = document.getElementById("downloadOptions");
const watchLinkForm = document.getElementById("watchLinkForm");
const videoUrlInput = document.getElementById("videoUrlInput");

const titleElement = document.getElementById("videoTitle");
const lengthElement = document.getElementById("videoLength");
const uploaderElement = document.getElementById("videoUploader");

let spiralRenderer;
let introTimerId = null;
let metadataStarted = false;
let verificationComplete = false;
let activeVideo = null;

class LoadingIndicator {
	constructor(element, frames, intervalMs = 350) {
		this.element = element;
		this.frames = frames;
		this.intervalMs = intervalMs;
		this.frameIndex = 0;
		this.intervalId = null;
		this.lockedText = null;
	}

	start() {
		if (this.lockedText || this.intervalId !== null) {
			return;
		}

		this.intervalId = window.setInterval(() => {
			this.frameIndex = (this.frameIndex + 1) % this.frames.length;
			this.element.textContent = this.frames[this.frameIndex];
		}, this.intervalMs);
	}

	pause() {
		if (this.intervalId === null) {
			return;
		}

		window.clearInterval(this.intervalId);
		this.intervalId = null;
	}

	resume() {
		this.lockedText = null;
		this.start();
	}

	setText(text) {
		this.lockedText = text;
		this.pause();
		this.element.textContent = text;
	}
}

class DownloadOptionsPanel {
	constructor(rootElement) {
		this.rootElement = rootElement;
		this.formElement = rootElement;
		this.formatElement = document.getElementById("formatSelect");
		this.audioCodecElement = document.getElementById("audioCodecSelect");
		this.videoCodecElement = document.getElementById("videoCodecSelect");
		this.qualityElement = document.getElementById("qualitySelect");
	}

	show() {
		this.rootElement.hidden = false;
		this.syncCodecVisibility();
	}

	hide() {
		this.rootElement.hidden = true;
	}

	getValues() {
		return {
			format: this.formatElement.value,
			audioCodec: this.audioCodecElement.value,
			videoCodec: this.videoCodecElement.value,
			quality: this.qualityElement.value,
		};
	}

	onSubmit(handler) {
		this.formElement.addEventListener("submit", (event) => {
			event.preventDefault();
			handler(this.getValues());
		});

		this.formatElement.addEventListener("change", () => {
			this.syncCodecVisibility();
		});
	}

	syncCodecVisibility() {
		const isAudioOnly = AUDIO_ONLY_FORMATS.has(this.formatElement.value);
		this.videoCodecElement.closest("label").hidden = isAudioOnly;
		this.qualityElement.closest("label").hidden = isAudioOnly;
	}
}

class SpiralRenderer {
	constructor(targetCanvas, settings = {}) {
		this.canvas = targetCanvas;
		this.settings = { ...DEFAULT_SPIRAL_SETTINGS, ...settings };
		this.gl = targetCanvas.getContext("webgl", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			desynchronized: true,
			powerPreference: "low-power",
			preserveDrawingBuffer: false,
		});

		if (!this.gl) {
			throw new Error("WebGL unavailable");
		}

		const vertexSource = `
			attribute vec2 aPosition;
			void main() {
				gl_Position = vec4(aPosition, 0.0, 1.0);
			}
		`;

		const fragmentSource = `
			precision highp float;
			uniform float uTime;
			uniform float uPixelSize;
			uniform vec2 uResolution;
			uniform vec2 uAspect;
			const vec3 DARK = vec3(33.0 / 255.0);
			const vec3 LIGHT = vec3(41.0 / 255.0);
			void main() {
				vec2 pixelCoord = (floor(gl_FragCoord.xy / uPixelSize) + 0.5) * uPixelSize;
				vec2 position = -uAspect.xy + 2.0 * pixelCoord / uResolution.xy * uAspect.xy;
				float radius = max(length(position), 0.0001);
				float angle = degrees(atan(position.y, position.x));
				float spiral = mod(angle + 30.0 * uTime - 120.0 * log(radius), 30.0);
				float band = step(15.0, spiral);
				gl_FragColor = vec4(mix(DARK, LIGHT, band), 1.0);
			}
		`;

		const compileShader = (type, source) => {
			const shader = this.gl.createShader(type);
			this.gl.shaderSource(shader, source);
			this.gl.compileShader(shader);

			if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
				throw new Error(this.gl.getShaderInfoLog(shader) || "Shader compile failed");
			}

			return shader;
		};

		this.program = this.gl.createProgram();
		this.gl.attachShader(this.program, compileShader(this.gl.VERTEX_SHADER, vertexSource));
		this.gl.attachShader(this.program, compileShader(this.gl.FRAGMENT_SHADER, fragmentSource));
		this.gl.linkProgram(this.program);

		if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
			throw new Error(this.gl.getProgramInfoLog(this.program) || "Program link failed");
		}

		this.gl.useProgram(this.program);
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			this.gl.STATIC_DRAW,
		);

		const positionLocation = this.gl.getAttribLocation(this.program, "aPosition");
		this.gl.enableVertexAttribArray(positionLocation);
		this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

		this.timeLocation = this.gl.getUniformLocation(this.program, "uTime");
		this.pixelSizeLocation = this.gl.getUniformLocation(this.program, "uPixelSize");
		this.resolutionLocation = this.gl.getUniformLocation(this.program, "uResolution");
		this.aspectLocation = this.gl.getUniformLocation(this.program, "uAspect");
		this.gl.uniform1f(this.pixelSizeLocation, this.settings.pixelSize);

		this.animationFrameId = null;
		this.accumulatedTimeMs = 0;
		this.lastFrameTime = null;
		this.frameAccumulatorMs = 0;
		this.frameIntervalMs = 1000 / this.settings.fps;
	}

	resize() {
		const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), this.settings.maxPixelRatio);
		const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio * this.settings.renderScale));
		const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio * this.settings.renderScale));

		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}

		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);

		const aspectX = this.canvas.width >= this.canvas.height ? this.canvas.width / this.canvas.height : 1.0;
		const aspectY = this.canvas.height > this.canvas.width ? this.canvas.height / this.canvas.width : 1.0;
		this.gl.uniform2f(this.aspectLocation, aspectX, aspectY);
	}

	render = (now) => {
		if (this.lastFrameTime === null) {
			this.lastFrameTime = now;
		}

		const deltaMs = now - this.lastFrameTime;
		this.lastFrameTime = now;
		this.frameAccumulatorMs += deltaMs;

		if (this.frameAccumulatorMs < this.frameIntervalMs) {
			this.animationFrameId = requestAnimationFrame(this.render);
			return;
		}

		this.accumulatedTimeMs += this.frameAccumulatorMs;
		this.frameAccumulatorMs = 0;
		this.resize();
		this.gl.uniform1f(this.timeLocation, (this.accumulatedTimeMs * 0.001) % this.settings.loopDurationSeconds);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		this.animationFrameId = requestAnimationFrame(this.render);
	};

	start() {
		if (this.animationFrameId !== null) {
			return;
		}

		this.lastFrameTime = null;
		this.animationFrameId = requestAnimationFrame(this.render);
	}

	stop() {
		if (this.animationFrameId === null) {
			return;
		}

		cancelAnimationFrame(this.animationFrameId);
		this.animationFrameId = null;
		this.lastFrameTime = null;
		this.frameAccumulatorMs = 0;
	}
}

const loadingIndicator = new LoadingIndicator(loadingText, LOADING_FRAMES);
const downloadOptionsPanel = new DownloadOptionsPanel(downloadOptions);

function wait(ms) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function buildYouTubeUrl(videoId) {
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function buildWatchUrl(videoId) {
	const url = new URL(window.location.origin);
	url.pathname = "/watch/";
	url.searchParams.set("v", videoId);
	return url.toString();
}

function getVideoId(rawValue) {
	const value = String(rawValue ?? "").trim();
	if (!value) {
		return null;
	}

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

function setVideoMetadata(payload) {
	titleElement.textContent = payload.title;
	lengthElement.textContent = payload.length;
	uploaderElement.textContent = payload.uploader;
	videoInfo.hidden = false;
	activeVideo = payload;
}

async function fetchPublicMetadata(videoId) {
	const videoUrl = buildYouTubeUrl(videoId);
	const watchUrl = buildWatchUrl(videoId);
	const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

	try {
		const response = await fetch(endpoint, {
			headers: {
				accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Metadata request failed with ${response.status}`);
		}

		const payload = await response.json();
		return {
			title: payload.title || "Untitled video",
			length: STATIC_MODE_LABEL,
			uploader: payload.author_name || "Unknown uploader",
			videoUrl,
			watchUrl,
		};
	} catch (error) {
		console.error(error);
		return {
			title: `Video ${videoId}`,
			length: STATIC_MODE_LABEL,
			uploader: "Public fallback",
			videoUrl,
			watchUrl,
		};
	}
}

function downloadTextFile(content, filename) {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const blobUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = blobUrl;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(blobUrl);
}

function sanitizeFilename(value) {
	return String(value || "Unknown").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Unknown";
}

async function prepareDownload(options) {
	if (!activeVideo) {
		loadingIndicator.setText(METADATA_FAILED_TEXT);
		return;
	}

	downloadOptionsPanel.hide();
	loadingIndicator.setText(PREPARING_TEXT);
	await wait(650);

	const manifest = [
		"novaa.dev static export",
		`title: ${activeVideo.title}`,
		`uploader: ${activeVideo.uploader}`,
		`source: ${activeVideo.videoUrl}`,
		`watchUrl: ${activeVideo.watchUrl}`,
		`format: ${options.format}`,
		`audioCodec: ${options.audioCodec}`,
		`videoCodec: ${options.videoCodec}`,
		`quality: ${options.quality}`,
		`generatedAt: ${new Date().toISOString()}`,
		"note: GitHub Pages can export the download request metadata, but direct YouTube media downloading still requires a backend.",
	].join("\n");

	const filename = `${sanitizeFilename(activeVideo.title)} - download-request.txt`;
	downloadTextFile(manifest, filename);
	loadingIndicator.setText(MANIFEST_TEXT);
	await wait(900);
	loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
	downloadOptionsPanel.show();
}

async function loadVideoInfo() {
	const videoId = new URLSearchParams(window.location.search).get("v")?.trim();
	if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) {
		loadingIndicator.setText(PASTE_LINK_TEXT);
		return;
	}

	const payload = await fetchPublicMetadata(videoId);
	setVideoMetadata(payload);
	loadingIndicator.setText(READY_TO_DOWNLOAD_TEXT);
	downloadOptionsPanel.show();
}

function startExperience() {
	spiralRenderer?.start();

	const hasVideo = YOUTUBE_ID_PATTERN.test(new URLSearchParams(window.location.search).get("v") || "");
	if (!hasVideo) {
		loadingIndicator.setText(PASTE_LINK_TEXT);
		return;
	}

	if (!verificationComplete) {
		loadingIndicator.setText(VERIFYING_TEXT);
		if (introTimerId === null) {
			introTimerId = window.setTimeout(() => {
				introTimerId = null;
				verificationComplete = true;
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

function handleRouteRewrite(event) {
	event.preventDefault();
	const videoId = getVideoId(videoUrlInput.value);
	if (!videoId) {
		loadingIndicator.setText(INVALID_URL_TEXT);
		return;
	}

	window.location.assign(buildWatchUrl(videoId));
}

function normalizeWatchRoute() {
	if (window.location.pathname === "/watch") {
		const redirectedUrl = new URL(window.location.href);
		redirectedUrl.pathname = "/watch/";
		window.location.replace(redirectedUrl.toString());
		return true;
	}
	return false;
}

function syncFormInputWithLocation() {
	const videoId = new URLSearchParams(window.location.search).get("v");
	if (videoId && videoUrlInput) {
		videoUrlInput.value = buildYouTubeUrl(videoId);
	}
}

if (!normalizeWatchRoute()) {
	try {
		spiralRenderer = new SpiralRenderer(canvas);
	} catch (error) {
		console.error(error);
		loadingIndicator.setText("[ WEBGL REQUIRED ]");
	}

	syncFormInputWithLocation();
	watchLinkForm?.addEventListener("submit", handleRouteRewrite);
	downloadOptionsPanel.onSubmit((options) => {
		void prepareDownload(options);
	});

	window.addEventListener("resize", () => spiralRenderer?.resize());
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			stopExperience();
		} else {
			startExperience();
		}
	});

	startExperience();
}
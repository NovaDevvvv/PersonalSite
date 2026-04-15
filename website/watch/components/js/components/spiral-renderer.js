import { DEFAULT_SPIRAL_SETTINGS } from "../config.js";

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

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
  }

  return shader;
}

export class SpiralRenderer {
  constructor(canvas, settings = {}) {
    this.canvas = canvas;
    this.settings = { ...DEFAULT_SPIRAL_SETTINGS, ...settings };
    this.gl = canvas.getContext("webgl", {
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

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, compileShader(this.gl, this.gl.VERTEX_SHADER, vertexSource));
    this.gl.attachShader(this.program, compileShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentSource));
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(this.program) || "Program link failed");
    }

    this.gl.useProgram(this.program);
    this.setupBuffer();

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

  setupBuffer() {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      this.gl.STATIC_DRAW,
    );

    const positionLocation = this.gl.getAttribLocation(this.program, "aPosition");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
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
import {
  QUALITY_PRESETS,
  type AuroraConfig,
  type AuroraQuality,
} from "./config";
import { auroraFragmentShader, auroraVertexShader } from "./shaders";
import {
  capQuality,
  detectPerformanceProfile,
  type PerformanceProfile,
} from "../performance";

export type AuroraMetrics = {
  fps: number;
  dpr: number;
  quality: AuroraQuality;
  width: number;
  height: number;
  elapsed: number;
};

type AuroraCallbacks = {
  onReady: () => void;
  onFailure: () => void;
  onMetrics: (metrics: AuroraMetrics) => void;
  onReducedMotion: (reduced: boolean) => void;
};

const UNIFORM_NAMES = [
  "iResolution",
  "iTime",
  "uDithering",
  "uSpeed",
  "uSeed",
  "uColorBase",
  "uColorHigh",
  "uColorMix",
  "uSaturation",
  "uImageAspect",
  "uViewportAspect",
  "uAuroraOffsetX",
  "uAuroraOffsetY",
  "uAuroraScaleX",
  "uAuroraScaleY",
  "uAuroraWidth",
  "uAuroraHeight",
  "uAuroraCenterX",
  "uAuroraIntensity",
  "uAuroraOpacity",
  "uAlphaLow",
  "uAlphaHigh",
  "uHorizonY",
  "uHorizonFeather",
  "uEdgeFade",
  "uCenterBias",
  "uNoiseScale",
  "uWarpStrength",
  "uCurtainSharpness",
  "uLineSharpness",
  "uBandCount",
  "uBandAlignment",
  "uBandStrength",
  "uBandSharpness",
  "uLayerCount",
  "uCurtainHeight",
  "uDepthSpread",
  "uLowerGlow",
  "uDebugMode",
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

type ProgramState = {
  program: WebGLProgram;
  position: number;
  uniforms: Record<UniformName, WebGLUniformLocation | null>;
};

type Rgb = [number, number, number];

const QUALITY_ORDER: AuroraQuality[] = ["low", "medium", "high"];
const QUALITY_FPS_CAP: Record<AuroraQuality, number> = {
  low: 30,
  medium: 45,
  high: 60,
};

function parseHexColor(color: string): Rgb {
  const value = color.trim().replace(/^#/, "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : value;
  const parsed = Number.parseInt(normalized, 16);

  if (normalized.length !== 6 || Number.isNaN(parsed)) return [1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

export class AuroraScene {
  private readonly host: HTMLElement;
  private readonly callbacks: AuroraCallbacks;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly config: AuroraConfig;
  private readonly performanceProfile: PerformanceProfile;
  private readonly motionQuery: MediaQueryList;
  private programState?: ProgramState;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private frameId: number | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private nextFrameAt = 0;
  private fpsStarted = 0;
  private fpsFrames = 0;
  private lastMetricsReport = 0;
  private renderedWidth = 0;
  private renderedHeight = 0;
  private renderedDpr = 0;
  private isReady = false;
  private isPaused = false;
  private isIntersecting = true;
  private isReducedMotion = false;
  private isDisposed = false;
  private debugMode = 0;
  private adaptiveQualityCap: AuroraQuality;
  private slowFpsWindows = 0;

  constructor(host: HTMLElement, initialConfig: AuroraConfig, callbacks: AuroraCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.config = { ...initialConfig };
    this.performanceProfile = detectPerformanceProfile();
    this.adaptiveQualityCap = this.performanceProfile.maxQuality;
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.isReducedMotion = this.motionQuery.matches;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "aurora-canvas";
    this.canvas.setAttribute("aria-hidden", "true");

    const context = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!context) throw new Error("WebGL is unavailable");
    this.gl = context;

    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error("Unable to create WebGL vertex buffer");
    this.vertexBuffer = buffer;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      this.gl.STATIC_DRAW,
    );
    this.configureGl();
    this.host.appendChild(this.canvas);
  }

  async init() {
    try {
      this.createProgram();
      this.attachObservers();
      this.resize();
      this.isReady = true;
      this.renderFrame();
      this.callbacks.onReducedMotion(this.isReducedMotion);
      this.reportMetrics(0, true);

      requestAnimationFrame(() => {
        if (!this.isDisposed) this.callbacks.onReady();
      });
      this.reconcileLoop();
    } catch {
      this.callbacks.onFailure();
    }
  }

  setConfig(nextConfig: AuroraConfig) {
    const previousQuality = this.effectiveQuality();
    const pixelRatioChanged = nextConfig.pixelRatio !== this.config.pixelRatio;
    Object.assign(this.config, nextConfig);
    const qualityChanged = previousQuality !== this.effectiveQuality();

    if (qualityChanged) {
      this.createProgram();
      this.renderedWidth = 0;
    } else {
      this.updateUniforms();
    }
    if (qualityChanged || pixelRatioChanged) this.resize();
    this.renderFrame();
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    this.reportMetrics(0, true);
    this.reconcileLoop();
  }

  setDebugMode(mode: number) {
    this.debugMode = mode;
    const state = this.programState;
    if (state) {
      this.gl.useProgram(state.program);
      this.gl.uniform1f(state.uniforms.uDebugMode, mode);
    }
    this.renderFrame();
  }

  dispose() {
    this.isDisposed = true;
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.removeEventListener("change", this.handleMotionPreference);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    if (this.programState) this.gl.deleteProgram(this.programState.program);
    this.gl.deleteBuffer(this.vertexBuffer);
    this.canvas.remove();
  }

  private configureGl() {
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendEquation(this.gl.FUNC_ADD);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0, 0, 0, 0);
  }

  private compileShader(type: number, source: string) {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Unable to create WebGL shader");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) || "WebGL shader compilation failed";
      this.gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  private createProgram() {
    const preset = QUALITY_PRESETS[this.effectiveQuality()];
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, auroraVertexShader);
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      `#define MAX_AURORA_LAYERS ${preset.iterations}\n${auroraFragmentShader}`,
    );
    const program = this.gl.createProgram();
    if (!program) throw new Error("Unable to create WebGL program");

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const message = this.gl.getProgramInfoLog(program) || "WebGL program linking failed";
      this.gl.deleteProgram(program);
      throw new Error(message);
    }

    const uniforms = Object.fromEntries(
      UNIFORM_NAMES.map((name) => [name, this.gl.getUniformLocation(program, name)]),
    ) as Record<UniformName, WebGLUniformLocation | null>;
    const nextState: ProgramState = {
      program,
      position: this.gl.getAttribLocation(program, "aPosition"),
      uniforms,
    };
    const previousProgram = this.programState?.program;
    this.programState = nextState;

    this.gl.useProgram(program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(nextState.position);
    this.gl.vertexAttribPointer(nextState.position, 2, this.gl.FLOAT, false, 0, 0);
    this.updateUniforms();
    if (previousProgram) this.gl.deleteProgram(previousProgram);
  }

  private updateUniforms() {
    const state = this.programState;
    if (!state) return;
    const { gl, config } = this;
    const uniforms = state.uniforms;
    const baseColor = parseHexColor(config.colorBase);
    const highColor = parseHexColor(config.colorHigh);

    gl.useProgram(state.program);
    gl.uniform2f(uniforms.iResolution, this.canvas.width || 1, this.canvas.height || 1);
    gl.uniform1f(uniforms.iTime, this.elapsed);
    gl.uniform1f(uniforms.uDithering, config.dithering);
    gl.uniform1f(uniforms.uSpeed, config.speed);
    gl.uniform1f(uniforms.uSeed, config.seed);
    gl.uniform3f(uniforms.uColorBase, ...baseColor);
    gl.uniform3f(uniforms.uColorHigh, ...highColor);
    gl.uniform1f(uniforms.uColorMix, config.colorMix);
    gl.uniform1f(uniforms.uSaturation, config.saturation);
    gl.uniform1f(uniforms.uImageAspect, 1);
    gl.uniform1f(uniforms.uViewportAspect, this.renderedWidth / Math.max(this.renderedHeight, 1));
    gl.uniform1f(uniforms.uAuroraOffsetX, config.offsetX);
    gl.uniform1f(uniforms.uAuroraOffsetY, config.offsetY);
    gl.uniform1f(uniforms.uAuroraScaleX, config.scaleX);
    gl.uniform1f(uniforms.uAuroraScaleY, config.scaleY);
    gl.uniform1f(uniforms.uAuroraWidth, config.width);
    gl.uniform1f(uniforms.uAuroraHeight, config.height);
    gl.uniform1f(uniforms.uAuroraCenterX, config.centerX);
    gl.uniform1f(uniforms.uAuroraIntensity, config.intensity);
    gl.uniform1f(uniforms.uAuroraOpacity, config.opacity);
    gl.uniform1f(uniforms.uAlphaLow, config.alphaLow);
    gl.uniform1f(uniforms.uAlphaHigh, config.alphaHigh);
    gl.uniform1f(uniforms.uHorizonY, config.horizonY);
    gl.uniform1f(uniforms.uHorizonFeather, config.horizonFeather);
    gl.uniform1f(uniforms.uEdgeFade, config.edgeFade);
    gl.uniform1f(uniforms.uCenterBias, config.centerBias);
    gl.uniform1f(uniforms.uNoiseScale, config.noiseScale);
    gl.uniform1f(uniforms.uWarpStrength, config.warpStrength);
    gl.uniform1f(uniforms.uCurtainSharpness, config.curtainSharpness);
    gl.uniform1f(uniforms.uLineSharpness, config.lineSharpness);
    gl.uniform1f(uniforms.uBandCount, config.bandCount);
    gl.uniform1f(uniforms.uBandAlignment, config.bandAlignment);
    gl.uniform1f(uniforms.uBandStrength, config.bandStrength);
    gl.uniform1f(uniforms.uBandSharpness, config.bandSharpness);
    gl.uniform1f(uniforms.uLayerCount, config.layerCount);
    gl.uniform1f(uniforms.uCurtainHeight, config.curtainHeight);
    gl.uniform1f(uniforms.uDepthSpread, config.depthSpread);
    gl.uniform1f(uniforms.uLowerGlow, config.lowerGlow);
    gl.uniform1f(uniforms.uDebugMode, this.debugMode);
  }

  private attachObservers() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isIntersecting = entry.isIntersecting;
        this.reconcileLoop();
      },
      { threshold: 0 },
    );
    this.intersectionObserver.observe(this.host);

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.addEventListener("change", this.handleMotionPreference);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost, { once: true });
  }

  private resize() {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const preset = QUALITY_PRESETS[this.effectiveQuality()];
    const dpr = Math.min(
      window.devicePixelRatio,
      this.config.pixelRatio,
      preset.maxDpr,
      this.performanceProfile.auroraMaxDpr,
    );

    if (
      width === this.renderedWidth &&
      height === this.renderedHeight &&
      dpr === this.renderedDpr
    ) {
      return;
    }

    this.renderedWidth = width;
    this.renderedHeight = height;
    this.renderedDpr = dpr;
    this.canvas.width = Math.max(Math.round(width * dpr), 1);
    this.canvas.height = Math.max(Math.round(height * dpr), 1);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.configureGl();
    this.updateUniforms();
    this.reportMetrics(0, true);
  }

  private renderFrame() {
    const state = this.programState;
    if (!state || this.isDisposed) return;
    this.gl.useProgram(state.program);
    this.gl.uniform1f(state.uniforms.iTime, this.elapsed);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private tick = (now: number) => {
    this.frameId = null;
    if (!this.shouldAnimate()) return;

    const frameInterval = 1000 / this.targetFps();
    if (now >= this.nextFrameAt - 1) {
      const delta = this.lastFrame === 0 ? 0 : Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;
      do {
        this.nextFrameAt += frameInterval;
      } while (this.nextFrameAt <= now);
      this.elapsed += delta;
      this.renderFrame();

      this.fpsFrames += 1;
      if (this.fpsStarted === 0) this.fpsStarted = now;
      if (now - this.fpsStarted >= 750) {
        const fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsStarted));
        this.reportMetrics(fps, true);
        this.adaptToMeasuredPerformance(fps);
        this.fpsStarted = now;
        this.fpsFrames = 0;
      } else if (now - this.lastMetricsReport >= 250) {
        this.reportMetrics(0, false);
      }
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  private reportMetrics(fps: number, force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastMetricsReport < 250) return;
    this.lastMetricsReport = now;
    this.callbacks.onMetrics({
      fps,
      dpr: this.renderedDpr || 1,
      quality: this.effectiveQuality(),
      width: this.canvas.width,
      height: this.canvas.height,
      elapsed: this.elapsed,
    });
  }

  private shouldAnimate() {
    return (
      this.isReady &&
      !this.isPaused &&
      !this.isReducedMotion &&
      this.isIntersecting &&
      !document.hidden &&
      !this.isDisposed
    );
  }

  private reconcileLoop() {
    if (this.shouldAnimate()) {
      if (this.frameId === null) {
        this.lastFrame = performance.now();
        this.nextFrameAt = this.lastFrame + 1000 / this.targetFps();
        this.frameId = requestAnimationFrame(this.tick);
      }
    } else {
      this.stopLoop();
      this.renderFrame();
    }
  }

  private stopLoop() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.lastFrame = 0;
    this.nextFrameAt = 0;
  }

  private effectiveQuality() {
    const deviceCapped = capQuality(this.config.quality, this.performanceProfile);
    return QUALITY_ORDER.indexOf(deviceCapped) <= QUALITY_ORDER.indexOf(this.adaptiveQualityCap)
      ? deviceCapped
      : this.adaptiveQualityCap;
  }

  private targetFps() {
    return Math.min(
      this.performanceProfile.auroraFps,
      QUALITY_FPS_CAP[this.effectiveQuality()],
    );
  }

  private adaptToMeasuredPerformance(fps: number) {
    const currentQuality = this.effectiveQuality();
    if (currentQuality === "low" || fps >= this.targetFps() * 0.72) {
      this.slowFpsWindows = 0;
      return;
    }

    this.slowFpsWindows += 1;
    if (this.slowFpsWindows < 2) return;

    this.adaptiveQualityCap = currentQuality === "high" ? "medium" : "low";
    this.slowFpsWindows = 0;
    this.createProgram();
    this.renderedWidth = 0;
    this.resize();
    this.nextFrameAt = performance.now() + 1000 / this.targetFps();
  }

  private handleVisibilityChange = () => this.reconcileLoop();

  private handleMotionPreference = (event: MediaQueryListEvent) => {
    this.isReducedMotion = event.matches;
    this.callbacks.onReducedMotion(event.matches);
    this.reconcileLoop();
  };

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.isReady = false;
    this.stopLoop();
    this.callbacks.onFailure();
  };
}

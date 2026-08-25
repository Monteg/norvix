import * as THREE from "three";
import {
  QUALITY_PRESETS,
  type AuroraQuality,
  type CodepenAuroraConfig,
} from "./config";
import {
  codepenAuroraFragmentShader,
  codepenAuroraVertexShader,
} from "./shaders";

export type AuroraCodepenMetrics = {
  fps: number;
  dpr: number;
  quality: AuroraQuality;
  width: number;
  height: number;
  elapsed: number;
};

type AuroraCodepenCallbacks = {
  onReady: () => void;
  onFailure: () => void;
  onMetrics: (metrics: AuroraCodepenMetrics) => void;
  onReducedMotion: (reduced: boolean) => void;
};

const HERO = "/hero";
const IMAGE_ASPECT = 1;

export class AuroraCodepenScene {
  private readonly host: HTMLElement;
  private readonly callbacks: AuroraCodepenCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly config: CodepenAuroraConfig;
  private readonly resolution = new THREE.Vector2(1, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private material?: THREE.ShaderMaterial;
  private mesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private skyMask?: THREE.Texture;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private motionQuery: MediaQueryList;
  private frameId: number | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private fpsStarted = 0;
  private fpsFrames = 0;
  private lastMetricsReport = 0;
  private isReady = false;
  private isPaused = false;
  private isIntersecting = true;
  private isReducedMotion = false;
  private isDisposed = false;
  private debugMode = 0;

  constructor(
    host: HTMLElement,
    initialConfig: CodepenAuroraConfig,
    callbacks: AuroraCodepenCallbacks,
  ) {
    this.host = host;
    this.callbacks = callbacks;
    this.config = { ...initialConfig };
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.isReducedMotion = this.motionQuery.matches;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "codepen-aurora-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.host.appendChild(this.renderer.domElement);
  }

  async init() {
    try {
      this.skyMask = await this.loadSkyMask();
      if (this.isDisposed) {
        this.skyMask.dispose();
        return;
      }

      this.createMaterial();
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

  setConfig(nextConfig: CodepenAuroraConfig) {
    const qualityChanged = nextConfig.quality !== this.config.quality;
    Object.assign(this.config, nextConfig);

    if (qualityChanged && this.skyMask) {
      this.createMaterial();
      this.resize();
    } else {
      this.updateUniforms();
      this.resize();
    }
    this.renderFrame();
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    this.reportMetrics(0, true);
    this.reconcileLoop();
  }

  setDebugMode(mode: number) {
    this.debugMode = mode;
    if (this.material) this.material.uniforms.uDebugMode.value = mode;
    this.renderFrame();
  }

  dispose() {
    this.isDisposed = true;
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.removeEventListener("change", this.handleMotionPreference);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.material?.dispose();
    this.geometry.dispose();
    this.skyMask?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private async loadSkyMask() {
    try {
      const texture = await new THREE.TextureLoader().loadAsync(`${HERO}/04-sky-mask.png`);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      return texture;
    } catch {
      const texture = new THREE.DataTexture(
        new Uint8Array([255, 255, 255, 255]),
        1,
        1,
        THREE.RGBAFormat,
      );
      texture.needsUpdate = true;
      return texture;
    }
  }

  private createMaterial() {
    if (!this.skyMask) return;
    const oldMaterial = this.material;
    const preset = QUALITY_PRESETS[this.config.quality];

    this.material = new THREE.ShaderMaterial({
      defines: { MAX_AURORA_LAYERS: preset.iterations },
      uniforms: {
        iResolution: { value: this.resolution },
        iTime: { value: this.elapsed },
        uDithering: { value: this.config.dithering },
        uSpeed: { value: this.config.speed },
        uSeed: { value: this.config.seed },
        uColorBase: { value: new THREE.Color(this.config.colorBase) },
        uColorHigh: { value: new THREE.Color(this.config.colorHigh) },
        uColorMix: { value: this.config.colorMix },
        uSaturation: { value: this.config.saturation },
        uImageAspect: { value: IMAGE_ASPECT },
        uViewportAspect: { value: 1 },
        uAuroraOffsetX: { value: this.config.offsetX },
        uAuroraOffsetY: { value: this.config.offsetY },
        uAuroraScaleX: { value: this.config.scaleX },
        uAuroraScaleY: { value: this.config.scaleY },
        uAuroraWidth: { value: this.config.width },
        uAuroraHeight: { value: this.config.height },
        uAuroraCenterX: { value: this.config.centerX },
        uAuroraIntensity: { value: this.config.intensity },
        uAuroraOpacity: { value: this.config.opacity },
        uAlphaLow: { value: this.config.alphaLow },
        uAlphaHigh: { value: this.config.alphaHigh },
        uHorizonY: { value: this.config.horizonY },
        uHorizonFeather: { value: this.config.horizonFeather },
        uEdgeFade: { value: this.config.edgeFade },
        uCenterBias: { value: this.config.centerBias },
        uNoiseScale: { value: this.config.noiseScale },
        uWarpStrength: { value: this.config.warpStrength },
        uCurtainSharpness: { value: this.config.curtainSharpness },
        uLineSharpness: { value: this.config.lineSharpness },
        uBandCount: { value: this.config.bandCount },
        uBandAlignment: { value: this.config.bandAlignment },
        uBandStrength: { value: this.config.bandStrength },
        uBandSharpness: { value: this.config.bandSharpness },
        uLayerCount: { value: this.config.layerCount },
        uCurtainHeight: { value: this.config.curtainHeight },
        uDepthSpread: { value: this.config.depthSpread },
        uLowerGlow: { value: this.config.lowerGlow },
        uUseSkyMask: { value: this.config.useSkyMask ? 1 : 0 },
        uSkyMask: { value: this.skyMask },
        uDebugMode: { value: this.debugMode },
      },
      vertexShader: codepenAuroraVertexShader,
      fragmentShader: codepenAuroraFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });

    if (this.mesh) {
      this.mesh.material = this.material;
    } else {
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);
    }
    oldMaterial?.dispose();
  }

  private updateUniforms() {
    if (!this.material) return;
    const uniforms = this.material.uniforms;
    uniforms.uDithering.value = this.config.dithering;
    uniforms.uSpeed.value = this.config.speed;
    uniforms.uSeed.value = this.config.seed;
    uniforms.uColorBase.value.set(this.config.colorBase);
    uniforms.uColorHigh.value.set(this.config.colorHigh);
    uniforms.uColorMix.value = this.config.colorMix;
    uniforms.uSaturation.value = this.config.saturation;
    uniforms.uAuroraOffsetX.value = this.config.offsetX;
    uniforms.uAuroraOffsetY.value = this.config.offsetY;
    uniforms.uAuroraScaleX.value = this.config.scaleX;
    uniforms.uAuroraScaleY.value = this.config.scaleY;
    uniforms.uAuroraWidth.value = this.config.width;
    uniforms.uAuroraHeight.value = this.config.height;
    uniforms.uAuroraCenterX.value = this.config.centerX;
    uniforms.uAuroraIntensity.value = this.config.intensity;
    uniforms.uAuroraOpacity.value = this.config.opacity;
    uniforms.uAlphaLow.value = this.config.alphaLow;
    uniforms.uAlphaHigh.value = this.config.alphaHigh;
    uniforms.uHorizonY.value = this.config.horizonY;
    uniforms.uHorizonFeather.value = this.config.horizonFeather;
    uniforms.uEdgeFade.value = this.config.edgeFade;
    uniforms.uCenterBias.value = this.config.centerBias;
    uniforms.uNoiseScale.value = this.config.noiseScale;
    uniforms.uWarpStrength.value = this.config.warpStrength;
    uniforms.uCurtainSharpness.value = this.config.curtainSharpness;
    uniforms.uLineSharpness.value = this.config.lineSharpness;
    uniforms.uBandCount.value = this.config.bandCount;
    uniforms.uBandAlignment.value = this.config.bandAlignment;
    uniforms.uBandStrength.value = this.config.bandStrength;
    uniforms.uBandSharpness.value = this.config.bandSharpness;
    uniforms.uLayerCount.value = this.config.layerCount;
    uniforms.uCurtainHeight.value = this.config.curtainHeight;
    uniforms.uDepthSpread.value = this.config.depthSpread;
    uniforms.uLowerGlow.value = this.config.lowerGlow;
    uniforms.uUseSkyMask.value = this.config.useSkyMask ? 1 : 0;
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
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, {
      once: true,
    });
  }

  private resize() {
    if (!this.material) return;
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const preset = QUALITY_PRESETS[this.config.quality];
    const dpr = Math.min(window.devicePixelRatio, this.config.pixelRatio, preset.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.renderer.getDrawingBufferSize(this.resolution);
    this.material.uniforms.uViewportAspect.value = width / height;
    this.reportMetrics(0, true);
  }

  private renderFrame() {
    if (!this.material || this.isDisposed) return;
    this.material.uniforms.iTime.value = this.elapsed;
    this.renderer.render(this.scene, this.camera);
  }

  private tick = (now: number) => {
    this.frameId = null;
    if (!this.shouldAnimate()) return;

    const delta = this.lastFrame === 0 ? 0 : Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += delta;
    this.renderFrame();

    this.fpsFrames += 1;
    if (this.fpsStarted === 0) this.fpsStarted = now;
    if (now - this.fpsStarted >= 750) {
      const fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsStarted));
      this.reportMetrics(fps, true);
      this.fpsStarted = now;
      this.fpsFrames = 0;
    } else if (now - this.lastMetricsReport >= 250) {
      this.reportMetrics(0, false);
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  private reportMetrics(fps: number, force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastMetricsReport < 250) return;
    this.lastMetricsReport = now;
    this.callbacks.onMetrics({
      fps,
      dpr: this.renderer.getPixelRatio(),
      quality: this.config.quality,
      width: Math.round(this.resolution.x),
      height: Math.round(this.resolution.y),
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
  }

  private handleVisibilityChange = () => this.reconcileLoop();

  private handleMotionPreference = (event: MediaQueryListEvent) => {
    this.isReducedMotion = event.matches;
    this.callbacks.onReducedMotion(event.matches);
    this.reconcileLoop();
  };

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.stopLoop();
    this.callbacks.onFailure();
  };
}

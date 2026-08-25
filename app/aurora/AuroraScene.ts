import * as THREE from "three";
import type { AuroraConfig } from "./config";
import { auroraFragmentShader, auroraVertexShader } from "./shaders";

type AuroraSceneCallbacks = {
  onFailure: () => void;
  onFps: (fps: number) => void;
  onReady: () => void;
  onReducedMotion: (reduced: boolean) => void;
  onShaderTime: (time: number) => void;
};

const HERO = "/hero";

export class AuroraScene {
  private readonly host: HTMLElement;
  private readonly callbacks: AuroraSceneCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly config: AuroraConfig;
  private material?: THREE.ShaderMaterial;
  private geometry?: THREE.PlaneGeometry;
  private auroraTexture?: THREE.Texture;
  private maskTexture?: THREE.Texture;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private motionQuery: MediaQueryList;
  private frameId: number | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private fpsStarted = 0;
  private fpsFrames = 0;
  private lastTimeReport = 0;
  private isReady = false;
  private isPaused = false;
  private isIntersecting = true;
  private isReducedMotion = false;
  private isDisposed = false;
  private debugView = 0;
  private showMask = false;
  private showBounds = false;

  constructor(host: HTMLElement, initialConfig: AuroraConfig, callbacks: AuroraSceneCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.config = { ...initialConfig };
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.isReducedMotion = this.motionQuery.matches;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = "aurora-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.host.appendChild(this.renderer.domElement);
  }

  async init() {
    const loader = new THREE.TextureLoader();

    try {
      const [auroraTexture, maskTexture] = await Promise.all([
        loader.loadAsync(`${HERO}/03-aurora.png`),
        loader.loadAsync(`${HERO}/04-sky-mask.png`),
      ]);

      if (this.isDisposed) {
        auroraTexture.dispose();
        maskTexture.dispose();
        return;
      }

      this.auroraTexture = auroraTexture;
      this.maskTexture = maskTexture;
      this.configureTexture(auroraTexture, THREE.SRGBColorSpace);
      this.configureTexture(maskTexture, THREE.NoColorSpace);

      const image = auroraTexture.image as HTMLImageElement;
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          uAurora: { value: auroraTexture },
          uSkyMask: { value: maskTexture },
          uTime: { value: 0 },
          uViewportAspect: { value: 1 },
          uImageAspect: { value: image.naturalWidth / Math.max(image.naturalHeight, 1) },
          uSpeed: { value: this.config.speed },
          uHorizontalDistortion: { value: this.config.horizontalDistortion },
          uVerticalDistortion: { value: this.config.verticalDistortion },
          uWaviness: { value: this.config.waviness },
          uVerticalFlow: { value: this.config.verticalFlow },
          uVerticalStretch: { value: this.config.verticalStretch },
          uNoiseScale: { value: this.config.noiseScale },
          uNoiseStrength: { value: this.config.noiseStrength },
          uNoiseEvolutionSpeed: { value: this.config.noiseEvolutionSpeed },
          uBrightness: { value: this.config.brightness },
          uBrightnessVariation: { value: this.config.brightnessVariation },
          uGlowIntensity: { value: this.config.glowIntensity },
          uOpacity: { value: this.config.opacity },
          uBreathingStrength: { value: this.config.breathingStrength },
          uTopMotionStrength: { value: this.config.topMotionStrength },
          uBottomMotionStrength: { value: this.config.bottomMotionStrength },
          uReducedMotion: { value: this.isReducedMotion ? 1 : 0 },
          uShowMask: { value: this.showMask ? 1 : 0 },
          uShowBounds: { value: this.showBounds ? 1 : 0 },
          uDebugView: { value: this.debugView },
        },
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });

      this.geometry = new THREE.PlaneGeometry(2, 2);
      this.scene.add(new THREE.Mesh(this.geometry, this.material));
      this.isReady = true;
      this.attachObservers();
      this.resize();
      this.renderFrame(0);
      this.callbacks.onReducedMotion(this.isReducedMotion);
      this.callbacks.onShaderTime(0);

      requestAnimationFrame(() => {
        if (!this.isDisposed) this.callbacks.onReady();
      });

      this.reconcileLoop();
    } catch {
      this.callbacks.onFailure();
    }
  }

  setConfig(nextConfig: AuroraConfig) {
    Object.assign(this.config, nextConfig);
    if (!this.material) return;

    const uniforms = this.material.uniforms;
    uniforms.uSpeed.value = this.config.speed;
    uniforms.uHorizontalDistortion.value = this.config.horizontalDistortion;
    uniforms.uVerticalDistortion.value = this.config.verticalDistortion;
    uniforms.uWaviness.value = this.config.waviness;
    uniforms.uVerticalFlow.value = this.config.verticalFlow;
    uniforms.uVerticalStretch.value = this.config.verticalStretch;
    uniforms.uNoiseScale.value = this.config.noiseScale;
    uniforms.uNoiseStrength.value = this.config.noiseStrength;
    uniforms.uNoiseEvolutionSpeed.value = this.config.noiseEvolutionSpeed;
    uniforms.uBrightness.value = this.config.brightness;
    uniforms.uBrightnessVariation.value = this.config.brightnessVariation;
    uniforms.uGlowIntensity.value = this.config.glowIntensity;
    uniforms.uOpacity.value = this.config.opacity;
    uniforms.uBreathingStrength.value = this.config.breathingStrength;
    uniforms.uTopMotionStrength.value = this.config.topMotionStrength;
    uniforms.uBottomMotionStrength.value = this.config.bottomMotionStrength;
    this.renderFrame(this.elapsed);
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    this.callbacks.onFps(0);
    this.reconcileLoop();
  }

  setShowMask(show: boolean) {
    this.showMask = show;
    if (!this.material) return;
    this.material.uniforms.uShowMask.value = show ? 1 : 0;
    this.renderFrame(this.elapsed);
  }

  setShowBounds(show: boolean) {
    this.showBounds = show;
    if (!this.material) return;
    this.material.uniforms.uShowBounds.value = show ? 1 : 0;
    this.renderFrame(this.elapsed);
  }

  setDebugView(view: number) {
    this.debugView = view;
    if (!this.material) return;
    this.material.uniforms.uDebugView.value = view;
    this.renderFrame(this.elapsed);
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
    this.geometry?.dispose();
    this.auroraTexture?.dispose();
    this.maskTexture?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureTexture(texture: THREE.Texture, colorSpace: THREE.ColorSpace) {
    texture.colorSpace = colorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.material.uniforms.uViewportAspect.value = width / height;
    this.renderFrame(this.elapsed);
  }

  private renderFrame(time: number) {
    if (!this.material || this.isDisposed) return;
    this.material.uniforms.uTime.value = time;
    this.renderer.render(this.scene, this.camera);
  }

  private tick = (now: number) => {
    this.frameId = null;
    if (!this.shouldAnimate()) return;

    const delta = this.lastFrame === 0 ? 0 : Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += delta * this.config.timeScale;
    this.renderFrame(this.elapsed);

    if (now - this.lastTimeReport >= 100) {
      this.callbacks.onShaderTime(this.elapsed);
      this.lastTimeReport = now;
    }

    this.fpsFrames += 1;
    if (this.fpsStarted === 0) this.fpsStarted = now;
    const fpsWindow = now - this.fpsStarted;
    if (fpsWindow >= 750) {
      this.callbacks.onFps(Math.round((this.fpsFrames * 1000) / fpsWindow));
      this.fpsStarted = now;
      this.fpsFrames = 0;
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

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
      this.renderFrame(this.elapsed);
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
    if (this.material) this.material.uniforms.uReducedMotion.value = event.matches ? 1 : 0;
    this.callbacks.onReducedMotion(event.matches);
    this.reconcileLoop();
  };

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.stopLoop();
    this.callbacks.onFailure();
  };
}

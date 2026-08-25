"use client";
/* eslint-disable @next/next/no-img-element -- DOM image layers must share the WebGL cover transform */

import { useCallback, useEffect, useRef, useState } from "react";
import GUI, { type NumberController } from "lil-gui";
import {
  AuroraCodepenScene,
  type AuroraCodepenMetrics,
} from "../aurora-codepen/AuroraCodepenScene";
import {
  DEFAULT_CODEPEN_AURORA_CONFIG,
  type CodepenAuroraConfig,
} from "../aurora-codepen/config";

const HERO = "/hero";

type CompositeMode = "composite" | "background" | "aurora";
type ShaderDebug = "normal" | "alpha" | "horizon" | "horizontal" | "curtains";

const DEBUG_VALUE: Record<ShaderDebug, number> = {
  normal: 0,
  alpha: 1,
  horizon: 2,
  horizontal: 3,
  curtains: 4,
};

const INITIAL_METRICS: AuroraCodepenMetrics = {
  fps: 0,
  dpr: 1,
  quality: "low",
  width: 0,
  height: 0,
  elapsed: 0,
};

type NumericConfigKey = {
  [Key in keyof CodepenAuroraConfig]-?: CodepenAuroraConfig[Key] extends number ? Key : never;
}[keyof CodepenAuroraConfig];

function enableHorizontalScrubbing(controller: NumberController, unitsPerPixel: number) {
  const input = controller.$input;
  input.classList.add("aurora-number-scrubber");
  input.title = "Drag left/right to adjust · Click to type · Hold Shift for fine control";
  input.setAttribute(
    "aria-description",
    "Drag left or right to adjust. Click to type an exact value. Hold Shift for fine control.",
  );

  let removeActiveListeners = () => {};

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;

    event.stopImmediatePropagation();
    removeActiveListeners();

    const startX = event.clientX;
    let previousX = startX;
    let dragging = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging && Math.abs(moveEvent.clientX - startX) < 3) return;

      dragging = true;
      moveEvent.preventDefault();
      input.blur();
      document.body.classList.add("is-scrubbing-aurora-number");
      window.getSelection()?.removeAllRanges();

      const precision = moveEvent.shiftKey ? 0.1 : 1;
      const deltaX = moveEvent.clientX - previousX;
      const currentValue = Number(controller.getValue());
      controller.setValue(currentValue + deltaX * unitsPerPixel * precision);
      previousX = moveEvent.clientX;
    };

    const finishDrag = () => {
      document.body.classList.remove("is-scrubbing-aurora-number");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", finishDrag);
      removeActiveListeners = () => {};
    };

    removeActiveListeners = finishDrag;
    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", finishDrag);
  };

  input.addEventListener("mousedown", handleMouseDown, { capture: true });

  return () => {
    input.removeEventListener("mousedown", handleMouseDown, { capture: true });
    removeActiveListeners();
  };
}

export function CodepenAuroraPrototype() {
  const webglHostRef = useRef<HTMLDivElement>(null);
  const guiHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AuroraCodepenScene | null>(null);
  const guiRef = useRef<GUI | null>(null);
  const configRef = useRef<CodepenAuroraConfig>({ ...DEFAULT_CODEPEN_AURORA_CONFIG });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [metrics, setMetrics] = useState<AuroraCodepenMetrics>(INITIAL_METRICS);
  const [compositeMode, setCompositeMode] = useState<CompositeMode>("composite");
  const [shaderDebug, setShaderDebug] = useState<ShaderDebug>("normal");
  const [showReference, setShowReference] = useState(false);
  const [referenceOpacity, setReferenceOpacity] = useState(0.5);
  const [compareSplit, setCompareSplit] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [interfaceHidden, setInterfaceHidden] = useState(false);

  const updateShaderDebug = useCallback((mode: ShaderDebug) => {
    setShaderDebug(mode);
    setCompositeMode("composite");
    sceneRef.current?.setDebugMode(DEBUG_VALUE[mode]);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      sceneRef.current?.setPaused(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const nextConfig = { ...DEFAULT_CODEPEN_AURORA_CONFIG };
    if (window.innerWidth <= 600) nextConfig.quality = "low";
    Object.assign(configRef.current, nextConfig);
    sceneRef.current?.setConfig(configRef.current);
    sceneRef.current?.setDebugMode(0);
    guiRef.current?.controllersRecursive().forEach((controller) => controller.updateDisplay());
    setPaused(false);
    sceneRef.current?.setPaused(false);
    setCompositeMode("composite");
    setShaderDebug("normal");
    setShowReference(false);
    setReferenceOpacity(0.5);
    setCompareSplit(false);
    setSplitPosition(50);
    setInterfaceHidden(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA";

      if (event.key === "Escape" && interfaceHidden) {
        event.preventDefault();
        setInterfaceHidden(false);
      } else if (event.key.toLowerCase() === "h" && !isEditing) {
        event.preventDefault();
        setInterfaceHidden((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interfaceHidden]);

  useEffect(() => {
    const host = webglHostRef.current;
    if (!host) return;
    if (window.innerWidth <= 600) configRef.current.quality = "low";

    try {
      const scene = new AuroraCodepenScene(host, configRef.current, {
        onReady: () => setReady(true),
        onFailure: () => setFailed(true),
        onReducedMotion: setReducedMotion,
        onMetrics: (next) => {
          setMetrics((current) => ({
            ...next,
            fps: next.fps > 0 ? next.fps : current.fps,
          }));
        },
      });
      sceneRef.current = scene;
      void scene.init();

      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    } catch {
      queueMicrotask(() => setFailed(true));
    }
  }, []);

  useEffect(() => {
    const container = guiHostRef.current;
    if (!container || guiRef.current) return;
    const config = configRef.current;
    const gui = new GUI({ container, title: "ShaderToy aurora", width: 320 });
    guiRef.current = gui;
    const update = () => sceneRef.current?.setConfig(config);
    const scrubCleanups: Array<() => void> = [];
    const addNumber = (
      folder: GUI,
      property: NumericConfigKey,
      label: string,
      unitsPerPixel: number,
    ) => {
      const controller = folder.add(config, property) as NumberController;
      controller.name(label).onChange(update);
      scrubCleanups.push(enableHorizontalScrubbing(controller, unitsPerPixel));
      return controller;
    };

    const motion = gui.addFolder("AURORA / MOTION");
    addNumber(motion, "speed", "Speed", 0.01);
    addNumber(motion, "seed", "Noise Seed", 0.1);

    const position = gui.addFolder("AURORA / POSITION");
    addNumber(position, "offsetX", "Position X", 0.001);
    addNumber(position, "offsetY", "Position Y", 0.001);
    addNumber(position, "scaleX", "Scale X", 0.001);
    addNumber(position, "scaleY", "Scale Y", 0.001);
    addNumber(position, "width", "Width", 0.001);
    addNumber(position, "height", "Height", 0.001);
    addNumber(position, "centerX", "Center X", 0.001);

    const light = gui.addFolder("AURORA / LIGHT");
    addNumber(light, "intensity", "Intensity", 0.01);
    addNumber(light, "opacity", "Opacity", 0.001);
    addNumber(light, "alphaLow", "Alpha Low", 0.001);
    addNumber(light, "alphaHigh", "Alpha High", 0.001);
    light.addColor(config, "colorBase").name("Primary Color").onChange(update);
    light.addColor(config, "colorHigh").name("Secondary Color").onChange(update);
    addNumber(light, "colorMix", "Color Mix", 0.001);
    addNumber(light, "saturation", "Saturation", 0.001);

    const mask = gui.addFolder("AURORA / MASK");
    addNumber(mask, "horizonY", "Horizon Y", 0.001);
    addNumber(mask, "horizonFeather", "Horizon Feather", 0.001);
    addNumber(mask, "edgeFade", "Edge Fade", 0.001);
    addNumber(mask, "centerBias", "Center Bias", 0.001);
    mask.add(config, "useSkyMask").name("Landscape Mask").onChange(update);

    const curtains = gui.addFolder("AURORA / NIMITZ FIELD");
    addNumber(curtains, "noiseScale", "Curtain Scale", 0.001);
    addNumber(curtains, "warpStrength", "Warp Strength", 0.001);
    addNumber(curtains, "curtainSharpness", "Curtain Sharpness", 0.001);
    addNumber(curtains, "lineSharpness", "Line Sharpness", 0.01);
    addNumber(curtains, "bandCount", "Band Count", 0.05);
    addNumber(curtains, "bandAlignment", "Band Alignment", 0.005);
    addNumber(curtains, "bandStrength", "Band Strength", 0.005);
    addNumber(curtains, "bandSharpness", "Band Sharpness", 0.01);
    addNumber(curtains, "layerCount", "Depth Layers", 1);
    addNumber(curtains, "curtainHeight", "Curtain Height", 0.001);
    addNumber(curtains, "depthSpread", "Depth Spread", 0.0001);
    addNumber(curtains, "lowerGlow", "Lower Glow", 0.001);

    const render = gui.addFolder("RENDER");
    render.add(config, "quality", ["low", "medium", "high"]).name("Quality").onChange(update);
    render.add(config, "pixelRatio", 0.5, 2, 0.05).name("Pixel Ratio").onChange(update);
    render.add(config, "dithering", 0, 0.08, 0.001).name("Dithering").onChange(update);

    const debugSettings = { referenceOpacity: 0.5 };
    const debugActions = {
      "Show Reference": () => setShowReference((current) => !current),
      "Show Background Only": () => {
        setShaderDebug("normal");
        sceneRef.current?.setDebugMode(0);
        setCompositeMode("background");
      },
      "Show Aurora Only": () => {
        setCompositeMode("aurora");
        setShaderDebug("normal");
        sceneRef.current?.setDebugMode(0);
      },
      "Show Alpha": () => updateShaderDebug("alpha"),
      "Show Horizon Mask": () => updateShaderDebug("horizon"),
      "Show Horizontal Mask": () => updateShaderDebug("horizontal"),
      "Show Aurora Field": () => updateShaderDebug("curtains"),
      "Compare Split": () => setCompareSplit((current) => !current),
      Pause: () => togglePause(),
      "Hide All UI": () => setInterfaceHidden(true),
      "Hide GUI": () => setControlsVisible(false),
      Reset: () => resetAll(),
    };
    const debugFolder = gui.addFolder("DEBUG");
    debugFolder.add(debugSettings, "referenceOpacity", 0, 1, 0.01).name("Reference Opacity").onChange(setReferenceOpacity);
    Object.keys(debugActions).forEach((key) => {
      debugFolder.add(debugActions, key as keyof typeof debugActions);
    });

    position.close();
    light.close();
    mask.close();
    render.close();
    debugFolder.close();

    return () => {
      scrubCleanups.forEach((cleanup) => cleanup());
      gui.destroy();
      guiRef.current = null;
    };
  }, [resetAll, togglePause, updateShaderDebug]);

  const status = failed
    ? "Static fallback"
    : reducedMotion
      ? "Reduced motion"
      : paused
        ? "Paused"
        : ready
          ? "Volumetric motion"
          : "Loading shader";

  return (
    <main className="codepen-prototype-shell">
      <section
        className={`codepen-aurora-hero is-${compositeMode} ${ready && !failed ? "is-ready" : ""} ${interfaceHidden ? "is-interface-hidden" : ""}`}
        data-ready={ready && !failed}
        data-paused={paused}
        data-composite-mode={compositeMode}
        data-shader-debug={shaderDebug}
        data-elapsed={metrics.elapsed.toFixed(2)}
        data-fps={metrics.fps}
        data-resolution={`${metrics.width}x${metrics.height}`}
        data-interface-hidden={interfaceHidden}
        onDoubleClick={() => {
          if (interfaceHidden) setInterfaceHidden(false);
        }}
        aria-label="ShaderToy-based procedural northern lights prototype"
      >
        <img
          className="codepen-hero-layer codepen-background"
          src={`${HERO}/02-background-clean.png`}
          alt="Snow-covered mountain valley beneath a clear starry sky"
        />

        <div ref={webglHostRef} className="codepen-webgl-layer" aria-hidden="true" />

        {failed && (
          <img
            className="codepen-hero-layer codepen-static-fallback"
            src={`${HERO}/01-reference.png`}
            alt="Northern lights above a snow-covered mountain lake"
          />
        )}

        {showReference && !compareSplit && (
          <img
            className="codepen-hero-layer codepen-reference-overlay"
            src={`${HERO}/01-reference.png`}
            alt=""
            aria-hidden="true"
            style={{ opacity: referenceOpacity }}
          />
        )}

        {compareSplit && (
          <>
            <div
              className="codepen-split-reference"
              style={{ width: `${splitPosition}%` }}
              aria-hidden="true"
            >
              <img
                className="codepen-hero-layer"
                src={`${HERO}/01-reference.png`}
                alt=""
              />
            </div>
            <span className="codepen-split-divider" style={{ left: `${splitPosition}%` }} />
            <label className="codepen-split-control">
              <span>Reference / generated split</span>
              <input
                type="range"
                min="5"
                max="95"
                value={splitPosition}
                onChange={(event) => setSplitPosition(Number(event.target.value))}
              />
            </label>
          </>
        )}

        <header className="prototype-heading codepen-heading">
          <p className="eyebrow">Nimitz ShaderToy · transparent adaptation</p>
          <h1>Aurora<br />volumetric study</h1>
        </header>

        <a className="codepen-ab-link" href="/aurora-prototype">
          Current implementation
        </a>

        <div className="codepen-performance" aria-live="polite">
          <span className={`status-dot ${paused || reducedMotion || failed ? "is-idle" : ""}`} />
          <span>{status}</span>
          <span>{metrics.fps || "—"} FPS</span>
          <span>{metrics.dpr.toFixed(2)} DPR</span>
          <span>{metrics.quality}</span>
          <span>{metrics.width || "—"}×{metrics.height || "—"}</span>
        </div>

        <nav className="codepen-toolbar" aria-label="ShaderToy prototype controls">
          <button type="button" className="hud-button hud-button-primary" onClick={togglePause}>
            {paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className={`hud-button ${compositeMode === "background" ? "is-active" : ""}`}
            onClick={() => {
              setShaderDebug("normal");
              sceneRef.current?.setDebugMode(0);
              setCompositeMode("background");
            }}
          >
            Background only
          </button>
          <button
            type="button"
            className={`hud-button ${compositeMode === "composite" && shaderDebug === "normal" ? "is-active" : ""}`}
            onClick={() => updateShaderDebug("normal")}
          >
            Aurora on
          </button>
          <button
            type="button"
            className={`hud-button ${showReference ? "is-active" : ""}`}
            onClick={() => setShowReference((current) => !current)}
          >
            Show reference
          </button>
          <button
            type="button"
            className={`hud-button ${compareSplit ? "is-active" : ""}`}
            onClick={() => setCompareSplit((current) => !current)}
          >
            Compare split
          </button>
          <button
            type="button"
            className="hud-button"
            onClick={() => setInterfaceHidden(true)}
            title="Restore with Esc, H, or double-click"
          >
            Hide all UI
          </button>
          <button type="button" className="hud-button" onClick={() => setControlsVisible((current) => !current)}>
            {controlsVisible ? "Hide GUI" : "Tune"}
          </button>
        </nav>

        <aside
          ref={guiHostRef}
          className={`gui-host codepen-gui-host ${controlsVisible ? "is-visible" : ""}`}
          aria-label="ShaderToy aurora controls"
        />

        <p className="codepen-prototype-note">
          Transparent WebGL · Nimitz aurora field · project sky preserved
        </p>
      </section>
    </main>
  );
}

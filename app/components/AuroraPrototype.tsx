"use client";
/* eslint-disable @next/next/no-img-element -- raw layers keep CSS and WebGL cover transforms identical */

import { useCallback, useEffect, useRef, useState } from "react";
import GUI from "lil-gui";
import { AuroraScene } from "../aurora/AuroraScene";
import { DEFAULT_AURORA_CONFIG, type AuroraConfig } from "../aurora/config";

const HERO = "/hero";

type DebugState = {
  view: DebugView;
  showReference: boolean;
  showMask: boolean;
  showBounds: boolean;
};

type DebugView = "normal" | "motionMask" | "geometryNoise" | "brightnessNoise" | "uvDistortion";

const INITIAL_DEBUG_STATE: DebugState = {
  view: "normal",
  showReference: false,
  showMask: false,
  showBounds: false,
};

const DEBUG_VIEWS: Array<{ id: DebugView; label: string; value: number }> = [
  { id: "normal", label: "NORMAL", value: 0 },
  { id: "motionMask", label: "SHOW MOTION MASK", value: 1 },
  { id: "geometryNoise", label: "SHOW GEOMETRY NOISE", value: 2 },
  { id: "brightnessNoise", label: "SHOW BRIGHTNESS NOISE", value: 3 },
  { id: "uvDistortion", label: "SHOW UV DISTORTION X10", value: 4 },
];

function debugViewValue(view: DebugView) {
  return DEBUG_VIEWS.find((item) => item.id === view)?.value ?? 0;
}

export function AuroraPrototype() {
  const hostRef = useRef<HTMLDivElement>(null);
  const guiHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AuroraScene | null>(null);
  const guiRef = useRef<GUI | null>(null);
  const configRef = useRef<AuroraConfig>({ ...DEFAULT_AURORA_CONFIG });
  const telemetryRef = useRef({ shaderTime: 0 });
  const debugRef = useRef<DebugState>({ ...INITIAL_DEBUG_STATE });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fps, setFps] = useState(0);
  const [shaderTime, setShaderTime] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [debug, setDebug] = useState<DebugState>({ ...INITIAL_DEBUG_STATE });

  const applyDebug = useCallback((next: Partial<DebugState>) => {
    setDebug((current) => {
      const merged = { ...current, ...next };
      debugRef.current = merged;
      if (next.showMask !== undefined) sceneRef.current?.setShowMask(merged.showMask);
      if (next.showBounds !== undefined) sceneRef.current?.setShowBounds(merged.showBounds);
      if (next.view !== undefined) sceneRef.current?.setDebugView(debugViewValue(merged.view));
      return merged;
    });
  }, []);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      sceneRef.current?.setPaused(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let scene: AuroraScene;
    try {
      scene = new AuroraScene(host, configRef.current, {
        onReady: () => {
          const currentDebug = debugRef.current;
          sceneRef.current?.setShowMask(currentDebug.showMask);
          sceneRef.current?.setShowBounds(currentDebug.showBounds);
          sceneRef.current?.setDebugView(debugViewValue(currentDebug.view));
          setReady(true);
        },
        onFailure: () => setFailed(true),
        onFps: setFps,
        onReducedMotion: setReducedMotion,
        onShaderTime: (time) => {
          telemetryRef.current.shaderTime = time;
          setShaderTime(time);
        },
      });
      sceneRef.current = scene;
      void scene.init();
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = guiHostRef.current;
    if (!container || guiRef.current) return;

    const config = configRef.current;
    const gui = new GUI({ container, title: "Aurora tuning", width: 318 });
    guiRef.current = gui;

    const update = () => sceneRef.current?.setConfig(config);
    const animation = gui.addFolder("Animation");
    animation.add(config, "speed", 0, 0.4, 0.001).name("Speed").onChange(update);
    animation.add(config, "timeScale", 0, 5, 0.01).name("Time scale").onChange(update);
    animation
      .add(config, "noiseEvolutionSpeed", 0, 2, 0.01)
      .name("Evolution speed")
      .onChange(update);
    animation
      .add(telemetryRef.current, "shaderTime")
      .name("Elapsed shader time")
      .decimals(2)
      .disable()
      .listen();

    const geometry = gui.addFolder("Geometry / distortion");
    geometry
      .add(config, "horizontalDistortion", 0, 0.06, 0.0001)
      .name("Horizontal")
      .onChange(update);
    geometry
      .add(config, "verticalDistortion", 0, 0.09, 0.0001)
      .name("Vertical")
      .onChange(update);
    geometry.add(config, "waviness", 0, 0.4, 0.001).name("Waviness").onChange(update);
    geometry.add(config, "verticalFlow", 0, 0.5, 0.001).name("Vertical flow").onChange(update);
    geometry
      .add(config, "verticalStretch", 0, 0.14, 0.001)
      .name("Vertical stretch")
      .onChange(update);
    geometry
      .add(config, "bottomMotionStrength", 0, 0.2, 0.001)
      .name("Bottom motion")
      .onChange(update);
    geometry
      .add(config, "topMotionStrength", 0, 1.5, 0.01)
      .name("Top motion")
      .onChange(update);

    const noise = gui.addFolder("Noise");
    noise.add(config, "noiseScale", 0.5, 5, 0.01).name("Scale").onChange(update);
    noise.add(config, "noiseStrength", 0, 1.5, 0.01).name("Strength").onChange(update);

    const light = gui.addFolder("Light");
    light.add(config, "brightness", 0.75, 1.2, 0.001).name("Brightness").onChange(update);
    light
      .add(config, "brightnessVariation", 0, 0.4, 0.001)
      .name("Brightness flow")
      .onChange(update);
    light.add(config, "glowIntensity", 0, 0.65, 0.001).name("Glow").onChange(update);
    light.add(config, "opacity", 0.5, 1, 0.001).name("Opacity").onChange(update);
    light
      .add(config, "breathingStrength", 0, 0.08, 0.001)
      .name("Breathing")
      .onChange(update);

    const debugState = {
      view: "NORMAL",
      reference: false,
      mask: false,
      bounds: false,
    };
    const diagnostics = gui.addFolder("Diagnostics");
    diagnostics
      .add(debugState, "view", DEBUG_VIEWS.map((item) => item.label))
      .name("Debug view")
      .onChange((label: string) => {
        const nextView = DEBUG_VIEWS.find((item) => item.label === label)?.id ?? "normal";
        applyDebug({ view: nextView });
      });
    diagnostics
      .add(debugState, "reference")
      .name("Show reference")
      .onChange((value: boolean) => applyDebug({ showReference: value }));
    diagnostics
      .add(debugState, "mask")
      .name("Show mask")
      .onChange((value: boolean) => applyDebug({ showMask: value }));
    diagnostics
      .add(debugState, "bounds")
      .name("Aurora bounds")
      .onChange((value: boolean) => applyDebug({ showBounds: value }));

    const actions = {
      "Pause / play": () => togglePause(),
      "Reset defaults": () => {
        Object.assign(config, DEFAULT_AURORA_CONFIG);
        sceneRef.current?.setConfig(config);
        gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
      },
      "Hide controls": () => setControlsVisible(false),
    };
    gui.add(actions, "Pause / play");
    gui.add(actions, "Reset defaults");
    gui.add(actions, "Hide controls");
    geometry.close();
    noise.close();
    light.close();
    diagnostics.close();

    return () => {
      gui.destroy();
      guiRef.current = null;
    };
  }, [applyDebug, togglePause]);

  const status = failed
    ? "Static fallback"
    : reducedMotion
      ? "Reduced motion"
      : paused
        ? "Paused"
        : ready
          ? "Motion active"
          : "Loading source";

  return (
    <main className="prototype-shell">
      <section
        ref={hostRef}
        className={`aurora-stage ${ready && !failed ? "is-ready" : ""}`}
        data-debug-view={debug.view}
        data-paused={paused}
        aria-label="Animated northern lights visual prototype"
      >
        <img
          className="hero-layer hero-fallback"
          src={`${HERO}/01-reference.png`}
          alt="Northern lights above a snow-covered mountain lake"
        />
        <img
          className="hero-layer hero-background"
          src={`${HERO}/02-background-clean.png`}
          alt=""
          aria-hidden="true"
        />
        {debug.showReference && (
          <img
            className="hero-layer reference-overlay"
            src={`${HERO}/01-reference.png`}
            alt=""
            aria-hidden="true"
          />
        )}

        <header className="prototype-heading">
          <p className="eyebrow">Phase 2 · diagnostic motion</p>
          <h1>Aurora<br />motion study</h1>
        </header>

        <div className="status-cluster" aria-live="polite">
          <span className={`status-dot ${paused || reducedMotion || failed ? "is-idle" : ""}`} />
          <span>{status}</span>
          <span className="status-separator" />
          <span>{fps > 0 ? `${fps} FPS` : "— FPS"}</span>
          <span className="status-separator" />
          <span className="shader-time" data-shader-time={shaderTime.toFixed(2)}>
            T {shaderTime.toFixed(1)}s
          </span>
        </div>

        <nav className="debug-viewbar" aria-label="Shader diagnostic views">
          {DEBUG_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`hud-button debug-view-button ${debug.view === view.id ? "is-active" : ""}`}
              aria-pressed={debug.view === view.id}
              onClick={() => applyDebug({ view: view.id })}
            >
              {view.label}
            </button>
          ))}
        </nav>

        <nav className="prototype-toolbar" aria-label="Prototype controls">
          <button type="button" className="hud-button hud-button-primary" onClick={togglePause}>
            {paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className={`hud-button ${debug.showReference ? "is-active" : ""}`}
            aria-pressed={debug.showReference}
            onClick={() => applyDebug({ showReference: !debug.showReference })}
          >
            Reference 50%
          </button>
          <button
            type="button"
            className={`hud-button ${controlsVisible ? "is-active" : ""}`}
            aria-pressed={controlsVisible}
            onClick={() => setControlsVisible((value) => !value)}
          >
            Tune
          </button>
        </nav>

        <div
          ref={guiHostRef}
          className={`gui-host ${controlsVisible ? "is-visible" : ""}`}
          aria-hidden={!controlsVisible}
          inert={!controlsVisible}
        />

        <p className="prototype-note">Diagnostic values active · mask protected</p>
      </section>
    </main>
  );
}

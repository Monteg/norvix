"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import GUI, { type NumberController } from "lil-gui";
import {
  AuroraScene,
  type AuroraMetrics,
} from "../aurora-renderer/AuroraScene";
import {
  DEFAULT_AURORA_CONFIG,
  type AuroraConfig,
} from "../aurora-renderer/config";
import {
  DEFAULT_STAR_SKY_CONFIG,
  type StarSkyConfig,
} from "../star-sky/config";
import {
  createAuroraSettingsSnapshot,
  loadSavedAuroraSettings,
  parseAuroraSettingsJson,
  saveAuroraSettings,
  serializeAuroraSettings,
} from "../settings/savedAuroraSettings";
import { ProceduralStarSky } from "./ProceduralStarSky";

type CompositeMode = "composite" | "background" | "aurora";
type ShaderDebug = "normal" | "alpha" | "horizon" | "horizontal" | "curtains";
type SettingsStatus =
  | "idle"
  | "saved"
  | "loaded"
  | "reset"
  | "missing"
  | "exported"
  | "imported"
  | "invalid"
  | "failed";

const DEBUG_VALUE: Record<ShaderDebug, number> = {
  normal: 0,
  alpha: 1,
  horizon: 2,
  horizontal: 3,
  curtains: 4,
};

const INITIAL_METRICS: AuroraMetrics = {
  fps: 0,
  dpr: 1,
  quality: "low",
  width: 0,
  height: 0,
  elapsed: 0,
};

function createSettingsFilename(savedAt: number) {
  const timestamp = new Date(savedAt).toISOString().replace(/[:.]/g, "-");
  return `aurora-preset-${timestamp}.aurora.json`;
}

type NumericConfigKey = {
  [Key in keyof AuroraConfig]-?: AuroraConfig[Key] extends number ? Key : never;
}[keyof AuroraConfig];

type NumericStarSkyConfigKey = {
  [Key in keyof StarSkyConfig]-?: StarSkyConfig[Key] extends number ? Key : never;
}[keyof StarSkyConfig];

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

export function AuroraConfigurator() {
  const webglHostRef = useRef<HTMLDivElement>(null);
  const guiHostRef = useRef<HTMLDivElement>(null);
  const presetFileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<AuroraScene | null>(null);
  const guiRef = useRef<GUI | null>(null);
  const configRef = useRef<AuroraConfig>({ ...DEFAULT_AURORA_CONFIG });
  const starSkyConfigRef = useRef<StarSkyConfig>({ ...DEFAULT_STAR_SKY_CONFIG });
  const saveTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [metrics, setMetrics] = useState<AuroraMetrics>(INITIAL_METRICS);
  const [compositeMode, setCompositeMode] = useState<CompositeMode>("composite");
  const [shaderDebug, setShaderDebug] = useState<ShaderDebug>("normal");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [interfaceHidden, setInterfaceHidden] = useState(false);
  const [starSkyConfig, setStarSkyConfig] = useState<StarSkyConfig>({
    ...DEFAULT_STAR_SKY_CONFIG,
  });
  const [shootingStarTrigger, setShootingStarTrigger] = useState(0);
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>("idle");

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

  const showSettingsStatus = useCallback((status: Exclude<SettingsStatus, "idle">) => {
    setSettingsStatus(status);
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSettingsStatus("idle");
      saveTimerRef.current = null;
    }, 1800);
  }, []);

  const applySettings = useCallback(
    (auroraConfig: AuroraConfig, skyConfig: StarSkyConfig) => {
      Object.assign(configRef.current, auroraConfig);
      Object.assign(starSkyConfigRef.current, skyConfig);
      setStarSkyConfig({ ...skyConfig });
      sceneRef.current?.setConfig(configRef.current);
      guiRef.current?.controllersRecursive().forEach((controller) => controller.updateDisplay());
    },
    [],
  );

  const saveCurrentSettings = useCallback(() => {
    const saved = saveAuroraSettings(configRef.current, starSkyConfigRef.current);
    showSettingsStatus(saved ? "saved" : "failed");
  }, [showSettingsStatus]);

  const loadSavedSettings = useCallback(() => {
    const saved = loadSavedAuroraSettings();
    if (!saved) {
      showSettingsStatus("missing");
      return;
    }

    applySettings(saved.aurora, saved.sky);
    showSettingsStatus("loaded");
  }, [applySettings, showSettingsStatus]);

  const exportSettingsFile = useCallback(() => {
    const settings = createAuroraSettingsSnapshot(
      configRef.current,
      starSkyConfigRef.current,
    );
    const blob = new Blob([serializeAuroraSettings(settings)], {
      type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = createSettingsFilename(settings.savedAt);
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    showSettingsStatus("exported");
  }, [showSettingsStatus]);

  const openSettingsFilePicker = useCallback(() => {
    presetFileInputRef.current?.click();
  }, []);

  const importSettingsFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      try {
        if (file.size > 1_000_000) throw new Error("Preset file is too large");
        const settings = parseAuroraSettingsJson(await file.text(), {
          requireFormat: true,
        });
        if (!settings) throw new Error("Invalid preset file");
        applySettings(settings.aurora, settings.sky);
        showSettingsStatus("imported");
      } catch {
        showSettingsStatus("invalid");
      }
    },
    [applySettings, showSettingsStatus],
  );

  const resetAll = useCallback(() => {
    const nextConfig = { ...DEFAULT_AURORA_CONFIG };
    Object.assign(configRef.current, nextConfig);
    Object.assign(starSkyConfigRef.current, DEFAULT_STAR_SKY_CONFIG);
    setStarSkyConfig({ ...DEFAULT_STAR_SKY_CONFIG });
    sceneRef.current?.setConfig(configRef.current);
    sceneRef.current?.setDebugMode(0);
    guiRef.current?.controllersRecursive().forEach((controller) => controller.updateDisplay());
    setPaused(false);
    sceneRef.current?.setPaused(false);
    setCompositeMode("composite");
    setShaderDebug("normal");
    setInterfaceHidden(false);
    showSettingsStatus("reset");
  }, [showSettingsStatus]);

  useEffect(() => {
    const saved = loadSavedAuroraSettings();
    if (!saved) return;

    Object.assign(configRef.current, saved.aurora);
    Object.assign(starSkyConfigRef.current, saved.sky);
    queueMicrotask(() => setStarSkyConfig({ ...saved.sky }));
  }, []);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

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
    try {
      const scene = new AuroraScene(host, configRef.current, {
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
    const skyConfig = starSkyConfigRef.current;
    const gui = new GUI({ container, title: "Aurora settings", width: 320 });
    guiRef.current = gui;
    const update = () => sceneRef.current?.setConfig(config);
    const updateSky = () => setStarSkyConfig({ ...skyConfig });
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
    const addSkyNumber = (
      folder: GUI,
      property: NumericStarSkyConfigKey,
      label: string,
      unitsPerPixel: number,
    ) => {
      const controller = folder.add(skyConfig, property) as NumberController;
      controller.name(label).onChange(updateSky);
      scrubCleanups.push(enableHorizontalScrubbing(controller, unitsPerPixel));
      return controller;
    };

    const settingsActions = {
      "Reset Settings": () => resetAll(),
      "Load Settings": () => openSettingsFilePicker(),
      "Save Settings": () => exportSettingsFile(),
    };
    Object.keys(settingsActions).forEach((key) => {
      gui.add(settingsActions, key as keyof typeof settingsActions);
    });

    const skyGradient = gui.addFolder("SKY / GRADIENT");
    skyGradient.addColor(skyConfig, "skyTopColor").name("Top Color").onChange(updateSky);
    addSkyNumber(skyGradient, "skyTopOpacity", "Top Opacity", 0.005);
    skyGradient.addColor(skyConfig, "skyMiddleColor").name("Middle Color").onChange(updateSky);
    addSkyNumber(skyGradient, "skyMiddleOpacity", "Middle Opacity", 0.005);
    skyGradient.addColor(skyConfig, "skyBottomColor").name("Bottom Color").onChange(updateSky);
    addSkyNumber(skyGradient, "skyBottomOpacity", "Bottom Opacity", 0.005);
    addSkyNumber(skyGradient, "gradientMidpoint", "Gradient Midpoint", 0.001);
    skyGradient.addColor(skyConfig, "horizonGlowColor").name("Horizon Glow Color").onChange(updateSky);
    addSkyNumber(skyGradient, "horizonGlowPosition", "Glow Position", 0.001);
    addSkyNumber(skyGradient, "horizonGlowSize", "Glow Size", 0.001);
    addSkyNumber(skyGradient, "horizonGlowStrength", "Glow Strength", 0.005);
    addSkyNumber(skyGradient, "hazeStrength", "Haze Strength", 0.005);

    const skyStars = gui.addFolder("SKY / STARS");
    skyStars.addColor(skyConfig, "starPrimaryColor").name("Primary Color").onChange(updateSky);
    skyStars.addColor(skyConfig, "starSecondaryColor").name("Secondary Color").onChange(updateSky);
    addSkyNumber(skyStars, "starColorMix", "Color Mix", 0.005);
    addSkyNumber(skyStars, "starDensity", "Density", 0.01);
    addSkyNumber(skyStars, "starBrightness", "Brightness", 0.01);
    addSkyNumber(skyStars, "starSize", "Size", 0.01);
    addSkyNumber(skyStars, "starStartY", "Field Start Y", 0.001);
    addSkyNumber(skyStars, "starFadeStartY", "Fade Start Y", 0.001);
    addSkyNumber(skyStars, "starFadeEndY", "Fade End Y", 0.001);
    addSkyNumber(skyStars, "twinkleAmount", "Twinkle Amount", 0.01);
    addSkyNumber(skyStars, "twinkleSpeed", "Twinkle Speed", 0.01);

    const shootingStar = gui.addFolder("SKY / SHOOTING STAR");
    shootingStar.add(skyConfig, "shootingStarEnabled").name("Enabled").onChange(updateSky);
    shootingStar.addColor(skyConfig, "shootingStarColor").name("Color").onChange(updateSky);
    addSkyNumber(shootingStar, "shootingStarInterval", "Interval (sec)", 0.1);
    addSkyNumber(shootingStar, "shootingStarBrightness", "Brightness", 0.01);
    addSkyNumber(shootingStar, "shootingStarSpeed", "Speed", 5);
    addSkyNumber(shootingStar, "shootingStarLength", "Trail Length", 1);
    addSkyNumber(shootingStar, "shootingStarAngle", "Angle", 0.5);
    addSkyNumber(shootingStar, "shootingStarThickness", "Thickness", 0.01);
    const shootingStarActions = {
      "Launch Now": () => setShootingStarTrigger((current) => current + 1),
    };
    shootingStar.add(shootingStarActions, "Launch Now");

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

    const curtains = gui.addFolder("AURORA / FIELD");
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

    const debugActions = {
      "Show Starfield Only": () => {
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
      Pause: () => togglePause(),
      "Save to Default": () => saveCurrentSettings(),
      "Load Default Settings": () => loadSavedSettings(),
      "Open Live View": () => window.open("/", "_blank", "noopener"),
      "Hide All UI": () => setInterfaceHidden(true),
      "Hide GUI": () => setControlsVisible(false),
    };
    const debugFolder = gui.addFolder("DEBUG");
    Object.keys(debugActions).forEach((key) => {
      debugFolder.add(debugActions, key as keyof typeof debugActions);
    });

    position.close();
    light.close();
    mask.close();
    skyStars.close();
    shootingStar.close();
    render.close();
    debugFolder.close();

    return () => {
      scrubCleanups.forEach((cleanup) => cleanup());
      gui.destroy();
      guiRef.current = null;
    };
  }, [
    exportSettingsFile,
    loadSavedSettings,
    openSettingsFilePicker,
    resetAll,
    saveCurrentSettings,
    togglePause,
    updateShaderDebug,
  ]);

  const status = failed
    ? "Static fallback"
    : reducedMotion
      ? "Reduced motion"
      : paused
        ? "Paused"
        : ready
          ? "Volumetric motion"
          : "Loading shader";

  const settingsButtonLabel: Record<SettingsStatus, string> = {
    idle: "Save to Default",
    saved: "Default saved",
    loaded: "Default loaded",
    reset: "Settings reset",
    missing: "No saved default",
    exported: "Settings downloaded",
    imported: "Settings loaded",
    invalid: "Invalid preset file",
    failed: "Save failed",
  };

  return (
    <main className="aurora-shell">
      <section
        className={`aurora-stage is-${compositeMode} ${ready && !failed ? "is-ready" : ""} ${interfaceHidden ? "is-interface-hidden" : ""}`}
        data-ready={ready && !failed}
        data-paused={paused}
        data-composite-mode={compositeMode}
        data-shader-debug={shaderDebug}
        data-elapsed={metrics.elapsed.toFixed(2)}
        data-fps={metrics.fps}
        data-resolution={`${metrics.width}x${metrics.height}`}
        data-interface-hidden={interfaceHidden}
        data-settings-status={settingsStatus}
        onDoubleClick={() => {
          if (interfaceHidden) setInterfaceHidden(false);
        }}
        aria-label="Procedural northern lights and starfield editor"
      >
        <ProceduralStarSky
          config={starSkyConfig}
          paused={paused || compositeMode === "aurora"}
          shootingStarTrigger={shootingStarTrigger}
        />

        <div ref={webglHostRef} className="aurora-webgl" aria-hidden="true" />

        <header className="aurora-heading">
          <p className="eyebrow">Procedural environment</p>
          <h1>Aurora<br />settings</h1>
        </header>

        <div className="aurora-performance" aria-live="polite">
          <span className={`status-dot ${paused || reducedMotion || failed ? "is-idle" : ""}`} />
          <span>{status}</span>
          <span>{metrics.fps || "—"} FPS</span>
          <span>{metrics.dpr.toFixed(2)} DPR</span>
          <span>{metrics.quality}</span>
          <span>{metrics.width || "—"}×{metrics.height || "—"}</span>
        </div>

        <nav className="aurora-toolbar" aria-label="Aurora controls">
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
            Starfield only
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
            className={`hud-button ${["saved", "loaded", "reset", "exported", "imported"].includes(settingsStatus) ? "is-active" : ""}`}
            onClick={saveCurrentSettings}
            title={
              settingsStatus === "failed"
                ? "Browser storage is unavailable"
                : settingsStatus === "invalid"
                  ? "The selected file is not a valid Aurora preset"
                : settingsStatus === "missing"
                  ? "No saved browser default exists yet"
                : "Save the current settings as the browser default and sync the clean view"
            }
          >
            {settingsButtonLabel[settingsStatus]}
          </button>
          <button
            type="button"
            className="hud-button"
            onClick={() => window.open("/", "_blank", "noopener")}
          >
            Open live view
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

        <input
          ref={presetFileInputRef}
          type="file"
          accept="application/json,.json,.aurora.json"
          hidden
          onChange={importSettingsFile}
        />

        <aside
          ref={guiHostRef}
          className={`gui-host aurora-gui-host ${controlsVisible ? "is-visible" : ""}`}
          aria-label="Aurora settings"
        />

        <p className="aurora-note">
          Procedural starfield · transparent aurora · adaptive rendering
        </p>
      </section>
    </main>
  );
}

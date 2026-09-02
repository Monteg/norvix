"use client";

import { useEffect, useRef, useState } from "react";
import { AuroraCodepenScene } from "../aurora-codepen/AuroraCodepenScene";
import {
  DEFAULT_CODEPEN_AURORA_CONFIG,
  type CodepenAuroraConfig,
} from "../aurora-codepen/config";
import {
  loadSavedAuroraSettings,
  subscribeToAuroraSettings,
} from "../settings/savedAuroraSettings";
import {
  DEFAULT_STAR_SKY_CONFIG,
  type StarSkyConfig,
} from "../star-sky/config";
import { ProceduralStarSky } from "./ProceduralStarSky";

export function CleanAuroraView() {
  const webglHostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [starSkyConfig, setStarSkyConfig] = useState<StarSkyConfig>({
    ...DEFAULT_STAR_SKY_CONFIG,
  });

  useEffect(() => {
    const host = webglHostRef.current;
    if (!host) return;

    const saved = loadSavedAuroraSettings();
    const auroraConfig: CodepenAuroraConfig = {
      ...(saved?.aurora ?? DEFAULT_CODEPEN_AURORA_CONFIG),
    };
    const initialSkyConfig: StarSkyConfig = {
      ...(saved?.sky ?? DEFAULT_STAR_SKY_CONFIG),
    };
    setStarSkyConfig(initialSkyConfig);

    let scene: AuroraCodepenScene | null = null;
    try {
      scene = new AuroraCodepenScene(host, auroraConfig, {
        onReady: () => setReady(true),
        onFailure: () => setReady(false),
        onReducedMotion: () => {},
        onMetrics: () => {},
      });
      void scene.init();
    } catch {
      queueMicrotask(() => setReady(false));
    }

    const unsubscribe = subscribeToAuroraSettings((settings) => {
      scene?.setConfig(settings.aurora);
      setStarSkyConfig({ ...settings.sky });
    });

    return () => {
      unsubscribe();
      scene?.dispose();
    };
  }, []);

  return (
    <main className="codepen-prototype-shell">
      <section
        className={`codepen-aurora-hero clean-aurora-view ${ready ? "is-ready" : ""}`}
        data-ready={ready}
        aria-label="Clean procedural northern lights and starfield view"
      >
        <ProceduralStarSky
          config={starSkyConfig}
          paused={false}
          shootingStarTrigger={0}
        />
        <div ref={webglHostRef} className="codepen-webgl-layer" aria-hidden="true" />
      </section>
    </main>
  );
}

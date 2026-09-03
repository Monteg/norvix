"use client";

import { useEffect, useRef, useState } from "react";
import { AuroraScene } from "../aurora-renderer/AuroraScene";
import {
  DEFAULT_AURORA_CONFIG,
  type AuroraConfig,
} from "../aurora-renderer/config";
import {
  loadSavedAuroraSettings,
  subscribeToAuroraSettings,
} from "../settings/savedAuroraSettings";
import {
  DEFAULT_STAR_SKY_CONFIG,
  type StarSkyConfig,
} from "../star-sky/config";
import { ProceduralStarSky } from "./ProceduralStarSky";

export function AuroraView() {
  const webglHostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [starSkyConfig, setStarSkyConfig] = useState<StarSkyConfig>({
    ...DEFAULT_STAR_SKY_CONFIG,
  });

  useEffect(() => {
    const host = webglHostRef.current;
    if (!host) return;

    const saved = loadSavedAuroraSettings();
    const auroraConfig: AuroraConfig = {
      ...(saved?.aurora ?? DEFAULT_AURORA_CONFIG),
    };
    const initialSkyConfig: StarSkyConfig = {
      ...(saved?.sky ?? DEFAULT_STAR_SKY_CONFIG),
    };
    setStarSkyConfig(initialSkyConfig);

    let scene: AuroraScene | null = null;
    try {
      scene = new AuroraScene(host, auroraConfig, {
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
    <main className="aurora-shell">
      <section
        className={`aurora-stage aurora-live-view ${ready ? "is-ready" : ""}`}
        data-ready={ready}
        aria-label="Procedural northern lights and starfield"
      >
        <ProceduralStarSky
          config={starSkyConfig}
          paused={false}
          shootingStarTrigger={0}
        />
        <div ref={webglHostRef} className="aurora-webgl" aria-hidden="true" />
      </section>
    </main>
  );
}

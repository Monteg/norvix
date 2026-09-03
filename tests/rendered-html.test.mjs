import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function renderRoute(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the clean aurora experience at the root", async () => {
  const response = await renderRoute();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Aurora<\/title>/i);
  assert.match(html, /aurora-live-view/);
  assert.match(html, /aurora-sky/);
  assert.match(html, /aurora-webgl/);
  assert.doesNotMatch(html, /<header|<nav|<button|<aside|\/hero\//i);
});

test("server-renders the separate settings route", async () => {
  const response = await renderRoute("/settings");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Aurora Settings<\/title>/i);
  assert.match(html, /Aurora[\s\S]*settings/i);
  assert.match(html, /Procedural starfield/i);
  assert.match(html, /Starfield only/);
  assert.match(html, /Save to Default/);
  assert.match(html, /Open live view/);
  assert.doesNotMatch(html, /\/hero\//i);
});

test("persists and broadcasts combined settings to the live view", async () => {
  const [configurator, liveView, savedSettings] = await Promise.all([
    readFile(new URL("../app/components/AuroraConfigurator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AuroraView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/savedAuroraSettings.ts", import.meta.url), "utf8"),
  ]);

  assert.match(configurator, /Reset Settings/);
  assert.match(configurator, /Load Settings/);
  assert.match(configurator, /Save Settings/);
  assert.match(configurator, /Save to Default/);
  assert.match(configurator, /Load Default Settings/);
  assert.match(configurator, /new Blob/);
  assert.match(configurator, /file\.text\(\)/);
  assert.match(configurator, /window\.open\("\/"/);
  assert.match(liveView, /loadSavedAuroraSettings/);
  assert.match(liveView, /subscribeToAuroraSettings/);
  assert.match(liveView, /scene\?\.setConfig\(settings\.aurora\)/);
  assert.doesNotMatch(liveView, /<header|<nav|<button|<aside/);
  assert.match(savedSettings, /aurora-motion-study:settings:v1/);
  assert.match(savedSettings, /aurora-motion-study-preset/);
  assert.match(savedSettings, /version:\s*1/);
  assert.match(savedSettings, /window\.localStorage\.setItem/);
  assert.match(savedSettings, /new BroadcastChannel/);
});

test("keeps the aurora transparent and adapts rendering to weak devices", async () => {
  const [scene, shaders, config, performance, configurator, starSky, styles, notices] =
    await Promise.all([
      readFile(new URL("../app/aurora-renderer/AuroraScene.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/aurora-renderer/shaders.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/aurora-renderer/config.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/performance.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/components/AuroraConfigurator.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/components/ProceduralStarSky.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"),
    ]);

  assert.match(scene, /alpha:\s*true/);
  assert.match(scene, /clearColor\(0, 0, 0, 0\)/);
  assert.match(scene, /blendFunc\(this\.gl\.SRC_ALPHA, this\.gl\.ONE_MINUS_SRC_ALPHA\)/);
  assert.match(scene, /effectiveQuality\(\)/);
  assert.match(scene, /performanceProfile\.auroraFps/);
  assert.match(scene, /performanceProfile\.auroraMaxDpr/);
  assert.match(scene, /adaptToMeasuredPerformance/);
  assert.match(scene, /this\.adaptiveQualityCap = currentQuality === "high" \? "medium" : "low"/);
  assert.match(scene, /qualityChanged \|\| pixelRatioChanged/);
  assert.match(scene, /width === this\.renderedWidth/);
  assert.match(scene, /getContext\("webgl"/);
  assert.doesNotMatch(scene, /from "three"/);
  assert.doesNotMatch(scene, /TextureLoader|DataTexture|skyMask|\/hero\//);
  assert.match(shaders, /vec4\(linearToSrgb\(auroraColor\), auroraAlpha\)/);
  assert.match(shaders, /transparentLuminance/);
  assert.doesNotMatch(shaders, /sampler2D|texture2D/);
  assert.match(config, /low:\s*\{ iterations:\s*24/);
  assert.match(config, /medium:\s*\{ iterations:\s*36/);
  assert.match(config, /high:\s*\{ iterations:\s*50/);
  assert.match(performance, /hardwareConcurrency/);
  assert.match(performance, /deviceMemory/);
  assert.match(performance, /saveData/);
  assert.match(performance, /capQuality/);
  assert.match(starSky, /performanceProfile\.starFps/);
  assert.match(starSky, /performanceProfile\.starMaxDpr/);
  assert.match(starSky, /performanceProfile\.maxStarSamples/);
  assert.match(starSky, /prefers-reduced-motion/);
  assert.match(starSky, /IntersectionObserver/);
  assert.match(configurator, /AURORA \/ FIELD/);
  assert.match(styles, /contain:\s*strict/);
  assert.doesNotMatch(styles, /hero-layer|reference-overlay/);
  assert.match(notices, /Attribution-NonCommercial-ShareAlike 3\.0/);
  assert.match(notices, /Nimitz/);
});

test("ships without bitmap runtime assets", async () => {
  await assert.rejects(access(new URL("../public/hero", import.meta.url)));
});

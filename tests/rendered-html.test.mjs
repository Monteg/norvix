import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function renderRoute(pathname = "/aurora-prototype") {
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

test("server-renders the aurora prototype shell", async () => {
  const response = await renderRoute();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Aurora Motion Study<\/title>/i);
  assert.match(html, /Aurora[\s\S]*motion study/i);
  assert.match(html, /\/hero\/01-reference\.png/);
  assert.match(html, /\/hero\/02-background-clean\.png/);
  assert.match(html, /Reference 50%/);
  assert.match(html, /Pause/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the neighboring ShaderToy aurora experiment", async () => {
  const response = await renderRoute("/aurora-codepen");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Nimitz Aurora Study<\/title>/i);
  assert.match(html, /Aurora[\s\S]*volumetric study/i);
  assert.match(html, /Procedural starfield/i);
  assert.match(html, /Starfield only/);
  assert.match(html, /Hide all UI/);
  assert.doesNotMatch(html, /\/hero\/|Show reference|Compare split/i);
});

test("server-renders the clean synchronized aurora view without interface", async () => {
  const response = await renderRoute("/aurora-clean");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Aurora Clean View<\/title>/i);
  assert.match(html, /clean-aurora-view/);
  assert.match(html, /codepen-procedural-sky/);
  assert.match(html, /codepen-webgl-layer/);
  assert.doesNotMatch(html, /<header|<nav|<button|<aside|\/hero\//i);
});

test("persists and broadcasts aurora and sky settings to the clean view", async () => {
  const [configurator, cleanView, savedSettings] = await Promise.all([
    readFile(new URL("../app/components/CodepenAuroraPrototype.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CleanAuroraView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/savedAuroraSettings.ts", import.meta.url), "utf8"),
  ]);

  assert.match(configurator, /saveCurrentSettings/);
  assert.match(configurator, /loadSavedSettings/);
  assert.doesNotMatch(configurator, /loadDefaultSettings/);
  assert.match(configurator, /Reset Settings/);
  assert.match(configurator, /Load Settings/);
  assert.match(configurator, /Save Settings/);
  assert.match(configurator, /Save to Default/);
  assert.match(configurator, /Load Default Settings/);
  assert.doesNotMatch(configurator, /Load Saved Settings/);
  assert.doesNotMatch(configurator, /Export Settings File/);
  assert.doesNotMatch(configurator, /Import Settings File/);
  assert.match(
    configurator,
    /const settingsActions = \{[\s\S]*?"Reset Settings"[\s\S]*?"Load Settings"[\s\S]*?"Save Settings"[\s\S]*?\};/,
  );
  assert.ok(
    configurator.indexOf("const settingsActions") <
      configurator.indexOf('gui.addFolder("SKY / GRADIENT")'),
  );
  assert.match(configurator, /new Blob/);
  assert.match(configurator, /URL\.createObjectURL/);
  assert.match(configurator, /file\.text\(\)/);
  assert.match(configurator, /accept="application\/json,\.json,\.aurora\.json"/);
  assert.match(configurator, /Open clean view/);
  assert.match(configurator, /loadSavedAuroraSettings/);
  assert.match(cleanView, /loadSavedAuroraSettings/);
  assert.match(cleanView, /subscribeToAuroraSettings/);
  assert.match(cleanView, /scene\?\.setConfig\(settings\.aurora\)/);
  assert.doesNotMatch(cleanView, /<header|<nav|<button|<aside/);
  assert.match(savedSettings, /aurora-motion-study:settings:v1/);
  assert.match(savedSettings, /aurora-motion-study-preset/);
  assert.match(savedSettings, /version:\s*1/);
  assert.match(savedSettings, /createAuroraSettingsSnapshot/);
  assert.match(savedSettings, /serializeAuroraSettings/);
  assert.match(savedSettings, /parseAuroraSettingsJson/);
  assert.match(savedSettings, /window\.localStorage\.setItem/);
  assert.match(savedSettings, /new BroadcastChannel/);
  assert.match(savedSettings, /window\.addEventListener\("storage"/);
  assert.match(savedSettings, /AURORA_SETTINGS_EVENT/);
});

test("keeps the Nimitz aurora transparent over a procedural starfield", async () => {
  const [scene, shaders, config, component, starSky, starConfig, license, styles] = await Promise.all([
    readFile(new URL("../app/aurora-codepen/AuroraCodepenScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/shaders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CodepenAuroraPrototype.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProceduralStarSky.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/star-sky/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/LICENSE.md", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /alpha:\s*true/);
  assert.match(scene, /setClearColor\(0x000000, 0\)/);
  assert.match(scene, /THREE\.NormalBlending/);
  assert.match(scene, /IntersectionObserver/);
  assert.match(scene, /prefers-reduced-motion/);
  assert.doesNotMatch(scene, /TextureLoader|DataTexture|skyMask|\/hero\//);
  assert.match(shaders, /renderNimitzAurora/);
  assert.match(shaders, /triangularCurtainNoise/);
  assert.match(shaders, /NIMITZ_ROTATION/);
  assert.doesNotMatch(shaders, /renderStarfield|paintBackdrop|uSkyDark|uSkyDeep/);
  assert.doesNotMatch(shaders, /uSkyMask|sampler2D|texture2D/);
  assert.match(shaders, /vec4\(auroraColor, auroraAlpha\)/);
  assert.match(config, /quality:\s*"high"/);
  assert.match(config, /speed:\s*2\.16/);
  assert.match(config, /offsetY:\s*0\.152/);
  assert.match(config, /noiseScale:\s*1/);
  assert.match(config, /curtainSharpness:\s*1/);
  assert.match(config, /lineSharpness:\s*1\.27/);
  assert.match(config, /bandCount:\s*64/);
  assert.match(config, /bandAlignment:\s*4/);
  assert.match(config, /bandStrength:\s*0\.825/);
  assert.match(config, /bandSharpness:\s*1\.06/);
  assert.match(config, /layerCount:\s*184/);
  assert.match(config, /depthSpread:\s*0\.0019/);
  assert.doesNotMatch(config, /useSkyMask/);
  assert.match(shaders, /transparentLuminance/);
  assert.match(shaders, /uLineSharpness/);
  assert.match(shaders, /pow\(normalizedCurtain, max\(uLineSharpness, 0\.05\)\)/);
  assert.match(shaders, /uBandCount/);
  assert.match(shaders, /mix\(looseBandCoordinate, depthMix, uBandAlignment\)/);
  assert.match(shaders, /uBandStrength/);
  assert.match(component, /Curtain Scale/);
  assert.match(component, /Curtain Sharpness/);
  assert.match(component, /Line Sharpness/);
  assert.match(component, /Band Count/);
  assert.match(component, /Band Alignment/);
  assert.match(component, /Band Strength/);
  assert.match(component, /Band Sharpness/);
  assert.match(component, /Warp Strength/);
  assert.match(component, /Depth Layers/);
  assert.match(component, /Curtain Height/);
  assert.match(component, /Depth Spread/);
  assert.match(component, /Lower Glow/);
  assert.match(component, /enableHorizontalScrubbing/);
  assert.match(component, /Drag left\/right to adjust/);
  assert.match(component, /folder\.add\(config, property\)/);
  assert.match(component, /addNumber\(motion, "speed", "Speed", 0\.01\)/);
  assert.match(component, /addNumber\(position, "width", "Width", 0\.001\)/);
  assert.match(component, /addNumber\(curtains, "lineSharpness", "Line Sharpness", 0\.01\)/);
  assert.match(component, /addNumber\(curtains, "bandCount", "Band Count", 0\.05\)/);
  assert.match(component, /render\.add\(config, "pixelRatio", 0\.5, 2, 0\.05\)/);
  assert.match(component, /Show Aurora Field/);
  assert.match(component, /Show Starfield Only/);
  assert.match(component, /ProceduralStarSky/);
  assert.match(component, /Procedural starfield/);
  assert.match(component, /SKY \/ GRADIENT/);
  assert.match(component, /SKY \/ STARS/);
  assert.match(component, /SKY \/ SHOOTING STAR/);
  assert.match(component, /Gradient Midpoint/);
  assert.match(component, /Top Opacity/);
  assert.match(component, /Middle Opacity/);
  assert.match(component, /Bottom Opacity/);
  assert.match(component, /Field Start Y/);
  assert.match(component, /Fade Start Y/);
  assert.match(component, /Fade End Y/);
  assert.match(component, /Twinkle Amount/);
  assert.match(component, /Interval \(sec\)/);
  assert.match(component, /Launch Now/);
  assert.match(component, /folder\.add\(skyConfig, property\)/);
  assert.doesNotMatch(component, /<img|\/hero\/|Show Reference|Compare Split/);
  assert.match(component, /Hide All UI/);
  assert.match(component, /Hide all UI/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key\.toLowerCase\(\) === "h"/);
  assert.match(component, /onDoubleClick/);
  assert.match(component, /data-interface-hidden/);
  assert.match(styles, /\.is-interface-hidden/);
  assert.match(styles, /\.codepen-gui-host/);
  assert.match(styles, /\.codepen-procedural-sky/);
  assert.match(styles, /linear-gradient\(180deg, #01040d/);
  assert.match(starSky, /mulberry32/);
  assert.match(starSky, /requestAnimationFrame/);
  assert.match(starSky, /twinkleDepth/);
  assert.match(starSky, /prefers-reduced-motion/);
  assert.match(starSky, /IntersectionObserver/);
  assert.match(starSky, /createSkyBackground/);
  assert.match(starSky, /rgba\(config\.skyTopColor, config\.skyTopOpacity\)/);
  assert.match(starSky, /rgba\(config\.skyMiddleColor, config\.skyMiddleOpacity\)/);
  assert.match(starSky, /rgba\(config\.skyBottomColor, config\.skyBottomOpacity\)/);
  assert.match(starSky, /starBrightness/);
  assert.match(starSky, /starStartY/);
  assert.match(starSky, /starFadeStartY/);
  assert.match(starSky, /shootingStarInterval/);
  assert.match(starSky, /createLinearGradient/);
  assert.match(starSky, /SHOOTING_FRAME_INTERVAL/);
  assert.match(starConfig, /DEFAULT_STAR_SKY_CONFIG/);
  assert.match(starConfig, /skyTopColor:\s*"#01040d"/);
  assert.match(starConfig, /skyTopOpacity:\s*1/);
  assert.match(starConfig, /skyMiddleOpacity:\s*1/);
  assert.match(starConfig, /skyBottomOpacity:\s*1/);
  assert.match(starConfig, /starBrightness:\s*1/);
  assert.match(starConfig, /starFadeStartY:\s*0\.72/);
  assert.match(starConfig, /shootingStarEnabled:\s*true/);
  assert.match(starConfig, /shootingStarInterval:\s*14/);
  assert.match(license, /Attribution-NonCommercial-ShareAlike 3\.0/);
  assert.match(license, /Nimitz/);
});

test("keeps the motion texture-driven, masked, and fallback-safe", async () => {
  const [scene, shaders, config, component] = await Promise.all([
    readFile(new URL("../app/aurora/AuroraScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora/shaders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AuroraPrototype.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /03-aurora\.png/);
  assert.match(scene, /04-sky-mask\.png/);
  assert.match(scene, /prefers-reduced-motion/);
  assert.match(scene, /visibilitychange/);
  assert.match(scene, /IntersectionObserver/);
  assert.match(shaders, /aurora\s*=\s*mix\(base, moved/);
  assert.match(shaders, /aurora\.a\s*\*=\s*mask/);
  assert.match(config, /speed:\s*0\.18/);
  assert.match(config, /timeScale:\s*1/);
  assert.match(shaders, /Curtain sway/);
  assert.match(shaders, /Vertical flow/);
  assert.match(shaders, /Light travel/);
  assert.match(component, /SHOW MOTION MASK/);
  assert.match(component, /SHOW UV DISTORTION X10/);
  assert.match(component, /01-reference\.png/);
  assert.match(component, /Static fallback/);

  for (const file of [
    "01-reference.png",
    "02-background-clean.png",
    "03-aurora.png",
    "04-sky-mask.png",
  ]) {
    await access(new URL(`../public/hero/${file}`, import.meta.url));
  }

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

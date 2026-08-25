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
  assert.match(html, /\/hero\/02-background-clean\.png/);
  assert.match(html, /Background only/);
  assert.match(html, /Compare split/);
  assert.match(html, /Hide all UI/);
});

test("keeps the Nimitz aurora transparent, masked, and independently licensed", async () => {
  const [scene, shaders, config, component, license, styles] = await Promise.all([
    readFile(new URL("../app/aurora-codepen/AuroraCodepenScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/shaders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CodepenAuroraPrototype.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/aurora-codepen/LICENSE.md", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /alpha:\s*true/);
  assert.match(scene, /setClearColor\(0x000000, 0\)/);
  assert.match(scene, /THREE\.NormalBlending/);
  assert.match(scene, /IntersectionObserver/);
  assert.match(scene, /prefers-reduced-motion/);
  assert.match(shaders, /renderNimitzAurora/);
  assert.match(shaders, /triangularCurtainNoise/);
  assert.match(shaders, /NIMITZ_ROTATION/);
  assert.doesNotMatch(shaders, /renderStarfield|paintBackdrop|uSkyDark|uSkyDeep/);
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
  assert.match(component, /Show Reference/);
  assert.match(component, /Show Aurora Field/);
  assert.match(component, /Show Background Only/);
  assert.match(component, /Hide All UI/);
  assert.match(component, /Hide all UI/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key\.toLowerCase\(\) === "h"/);
  assert.match(component, /onDoubleClick/);
  assert.match(component, /data-interface-hidden/);
  assert.match(styles, /\.is-interface-hidden/);
  assert.match(styles, /\.codepen-gui-host/);
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

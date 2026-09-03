"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { StarSkyConfig } from "../star-sky/config";

type ProceduralStarSkyProps = {
  config: StarSkyConfig;
  paused: boolean;
  shootingStarTrigger: number;
};

type Star = {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  phase: number;
  tone: number;
  twinkleDepth: number;
  twinkleSpeed: number;
  glow: boolean;
};

type ShootingStar = {
  startTime: number;
  duration: number;
  startX: number;
  startY: number;
  directionX: number;
  directionY: number;
};

const STAR_FRAME_INTERVAL = 1000 / 30;
const SHOOTING_FRAME_INTERVAL = 1000 / 60;
const TWO_PI = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(color: string): [number, number, number] {
  const value = color.trim().replace(/^#/, "");
  const normalized = value.length === 3
    ? value.split("").map((character) => `${character}${character}`).join("")
    : value;
  const parsed = Number.parseInt(normalized, 16);

  if (normalized.length !== 6 || Number.isNaN(parsed)) return [220, 235, 255];
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function mixRgb(
  primary: [number, number, number],
  secondary: [number, number, number],
  amount: number,
) {
  const mix = clamp(amount, 0, 1);
  return primary.map((channel, index) =>
    Math.round(channel + (secondary[index] - channel) * mix),
  ) as [number, number, number];
}

function rgba(color: string, alpha: number) {
  const [red, green, blue] = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function createSkyBackground(config: StarSkyConfig) {
  const midpoint = clamp(config.gradientMidpoint, 0.01, 0.99) * 100;
  const glowPosition = clamp(config.horizonGlowPosition, -1, 2) * 100;
  const glowSize = clamp(Math.abs(config.horizonGlowSize), 0.02, 2) * 100;
  const glowStrength = clamp(config.horizonGlowStrength, 0, 2);

  return [
    `radial-gradient(ellipse ${glowSize}% ${glowSize * 0.72}% at 50% ${glowPosition}%, ${rgba(config.horizonGlowColor, glowStrength)} 0%, ${rgba(config.horizonGlowColor, glowStrength * 0.42)} 38%, transparent 72%)`,
    `linear-gradient(180deg, ${rgba(config.skyTopColor, config.skyTopOpacity)} 0%, ${rgba(config.skyMiddleColor, config.skyMiddleOpacity)} ${midpoint}%, ${rgba(config.skyBottomColor, config.skyBottomOpacity)} 100%)`,
  ].join(", ");
}

function createStars(width: number, height: number) {
  const sizeSeed = (Math.round(width) * 73856093) ^ (Math.round(height) * 19349663);
  const random = mulberry32(0x4e4f5256 ^ sizeSeed);
  const baseCount = Math.round(Math.min(720, Math.max(260, (width * height) / 2500)));
  const maximumCount = Math.min(baseCount * 3, 1800);

  return Array.from({ length: maximumCount }, (): Star => {
    const bright = random() > 0.955;
    const radius = bright ? 0.9 + random() * 1.15 : 0.32 + random() * 0.62;

    return {
      x: random() * width,
      y: random() * height,
      radius,
      baseAlpha: bright ? 0.62 + random() * 0.28 : 0.24 + random() * 0.5,
      phase: random() * TWO_PI,
      tone: random(),
      twinkleDepth: 0.025 + random() * (bright ? 0.14 : 0.085),
      twinkleSpeed: 0.32 + random() * 0.82,
      glow: bright,
    };
  });
}

export function ProceduralStarSky({
  config,
  paused,
  shootingStarTrigger,
}: ProceduralStarSkyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef(config);
  const redrawRef = useRef<(() => void) | null>(null);
  const launchShootingStarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    configRef.current = config;
    redrawRef.current?.();
  }, [config]);

  useEffect(() => {
    if (shootingStarTrigger > 0) launchShootingStarRef.current?.();
  }, [shootingStarTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shootingRandom = mulberry32(0x53484f54);
    let stars: Star[] = [];
    let shootingStar: ShootingStar | null = null;
    let nextShootingAt = Number.POSITIVE_INFINITY;
    let cssWidth = 1;
    let cssHeight = 1;
    let frameId: number | null = null;
    let lastDraw = 0;
    let isIntersecting = true;
    let reducedMotion = motionQuery.matches;

    const scheduleShootingStar = (now: number) => {
      const interval = clamp(Math.abs(configRef.current.shootingStarInterval), 0.5, 180);
      nextShootingAt = now + interval * 1000 * (0.65 + shootingRandom() * 0.7);
    };

    const spawnShootingStar = (now: number) => {
      const settings = configRef.current;
      const angle = (settings.shootingStarAngle * Math.PI) / 180;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const speed = clamp(Math.abs(settings.shootingStarSpeed), 40, 4000);
      const length = clamp(Math.abs(settings.shootingStarLength), 4, 1200);
      const travel = Math.min(cssWidth, cssHeight) * 0.72 + length;

      shootingStar = {
        startTime: now,
        duration: clamp(travel / speed, 0.28, 2.2),
        startX: cssWidth * (-0.05 + shootingRandom() * 0.68),
        startY: cssHeight * (0.04 + shootingRandom() * 0.38),
        directionX,
        directionY,
      };
      nextShootingAt = Number.POSITIVE_INFINITY;
    };

    const drawShootingStar = (now: number) => {
      const settings = configRef.current;

      if (!settings.shootingStarEnabled || paused || reducedMotion) {
        shootingStar = null;
        scheduleShootingStar(now);
        return;
      }

      if (!shootingStar && now >= nextShootingAt) spawnShootingStar(now);
      if (!shootingStar) return;

      const progress = (now - shootingStar.startTime) / (shootingStar.duration * 1000);
      if (progress >= 1) {
        shootingStar = null;
        scheduleShootingStar(now);
        return;
      }

      const speed = clamp(Math.abs(settings.shootingStarSpeed), 40, 4000);
      const length = clamp(Math.abs(settings.shootingStarLength), 4, 1200);
      const distance = speed * ((now - shootingStar.startTime) / 1000);
      const headX = shootingStar.startX + shootingStar.directionX * distance;
      const headY = shootingStar.startY + shootingStar.directionY * distance;
      const tailX = headX - shootingStar.directionX * length;
      const tailY = headY - shootingStar.directionY * length;
      const lifeFade = smoothstep(0, 0.08, progress) * (1 - smoothstep(0.62, 1, progress));
      const brightness = clamp(settings.shootingStarBrightness, 0, 4) * lifeFade;
      const thickness = clamp(Math.abs(settings.shootingStarThickness), 0.2, 16);
      const trail = context.createLinearGradient(tailX, tailY, headX, headY);

      trail.addColorStop(0, rgba(settings.shootingStarColor, 0));
      trail.addColorStop(0.62, rgba(settings.shootingStarColor, brightness * 0.18));
      trail.addColorStop(0.9, rgba(settings.shootingStarColor, brightness * 0.72));
      trail.addColorStop(1, rgba(settings.shootingStarColor, brightness));

      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(headX, headY);
      context.strokeStyle = trail;
      context.lineWidth = thickness;
      context.lineCap = "round";
      context.shadowColor = rgba(settings.shootingStarColor, brightness * 0.8);
      context.shadowBlur = thickness * 5;
      context.stroke();
      context.shadowBlur = 0;

      context.beginPath();
      context.arc(headX, headY, thickness * 0.78, 0, TWO_PI);
      context.fillStyle = rgba(settings.shootingStarColor, brightness);
      context.fill();
    };

    const draw = (now: number) => {
      const settings = configRef.current;
      const primary = hexToRgb(settings.starPrimaryColor);
      const secondary = hexToRgb(settings.starSecondaryColor);
      const density = clamp(settings.starDensity, 0, 3);
      const visibleCount = Math.min(stars.length, Math.floor((stars.length * density) / 3));
      const brightness = clamp(settings.starBrightness, 0, 4);
      const starSize = clamp(Math.abs(settings.starSize), 0.05, 8);
      const twinkleAmount = clamp(settings.twinkleAmount, 0, 4);
      const twinkleSpeed = clamp(Math.abs(settings.twinkleSpeed), 0, 8);
      const fadeStart = Math.min(settings.starFadeStartY, settings.starFadeEndY - 0.0001);
      const fadeEnd = Math.max(settings.starFadeEndY, fadeStart + 0.0001);

      context.clearRect(0, 0, cssWidth, cssHeight);
      context.globalCompositeOperation = "screen";

      for (let index = 0; index < visibleCount; index += 1) {
        const star = stars[index];
        const normalizedY = star.y / cssHeight;
        const topReveal = smoothstep(settings.starStartY, settings.starStartY + 0.08, normalizedY);
        const bottomFade = 1 - smoothstep(fadeStart, fadeEnd, normalizedY);
        const verticalVisibility = topReveal * bottomFade;
        if (verticalVisibility <= 0.001) continue;

        const pulse = Math.sin(
          now * 0.001 * star.twinkleSpeed * twinkleSpeed + star.phase,
        );
        const alpha = clamp(
          star.baseAlpha * brightness * verticalVisibility *
            (1 + pulse * star.twinkleDepth * twinkleAmount),
          0,
          1,
        );
        const color = mixRgb(primary, secondary, star.tone * settings.starColorMix);
        const colorChannels = `${color[0]}, ${color[1]}, ${color[2]}`;
        const radius = star.radius * starSize;

        context.beginPath();
        context.arc(star.x, star.y, radius, 0, TWO_PI);
        context.fillStyle = `rgba(${colorChannels}, ${alpha})`;

        if (star.glow) {
          context.shadowColor = `rgba(${colorChannels}, ${Math.min(alpha * 0.72, 0.8)})`;
          context.shadowBlur = radius * 4.5;
        }

        context.fill();
        context.shadowBlur = 0;
      }

      drawShootingStar(now);
      context.globalCompositeOperation = "source-over";
    };

    redrawRef.current = () => draw(performance.now());

    const shouldAnimate = () => !paused && !reducedMotion && isIntersecting && !document.hidden;

    const tick = (now: number) => {
      frameId = null;
      if (!shouldAnimate()) return;

      const interval = shootingStar ? SHOOTING_FRAME_INTERVAL : STAR_FRAME_INTERVAL;
      if (now - lastDraw >= interval) {
        draw(now);
        lastDraw = now;
      }

      frameId = requestAnimationFrame(tick);
    };

    const reconcileLoop = () => {
      if (shouldAnimate()) {
        if (frameId === null) frameId = requestAnimationFrame(tick);
      } else {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        draw(performance.now());
      }
    };

    launchShootingStarRef.current = () => {
      shootingStar = null;
      nextShootingAt = performance.now();
      reconcileLoop();
    };

    const resize = () => {
      cssWidth = Math.max(canvas.clientWidth, 1);
      cssHeight = Math.max(canvas.clientHeight, 1);
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars(cssWidth, cssHeight);
      shootingStar = null;
      scheduleShootingStar(performance.now());
      draw(performance.now());
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        reconcileLoop();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    const handleVisibilityChange = () => reconcileLoop();
    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      reconcileLoop();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery.addEventListener("change", handleMotionPreference);
    resize();
    reconcileLoop();

    return () => {
      redrawRef.current = null;
      launchShootingStarRef.current = null;
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionQuery.removeEventListener("change", handleMotionPreference);
    };
  }, [paused]);

  const skyStyle = {
    background: createSkyBackground(config),
    "--sky-haze-opacity": clamp(config.hazeStrength, 0, 2),
  } as CSSProperties;

  return (
    <div className="codepen-procedural-sky" style={skyStyle} aria-hidden="true">
      <canvas ref={canvasRef} className="codepen-star-canvas" />
    </div>
  );
}

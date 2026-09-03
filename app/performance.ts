import type { AuroraQuality } from "./aurora-renderer/config";

export type PerformanceTier = "low" | "medium" | "high";

export type PerformanceProfile = {
  tier: PerformanceTier;
  maxQuality: AuroraQuality;
  auroraFps: number;
  auroraMaxDpr: number;
  starFps: number;
  shootingStarFps: number;
  starMaxDpr: number;
  maxStarSamples: number;
};

const PROFILES: Record<PerformanceTier, PerformanceProfile> = {
  low: {
    tier: "low",
    maxQuality: "low",
    auroraFps: 30,
    auroraMaxDpr: 0.9,
    starFps: 18,
    shootingStarFps: 30,
    starMaxDpr: 1,
    maxStarSamples: 1080,
  },
  medium: {
    tier: "medium",
    maxQuality: "medium",
    auroraFps: 45,
    auroraMaxDpr: 1.15,
    starFps: 24,
    shootingStarFps: 45,
    starMaxDpr: 1.25,
    maxStarSamples: 1440,
  },
  high: {
    tier: "high",
    maxQuality: "high",
    auroraFps: 60,
    auroraMaxDpr: 1.5,
    starFps: 30,
    shootingStarFps: 60,
    starMaxDpr: 1.5,
    maxStarSamples: 1800,
  },
};

const QUALITY_RANK: Record<AuroraQuality, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

type NavigatorWithPerformanceHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

export function detectPerformanceProfile(): PerformanceProfile {
  if (typeof window === "undefined") return PROFILES.high;

  const hints = navigator as NavigatorWithPerformanceHints;
  const cores = hints.hardwareConcurrency || 8;
  const memory = hints.deviceMemory;
  const viewportPixels = window.innerWidth * window.innerHeight;
  const highDensitySmallScreen =
    window.devicePixelRatio > 1.5 && Math.min(window.innerWidth, window.innerHeight) <= 820;

  if (
    hints.connection?.saveData ||
    cores <= 4 ||
    (memory !== undefined && memory <= 4) ||
    highDensitySmallScreen
  ) {
    return PROFILES.low;
  }

  if (
    cores <= 8 ||
    (memory !== undefined && memory < 8) ||
    viewportPixels > 2_600_000
  ) {
    return PROFILES.medium;
  }

  return PROFILES.high;
}

export function capQuality(
  requested: AuroraQuality,
  profile: PerformanceProfile,
): AuroraQuality {
  return QUALITY_RANK[requested] <= QUALITY_RANK[profile.maxQuality]
    ? requested
    : profile.maxQuality;
}

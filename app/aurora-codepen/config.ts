export type AuroraQuality = "low" | "medium" | "high";

export type CodepenAuroraConfig = {
  speed: number;
  seed: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  centerX: number;
  intensity: number;
  opacity: number;
  alphaLow: number;
  alphaHigh: number;
  colorBase: string;
  colorHigh: string;
  colorMix: number;
  saturation: number;
  horizonY: number;
  horizonFeather: number;
  edgeFade: number;
  centerBias: number;
  noiseScale: number;
  warpStrength: number;
  curtainSharpness: number;
  lineSharpness: number;
  bandCount: number;
  bandAlignment: number;
  bandStrength: number;
  bandSharpness: number;
  layerCount: number;
  curtainHeight: number;
  depthSpread: number;
  lowerGlow: number;
  pixelRatio: number;
  dithering: number;
  quality: AuroraQuality;
};

export const QUALITY_PRESETS: Record<
  AuroraQuality,
  { iterations: number; maxDpr: number }
> = {
  low: { iterations: 32, maxDpr: 1 },
  medium: { iterations: 42, maxDpr: 1.25 },
  high: { iterations: 50, maxDpr: 1.75 },
};

export const DEFAULT_CODEPEN_AURORA_CONFIG: CodepenAuroraConfig = {
  speed: 2.16,
  seed: 44.8,
  offsetX: 0.003,
  offsetY: 0.152,
  scaleX: 0.101,
  scaleY: 0.176,
  width: 0.97,
  height: 0.958,
  centerX: 0.63,
  intensity: 2.46,
  opacity: 0.921,
  alphaLow: -0.813,
  alphaHigh: 1.04,
  colorBase: "#75ffbd",
  colorHigh: "#7c6bff",
  colorMix: 0.588,
  saturation: 1.634,
  horizonY: 0.238,
  horizonFeather: -0.15,
  edgeFade: 20.131,
  centerBias: 0.283,
  noiseScale: 1,
  warpStrength: 1,
  curtainSharpness: 1,
  lineSharpness: 1.27,
  bandCount: 64,
  bandAlignment: 4,
  bandStrength: 0.825,
  bandSharpness: 1.06,
  layerCount: 184,
  curtainHeight: 0.803,
  depthSpread: 0.0019,
  lowerGlow: -1,
  pixelRatio: 1.25,
  dithering: 0,
  quality: "high",
};

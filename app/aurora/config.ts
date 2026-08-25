export type AuroraConfig = {
  speed: number;
  timeScale: number;
  horizontalDistortion: number;
  verticalDistortion: number;
  waviness: number;
  verticalFlow: number;
  verticalStretch: number;
  noiseScale: number;
  noiseStrength: number;
  noiseEvolutionSpeed: number;
  brightness: number;
  brightnessVariation: number;
  glowIntensity: number;
  opacity: number;
  breathingStrength: number;
  topMotionStrength: number;
  bottomMotionStrength: number;
};

export const DEFAULT_AURORA_CONFIG: AuroraConfig = {
  speed: 0.18,
  timeScale: 1,
  horizontalDistortion: 0.025,
  verticalDistortion: 0.04,
  waviness: 0.18,
  verticalFlow: 0.2,
  verticalStretch: 0.04,
  noiseScale: 2,
  noiseStrength: 1,
  noiseEvolutionSpeed: 1,
  brightness: 1,
  brightnessVariation: 0.2,
  glowIntensity: 0.2,
  opacity: 1,
  breathingStrength: 0.06,
  topMotionStrength: 1,
  bottomMotionStrength: 0.05,
};

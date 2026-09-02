import {
  DEFAULT_CODEPEN_AURORA_CONFIG,
  type CodepenAuroraConfig,
} from "../aurora-codepen/config";
import {
  DEFAULT_STAR_SKY_CONFIG,
  type StarSkyConfig,
} from "../star-sky/config";

export const AURORA_SETTINGS_STORAGE_KEY = "aurora-motion-study:settings:v1";
const AURORA_SETTINGS_CHANNEL = "aurora-motion-study-settings";
const AURORA_SETTINGS_EVENT = "aurora-motion-study:settings-saved";

export type SavedAuroraSettings = {
  version: 1;
  savedAt: number;
  aurora: CodepenAuroraConfig;
  sky: StarSkyConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergePrimitiveConfig<T extends object>(defaults: T, candidate: unknown): T {
  const source = isRecord(candidate) ? candidate : {};

  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const value = source[key];
      return [key, typeof value === typeof defaultValue ? value : defaultValue];
    }),
  ) as T;
}

export function parseSavedAuroraSettings(value: unknown): SavedAuroraSettings | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const aurora = mergePrimitiveConfig(DEFAULT_CODEPEN_AURORA_CONFIG, value.aurora);
  const sky = mergePrimitiveConfig(DEFAULT_STAR_SKY_CONFIG, value.sky);
  if (!(["low", "medium", "high"] as const).includes(aurora.quality)) {
    aurora.quality = DEFAULT_CODEPEN_AURORA_CONFIG.quality;
  }

  return {
    version: 1,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : Date.now(),
    aurora,
    sky,
  };
}

function parseSerializedSettings(serialized: string | null) {
  if (!serialized) return null;

  try {
    return parseSavedAuroraSettings(JSON.parse(serialized));
  } catch {
    return null;
  }
}

export function loadSavedAuroraSettings() {
  if (typeof window === "undefined") return null;

  try {
    return parseSerializedSettings(window.localStorage.getItem(AURORA_SETTINGS_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveAuroraSettings(
  auroraConfig: CodepenAuroraConfig,
  starSkyConfig: StarSkyConfig,
) {
  if (typeof window === "undefined") return false;

  const settings: SavedAuroraSettings = {
    version: 1,
    savedAt: Date.now(),
    aurora: mergePrimitiveConfig(DEFAULT_CODEPEN_AURORA_CONFIG, auroraConfig),
    sky: mergePrimitiveConfig(DEFAULT_STAR_SKY_CONFIG, starSkyConfig),
  };

  try {
    window.localStorage.setItem(AURORA_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    return false;
  }

  window.dispatchEvent(new CustomEvent(AURORA_SETTINGS_EVENT, { detail: settings }));

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(AURORA_SETTINGS_CHANNEL);
      channel.postMessage(settings);
      channel.close();
    }
  } catch {
    // localStorage still persists the preset and its storage event remains a fallback.
  }

  return true;
}

export function subscribeToAuroraSettings(
  onSettings: (settings: SavedAuroraSettings) => void,
) {
  if (typeof window === "undefined") return () => {};

  const deliver = (candidate: unknown) => {
    const settings = parseSavedAuroraSettings(candidate);
    if (settings) onSettings(settings);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AURORA_SETTINGS_STORAGE_KEY) return;
    const settings = parseSerializedSettings(event.newValue);
    if (settings) onSettings(settings);
  };

  const handleLocalSave = (event: Event) => {
    deliver((event as CustomEvent<unknown>).detail);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = "BroadcastChannel" in window
      ? new BroadcastChannel(AURORA_SETTINGS_CHANNEL)
      : null;
  } catch {
    channel = null;
  }
  if (channel) channel.onmessage = (event) => deliver(event.data);

  window.addEventListener("storage", handleStorage);
  window.addEventListener(AURORA_SETTINGS_EVENT, handleLocalSave);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(AURORA_SETTINGS_EVENT, handleLocalSave);
    channel?.close();
  };
}

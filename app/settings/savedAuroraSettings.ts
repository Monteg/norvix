import {
  DEFAULT_AURORA_CONFIG,
  type AuroraConfig,
} from "../aurora-renderer/config";
import {
  DEFAULT_STAR_SKY_CONFIG,
  type StarSkyConfig,
} from "../star-sky/config";

export const AURORA_SETTINGS_STORAGE_KEY = "aurora-motion-study:settings:v1";
export const AURORA_SETTINGS_FORMAT = "aurora-motion-study-preset";
const AURORA_SETTINGS_CHANNEL = "aurora-motion-study-settings";
const AURORA_SETTINGS_EVENT = "aurora-motion-study:settings-saved";

export type SavedAuroraSettings = {
  format: typeof AURORA_SETTINGS_FORMAT;
  version: 1;
  savedAt: number;
  aurora: AuroraConfig;
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
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.format !== undefined && value.format !== AURORA_SETTINGS_FORMAT) ||
    !isRecord(value.aurora) ||
    !isRecord(value.sky)
  ) {
    return null;
  }

  const aurora = mergePrimitiveConfig(DEFAULT_AURORA_CONFIG, value.aurora);
  const sky = mergePrimitiveConfig(DEFAULT_STAR_SKY_CONFIG, value.sky);
  if (!(["low", "medium", "high"] as const).includes(aurora.quality)) {
    aurora.quality = DEFAULT_AURORA_CONFIG.quality;
  }

  return {
    format: AURORA_SETTINGS_FORMAT,
    version: 1,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : Date.now(),
    aurora,
    sky,
  };
}

export function parseAuroraSettingsJson(
  serialized: string | null,
  options: { requireFormat?: boolean } = {},
) {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (
      options.requireFormat &&
      (!isRecord(parsed) || parsed.format !== AURORA_SETTINGS_FORMAT)
    ) {
      return null;
    }
    return parseSavedAuroraSettings(parsed);
  } catch {
    return null;
  }
}

export function createAuroraSettingsSnapshot(
  auroraConfig: AuroraConfig,
  starSkyConfig: StarSkyConfig,
): SavedAuroraSettings {
  return {
    format: AURORA_SETTINGS_FORMAT,
    version: 1,
    savedAt: Date.now(),
    aurora: mergePrimitiveConfig(DEFAULT_AURORA_CONFIG, auroraConfig),
    sky: mergePrimitiveConfig(DEFAULT_STAR_SKY_CONFIG, starSkyConfig),
  };
}

export function serializeAuroraSettings(settings: SavedAuroraSettings) {
  return JSON.stringify(settings, null, 2);
}

export function loadSavedAuroraSettings() {
  if (typeof window === "undefined") return null;

  try {
    return parseAuroraSettingsJson(window.localStorage.getItem(AURORA_SETTINGS_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveAuroraSettings(
  auroraConfig: AuroraConfig,
  starSkyConfig: StarSkyConfig,
) {
  if (typeof window === "undefined") return false;

  const settings = createAuroraSettingsSnapshot(auroraConfig, starSkyConfig);

  try {
    window.localStorage.setItem(
      AURORA_SETTINGS_STORAGE_KEY,
      serializeAuroraSettings(settings),
    );
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
    const settings = parseAuroraSettingsJson(event.newValue);
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

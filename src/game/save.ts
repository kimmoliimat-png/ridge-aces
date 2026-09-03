import type { FactionId, Settings } from "./types";

const KEY = "ridge-aces-save-v1";
export const SAVE_VERSION = 1;

export type SaveData = {
  version: number;
  settings: Settings;
  best: number;
  unlocked: Record<FactionId, number>;
};

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  invertPitch: false,
  sfx: 0.85,
  music: 0.35,
  shake: true,
  touch: "on",
};

const DEFAULT: SaveData = {
  version: SAVE_VERSION,
  settings: DEFAULT_SETTINGS,
  best: 0,
  unlocked: { westmere: 0, ironvale: 0, frostholm: 0, sunreach: 0 },
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as SaveData;
    return {
      ...DEFAULT,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      unlocked: { ...DEFAULT.unlocked, ...parsed.unlocked },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}

import { getDb } from "./db";

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  roundingEnabled: boolean;
  roundingStep: number;
  resellerMoq: number;
  pinHash: string | null;
  pinSalt: string | null;
  pinIsDefault: boolean;
  lastBackupAt: number;
  storeName: string;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  roundingEnabled: true,
  roundingStep: 500,
  resellerMoq: 24,
  pinHash: null,
  pinSalt: null,
  pinIsDefault: false,
  lastBackupAt: 0,
  storeName: "Toko Mas Andik",
  theme: "system",
};

const STORE_NAME_CACHE_KEY = "toko-store-name";

export function getCachedStoreName(): string {
  if (typeof window === "undefined") return DEFAULT_SETTINGS.storeName;
  try {
    return (
      window.localStorage.getItem(STORE_NAME_CACHE_KEY) ||
      DEFAULT_SETTINGS.storeName
    );
  } catch {
    return DEFAULT_SETTINGS.storeName;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await getDb().settings.toArray();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;

  const storeName = raw.storeName || DEFAULT_SETTINGS.storeName;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_NAME_CACHE_KEY, storeName);
    } catch {}
  }

  return {
    roundingEnabled: raw.roundingEnabled
      ? raw.roundingEnabled === "true"
      : DEFAULT_SETTINGS.roundingEnabled,
    roundingStep: raw.roundingStep
      ? Number(raw.roundingStep) || DEFAULT_SETTINGS.roundingStep
      : DEFAULT_SETTINGS.roundingStep,
    resellerMoq: raw.resellerMoq
      ? Number(raw.resellerMoq) || DEFAULT_SETTINGS.resellerMoq
      : DEFAULT_SETTINGS.resellerMoq,
    pinHash: raw.pinHash || null,
    pinSalt: raw.pinSalt || null,
    pinIsDefault: raw.pinIsDefault ? raw.pinIsDefault === "true" : false,
    lastBackupAt: raw.lastBackupAt ? Number(raw.lastBackupAt) : 0,
    storeName: raw.storeName || DEFAULT_SETTINGS.storeName,
    theme: (raw.theme as ThemeMode) || DEFAULT_SETTINGS.theme,
  };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  if (patch.storeName !== undefined && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_NAME_CACHE_KEY, patch.storeName);
    } catch {}
  }
  const entries = Object.entries(patch).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
  await getDb().settings.bulkPut(entries);
}
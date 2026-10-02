import { getDb } from "./db";

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  roundingEnabled: boolean;
  roundingStep: number;
  pinHash: string | null;
  pinSalt: string | null;
  pinIsDefault: boolean;
  lastBackupAt: number;
  storeName: string;
  appName: string;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  roundingEnabled: true,
  roundingStep: 500,
  pinHash: null,
  pinSalt: null,
  pinIsDefault: false,
  lastBackupAt: 0,
  storeName: "Toko Mas Andik",
  appName: "SuperSoy",
  theme: "system",
};

const STORE_NAME_CACHE_KEY = "toko-store-name";
const APP_NAME_CACHE_KEY = "toko-app-name";

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

export function getCachedAppName(): string {
  if (typeof window === "undefined") return DEFAULT_SETTINGS.appName;
  try {
    return (
      window.localStorage.getItem(APP_NAME_CACHE_KEY) ||
      DEFAULT_SETTINGS.appName
    );
  } catch {
    return DEFAULT_SETTINGS.appName;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await getDb().settings.toArray();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;

  const storeName = raw.storeName || DEFAULT_SETTINGS.storeName;
  const appName = raw.appName || DEFAULT_SETTINGS.appName;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_NAME_CACHE_KEY, storeName);
      window.localStorage.setItem(APP_NAME_CACHE_KEY, appName);
    } catch {}
  }

  return {
    roundingEnabled: raw.roundingEnabled
      ? raw.roundingEnabled === "true"
      : DEFAULT_SETTINGS.roundingEnabled,
    roundingStep: raw.roundingStep
      ? Number(raw.roundingStep) || DEFAULT_SETTINGS.roundingStep
      : DEFAULT_SETTINGS.roundingStep,
    pinHash: raw.pinHash || null,
    pinSalt: raw.pinSalt || null,
    pinIsDefault: raw.pinIsDefault ? raw.pinIsDefault === "true" : false,
    lastBackupAt: raw.lastBackupAt ? Number(raw.lastBackupAt) : 0,
    storeName: raw.storeName || DEFAULT_SETTINGS.storeName,
    appName: raw.appName || DEFAULT_SETTINGS.appName,
    theme: (raw.theme as ThemeMode) || DEFAULT_SETTINGS.theme,
  };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  if (patch.storeName !== undefined && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_NAME_CACHE_KEY, patch.storeName);
    } catch {}
  }
  if (patch.appName !== undefined && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(APP_NAME_CACHE_KEY, patch.appName);
    } catch {}
  }
  const entries = Object.entries(patch).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
  await getDb().settings.bulkPut(entries);
}
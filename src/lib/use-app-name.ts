"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getCachedAppName, getSettings } from "./settings";

export function useAppName(): string {
  const settings = useLiveQuery(() => getSettings(), [], null);
  return settings?.appName ?? getCachedAppName();
}

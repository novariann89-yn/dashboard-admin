import { startOfTodayWib, wibDateString } from "./format";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

export type PeriodPreset = "today" | "yesterday" | "week" | "month" | "day";

export interface Period {
  preset: PeriodPreset;
  from: number;
  to: number;
  label: string;
}

function wibStartOfDay(day?: string, now = new Date()): number {
  if (day) {
    const [year, month, date] = day.split("-").map(Number);
    if (year && month && date) {
      return Date.UTC(year, month - 1, date) - WIB_OFFSET_MS;
    }
  }
  return startOfTodayWib(now).getTime();
}

export function resolvePeriod(
  preset: PeriodPreset,
  day?: string,
  now = new Date(),
): Period {
  const today = wibStartOfDay(undefined, now);

  switch (preset) {
    case "today":
      return { preset, from: today, to: today + DAY_MS, label: "Hari ini" };
    case "yesterday":
      return {
        preset,
        from: today - DAY_MS,
        to: today,
        label: "Kemarin",
      };
    case "week":
      return {
        preset,
        from: today - 6 * DAY_MS,
        to: today + DAY_MS,
        label: "7 hari terakhir",
      };
    case "month": {
      const [year, month] = wibDateString(now).split("-").map(Number);
      return {
        preset,
        from: Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS,
        to: Date.UTC(year, month, 1) - WIB_OFFSET_MS,
        label: "Bulan ini",
      };
    }
    case "day": {
      const from = wibStartOfDay(day, now);
      return { preset, from, to: from + DAY_MS, label: day ?? "Tanggal" };
    }
  }
}

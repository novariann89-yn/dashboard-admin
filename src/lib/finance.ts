import { startOfTodayWib, wibDateString } from "./format";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "day"
  | "range";

export interface PeriodValue {
  preset: PeriodPreset;
  day?: string;
  from?: string;
  to?: string;
}

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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function shortDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return `${date} ${MONTHS[month - 1]}`;
}

export function resolvePeriod(value: PeriodValue, now = new Date()): Period {
  const today = wibStartOfDay(undefined, now);

  switch (value.preset) {
    case "today":
      return { preset: "today", from: today, to: today + DAY_MS, label: "Hari ini" };
    case "yesterday":
      return {
        preset: "yesterday",
        from: today - DAY_MS,
        to: today,
        label: "Kemarin",
      };
    case "week":
      return {
        preset: "week",
        from: today - 6 * DAY_MS,
        to: today + DAY_MS,
        label: "7 hari terakhir",
      };
    case "month": {
      const [year, month] = wibDateString(now).split("-").map(Number);
      return {
        preset: "month",
        from: Date.UTC(year, month - 1, 1) - WIB_OFFSET_MS,
        to: Date.UTC(year, month, 1) - WIB_OFFSET_MS,
        label: "Bulan ini",
      };
    }
    case "day": {
      const from = wibStartOfDay(value.day, now);
      return { preset: "day", from, to: from + DAY_MS, label: value.day ?? "Tanggal" };
    }
    case "range": {
      if (!value.from || !value.to) {
        return { preset: "range", from: today, to: today + DAY_MS, label: "Hari ini" };
      }
      const start = value.from <= value.to ? value.from : value.to;
      const end = value.from <= value.to ? value.to : value.from;
      return {
        preset: "range",
        from: wibStartOfDay(start, now),
        to: wibStartOfDay(end, now) + DAY_MS,
        label:
          start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`,
      };
    }
  }
}

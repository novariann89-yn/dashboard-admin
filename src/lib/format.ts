const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toDate(value: Date | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function startOfTodayWib(now = new Date()): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS,
  );
}

export function startOfWeekWib(now = new Date()): Date {
  const today = startOfTodayWib(now);
  const wib = new Date(today.getTime() + WIB_OFFSET_MS);
  const day = wib.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(today.getTime() - diff * 24 * 60 * 60 * 1000);
}

export function rupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(value))}`;
}

export function formatDateTime(value: Date | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: Date | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
  }).format(date);
}

export function formatTime(value: Date | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isTodayWib(
  value: Date | number,
  now: Date = new Date(),
): boolean {
  const date = toDate(value);
  if (!date) return false;
  const start = startOfTodayWib(now);
  return date.getTime() >= start.getTime() && date.getTime() < start.getTime() + 86400000;
}

export function wibDateString(value: Date | number = new Date()): string {
  const date = toDate(value) ?? new Date();
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`;
}

export function daysBetween(from: number, to = Date.now()): number {
  return Math.max(0, Math.floor((to - from) / 86400000));
}
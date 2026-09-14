const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

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
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
  }).format(date);
}

function wibParts(date: Date): [number, number, number, number, number] {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return [
    wib.getUTCFullYear(),
    wib.getUTCMonth() + 1,
    wib.getUTCDate(),
    wib.getUTCHours(),
    wib.getUTCMinutes(),
  ];
}

const pad = (value: number) => String(value).padStart(2, "0");

export function csvDate(date: Date | null | undefined): string {
  if (!date) return "";
  const [year, month, day] = wibParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function csvDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const [year, month, day, hour, minute] = wibParts(date);
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

export function parseWibDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute) - WIB_OFFSET_MS,
  );

  const [y, mo, d, h, mi] = wibParts(date);
  if (y !== year || mo !== month || d !== day || h !== hour || mi !== minute) {
    return null;
  }

  return date;
}
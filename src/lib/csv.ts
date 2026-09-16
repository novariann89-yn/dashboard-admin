export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue, delimiter = ";"): string {
  const text = value === null || value === undefined ? "" : String(value);
  const needsQuotes =
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");
  if (!needsQuotes) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvValue[][], delimiter = ";"): string {
  return rows
    .map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter))
    .join("\r\n");
}

export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const body = "\uFEFF" + toCsv(rows) + "\r\n";
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
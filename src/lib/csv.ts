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

export function csvResponse(filename: string, rows: CsvValue[][]): Response {
  const body = "\uFEFF" + toCsv(rows) + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

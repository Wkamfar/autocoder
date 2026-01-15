function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote if it contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  const cols =
    headers && headers.length > 0
      ? headers
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  const lines: string[] = [];
  lines.push(cols.map(escapeCsvCell).join(","));

  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvCell((row as any)[c])).join(","));
  }

  return lines.join("\n") + "\n";
}


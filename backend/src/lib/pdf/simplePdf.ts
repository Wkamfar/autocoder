/**
 * Minimal, dependency-free PDF generator for simple, single-page text reports.
 * This is intentionally small: enough for “export PDF” without pulling in heavy libs.
 *
 * NOTE: This is not a full PDF layout engine.
 */

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildXref(offsets: number[], totalObjects: number): string {
  // xref requires entry for object 0
  const lines: string[] = [];
  lines.push("xref");
  lines.push(`0 ${totalObjects + 1}`);
  lines.push("0000000000 65535 f ");
  for (let i = 1; i <= totalObjects; i++) {
    const off = offsets[i] ?? 0;
    lines.push(`${String(off).padStart(10, "0")} 00000 n `);
  }
  return lines.join("\n") + "\n";
}

export function makeSimplePdf(params: {
  title: string;
  lines: string[];
  watermark?: string;
}): Buffer {
  const title = params.title || "Report";
  const lines = params.lines ?? [];
  const watermark = params.watermark?.trim() || "";

  // Simple A4-ish page size in points
  const width = 595.28;
  const height = 841.89;

  // Content stream: title + lines.
  const content: string[] = [];
  content.push("BT");
  content.push("/F1 14 Tf");
  content.push("50 800 Td");
  content.push(`(${pdfEscape(title)}) Tj`);
  content.push("ET");

  // Watermark (light gray, big text)
  if (watermark) {
    content.push("q");
    content.push("0.85 g"); // light gray
    content.push("/F1 64 Tf");
    // place roughly center
    content.push(`100 420 Td`);
    content.push("BT");
    content.push(`(${pdfEscape(watermark)}) Tj`);
    content.push("ET");
    content.push("Q");
  }

  // Body text
  let y = 770;
  for (const line of lines.slice(0, 55)) {
    content.push("BT");
    content.push("/F1 10 Tf");
    content.push(`50 ${y} Td`);
    content.push(`(${pdfEscape(line)}) Tj`);
    content.push("ET");
    y -= 12;
  }

  const contentStream = content.join("\n") + "\n";

  // Objects:
  // 1: Catalog
  // 2: Pages
  // 3: Page
  // 4: Font
  // 5: Content stream
  const objects: string[] = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  objects[3] =
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
    `/Resources << /Font << /F1 4 0 R >> >> ` +
    `/Contents 5 0 R >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[5] = `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`;

  // Assemble with offsets for xref
  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let body = header;
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(body, "utf8");
    body += objects[i];
  }

  const xref = buildXref(offsets, 5);
  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += xref;
  body += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
}


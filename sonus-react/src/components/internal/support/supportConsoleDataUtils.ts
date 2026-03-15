export function downloadTextFile(
  filename: string,
  content: string,
  contentType: string,
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function wrapTextForPdf(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let idx = 1; idx < words.length; idx += 1) {
    const candidate = `${current} ${words[idx]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[idx];
    }
  }
  lines.push(current);
  return lines;
}

export async function buildSonusPdf(
  title: string,
  subtitle: string,
  sections: Array<{ heading: string; lines: string[] }>,
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const heading = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = 10.5;
  const headingSize = 12;
  const lineHeight = 14;
  const titleColor = rgb(0.06, 0.19, 0.33);
  const textColor = rgb(0.09, 0.16, 0.22);
  const mutedColor = rgb(0.39, 0.45, 0.52);

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    const logoRes = await fetch("/branding/logo_name_solo.png", {
      cache: "no-store",
    });
    if (logoRes.ok) {
      const logoBytes = await logoRes.arrayBuffer();
      logoImage = await doc.embedPng(logoBytes);
    }
  } catch {
    logoImage = null;
  }

  const createPage = () => doc.addPage([pageWidth, pageHeight]);
  let page = createPage();
  let y = pageHeight - margin;
  let pageNumber = 1;

  const drawPageHeader = () => {
    y = pageHeight - margin;
    if (logoImage) {
      const maxLogoWidth = contentWidth * 0.34;
      const baseScale = maxLogoWidth / logoImage.width;
      const scaled = logoImage.scale(Math.min(0.22, baseScale));
      const logoX = (pageWidth - scaled.width) / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: y - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      y -= scaled.height + 24;
    }
    const titleWidth = heading.widthOfTextAtSize(title, 19);
    page.drawText(title, {
      x: Math.max(margin, (pageWidth - titleWidth) / 2),
      y: y - 6,
      size: 19,
      font: heading,
      color: titleColor,
    });
    y -= 34;
    const subtitleWidth = regular.widthOfTextAtSize(subtitle, 10);
    page.drawText(subtitle, {
      x: Math.max(margin, (pageWidth - subtitleWidth) / 2),
      y,
      size: 10,
      font: regular,
      color: mutedColor,
    });
    y -= 18;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.89, 0.93),
    });
    y -= 16;
  };

  const ensureSpace = (required: number) => {
    if (y - required > margin) return;
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - margin - 42,
      y: margin - 18,
      size: 9,
      font: regular,
      color: mutedColor,
    });
    pageNumber += 1;
    page = createPage();
    drawPageHeader();
  };

  drawPageHeader();

  for (const section of sections) {
    ensureSpace(28);
    page.drawText(section.heading, {
      x: margin,
      y,
      size: headingSize,
      font: heading,
      color: textColor,
    });
    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.9, 0.93, 0.95),
    });
    y -= 12;
    for (const rawLine of section.lines) {
      const lineText = rawLine === "" ? " " : rawLine;
      const isBullet = lineText.startsWith("- ");
      const normalizedLine = isBullet ? lineText.slice(2) : lineText;
      const wrapped = wrapTextForPdf(
        normalizedLine,
        isBullet ? contentWidth - 14 : contentWidth,
        regular,
        bodySize,
      );
      for (const wrappedLine of wrapped) {
        ensureSpace(lineHeight + 6);
        if (isBullet) {
          page.drawText("•", {
            x: margin + 2,
            y,
            size: bodySize,
            font: regular,
            color: textColor,
          });
        }
        page.drawText(wrappedLine, {
          x: isBullet ? margin + 14 : margin,
          y,
          size: bodySize,
          font: regular,
          color: textColor,
        });
        y -= lineHeight;
      }
    }
    y -= 10;
  }

  page.drawText(`Page ${pageNumber}`, {
    x: pageWidth - margin - 42,
    y: margin - 18,
    size: 9,
    font: regular,
    color: mutedColor,
  });

  return doc.save();
}

function escapeCsvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const headerLine = headers.map((cell) => escapeCsvCell(cell)).join(",");
  const rowLines = rows.map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(","),
  );
  return `\ufeff${[headerLine, ...rowLines].join("\n")}`;
}

export function normalizeFullSuiteConfirmText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function isValidFullSuiteConfirmText(value: string) {
  const normalized = normalizeFullSuiteConfirmText(value);
  return normalized === "RUN_FULL_SUITE" || normalized === "RUN_FULL_SITE";
}

function crc32(input: string) {
  let crc = 0 ^ -1;
  for (let i = 0; i < input.length; i += 1) {
    const byte = input.charCodeAt(i) & 0xff;
    crc ^= byte;
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createSimpleZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const pushU16 = (value: number, out: number[]) => {
    out.push(value & 0xff, (value >>> 8) & 0xff);
  };
  const pushU32 = (value: number, out: number[]) => {
    out.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(file.content);

    const localHeader: number[] = [];
    pushU32(0x04034b50, localHeader);
    pushU16(20, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU32(crc, localHeader);
    pushU32(contentBytes.length, localHeader);
    pushU32(contentBytes.length, localHeader);
    pushU16(nameBytes.length, localHeader);
    pushU16(0, localHeader);

    const localChunk = new Uint8Array(
      localHeader.length + nameBytes.length + contentBytes.length,
    );
    localChunk.set(localHeader, 0);
    localChunk.set(nameBytes, localHeader.length);
    localChunk.set(contentBytes, localHeader.length + nameBytes.length);
    localParts.push(localChunk);

    const centralHeader: number[] = [];
    pushU32(0x02014b50, centralHeader);
    pushU16(20, centralHeader);
    pushU16(20, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU32(crc, centralHeader);
    pushU32(contentBytes.length, centralHeader);
    pushU32(contentBytes.length, centralHeader);
    pushU16(nameBytes.length, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU32(0, centralHeader);
    pushU32(offset, centralHeader);

    const centralChunk = new Uint8Array(
      centralHeader.length + nameBytes.length,
    );
    centralChunk.set(centralHeader, 0);
    centralChunk.set(nameBytes, centralHeader.length);
    centralParts.push(centralChunk);

    offset += localChunk.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = localParts.reduce((sum, part) => sum + part.length, 0);

  const endHeader: number[] = [];
  pushU32(0x06054b50, endHeader);
  pushU16(0, endHeader);
  pushU16(0, endHeader);
  pushU16(files.length, endHeader);
  pushU16(files.length, endHeader);
  pushU32(centralSize, endHeader);
  pushU32(centralOffset, endHeader);
  pushU16(0, endHeader);
  const endChunk = new Uint8Array(endHeader);

  const toArrayBuffer = (chunk: Uint8Array): ArrayBuffer => {
    const copied = new Uint8Array(chunk.byteLength);
    copied.set(chunk);
    return copied.buffer;
  };
  return new Blob(
    [...localParts, ...centralParts, endChunk].map((chunk) =>
      toArrayBuffer(chunk),
    ),
    {
      type: "application/zip",
    },
  );
}

export function downloadZipFile(
  filename: string,
  files: Array<{ name: string; content: string }>,
) {
  const blob = createSimpleZip(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fileNameFromContentDisposition(
  headerValue: string | null,
  fallback: string,
) {
  if (!headerValue) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(headerValue);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = /filename=([^;]+)/i.exec(headerValue);
  return plainMatch?.[1]?.trim() || fallback;
}

export async function downloadResponseAsFile(
  response: Response,
  fallbackName: string,
) {
  const blob = await response.blob();
  const fileName = fileNameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function parseJsonOrThrow<T>(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // no-op
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: string }).error || "Request failed")
        : "Request failed";
    throw new Error(message);
  }
  return (payload || {}) as T;
}

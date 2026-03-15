import type { FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { prisma } from '../lib/prisma.js';

export type UserExportFormat = 'json' | 'csv' | 'pdf';

function toExportRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((row) => Boolean(row) && typeof row === 'object') as Array<
      Record<string, unknown>
    >;
  }
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return [];
}

function normalizeExportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvCell(value: unknown) {
  const raw = normalizeExportValue(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function flattenExportRecord(
  value: unknown,
  fieldPrefix = ''
): Array<{ fieldPath: string; value: unknown }> {
  if (value === null || value === undefined) {
    return [{ fieldPath: fieldPrefix || '__value', value: '' }];
  }
  if (Array.isArray(value)) {
    if (!value.length) return [{ fieldPath: fieldPrefix || '__value', value: '[]' }];
    return value.flatMap((item, idx) =>
      flattenExportRecord(item, fieldPrefix ? `${fieldPrefix}[${idx}]` : `[${idx}]`)
    );
  }
  if (value instanceof Date) {
    return [{ fieldPath: fieldPrefix || '__value', value: value.toISOString() }];
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return [{ fieldPath: fieldPrefix || '__value', value: '{}' }];
    return entries.flatMap(([key, nested]) =>
      flattenExportRecord(nested, fieldPrefix ? `${fieldPrefix}.${key}` : key)
    );
  }
  return [{ fieldPath: fieldPrefix || '__value', value }];
}

function buildUserExportCsv(payload: Record<string, unknown>) {
  const rows: string[] = [
    'section,record_index,record_count,record_id,record_created_at,field_path,value',
  ];
  const preferredSectionOrder = [
    'exportMeta',
    'profile',
    'legalDocumentAcceptances',
    'userProgress',
    'quizAttempts',
    'speakAttempts',
    'wordMemoryState',
    'progressEvents',
    'localAuthCredentials',
    'refreshSessions',
    'passwordResetTokens',
    'learningAccessControls',
    'learningAccessAudits',
    'supportNotesAsTarget',
    'supportNotesAsActor',
    'deletionRequestsAsTarget',
    'deletionRequestsAsRequester',
    'deletionRequestsAsResolver',
    'accountSecurityEventsAsTarget',
    'accountSecurityEventsAsActor',
    'scheduledAccountDeletions',
    'deletionCaseHistoryAsTarget',
    'deletionCaseHistoryAsActor',
    'adminAuditLogsAsTarget',
    'adminAuditLogsAsActor',
  ];
  const sectionEntries = Object.entries(payload).sort((a, b) => {
    const left = preferredSectionOrder.indexOf(a[0]);
    const right = preferredSectionOrder.indexOf(b[0]);
    const leftRank = left === -1 ? Number.MAX_SAFE_INTEGER : left;
    const rightRank = right === -1 ? Number.MAX_SAFE_INTEGER : right;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return a[0].localeCompare(b[0]);
  });

  for (const [section, value] of sectionEntries) {
    const records = toExportRows(value);
    if (!records.length) {
      rows.push(
        `${csvCell(section)},0,0,${csvCell('')},${csvCell('')},${csvCell('__empty')},${csvCell('true')}`
      );
      continue;
    }
    const recordCount = records.length;
    records.forEach((record, index) => {
      const recordId = normalizeExportValue(record.id ?? record.userId ?? '');
      const recordCreatedAt = normalizeExportValue(
        record.createdAt ?? record.acceptedAt ?? record.updatedAt ?? ''
      );
      const flattened = flattenExportRecord(record);
      flattened.forEach(({ fieldPath, value: fieldValue }) => {
        rows.push(
          `${csvCell(section)},${csvCell(index)},${csvCell(recordCount)},${csvCell(recordId)},${csvCell(recordCreatedAt)},${csvCell(fieldPath)},${csvCell(fieldValue)}`
        );
      });
    });
  }
  return `\ufeff${rows.join('\n')}`;
}

function buildExportFilename(userId: string, format: UserExportFormat) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `user-data-export-${safeUserId}-${stamp}.${format}`;
}

function stringifyExportPayload(payload: Record<string, unknown>) {
  return JSON.stringify(
    payload,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
}

function normalizePdfText(input: string) {
  return input
    .replace(/\r/g, '')
    .replace(/\t/g, '  ')
    .replace(/[^\x20-\x7e]/g, '?');
}

function wrapPdfTextLine(text: string, maxWidth: number, font: PDFFont, size: number) {
  const normalized = normalizePdfText(text || '');
  if (!normalized.trim()) return [''];
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = words.shift() || '';
  for (const word of words) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    while (font.widthOfTextAtSize(current, size) > maxWidth && current.length > 1) {
      let sliceEnd = Math.max(
        1,
        Math.floor((maxWidth / font.widthOfTextAtSize(current, size)) * current.length)
      );
      while (sliceEnd > 1 && font.widthOfTextAtSize(current.slice(0, sliceEnd), size) > maxWidth) {
        sliceEnd -= 1;
      }
      lines.push(current.slice(0, sliceEnd));
      current = current.slice(sliceEnd);
    }
  }
  lines.push(current);
  return lines;
}

type PdfLineKind = 'section' | 'label' | 'body' | 'mono' | 'spacer';
type PdfLine = { kind: PdfLineKind; text: string };

function toPdfKeyValue(label: string, value: unknown) {
  if (value === null || value === undefined) return `${label}: -`;
  if (typeof value === 'boolean') return `${label}: ${value ? 'Yes' : 'No'}`;
  if (value instanceof Date) return `${label}: ${value.toISOString()}`;
  if (typeof value === 'object') return `${label}: ${normalizeExportValue(value)}`;
  const text = String(value).trim();
  return `${label}: ${text || '-'}`;
}

function sectionRecordCount(value: unknown) {
  return toExportRows(value).length;
}

async function loadExportLogoBytes() {
  const candidates = [
    path.join(process.cwd(), 'sonus-react', 'public', 'branding', 'logo_name_solo.png'),
    path.join(process.cwd(), '..', 'sonus-react', 'public', 'branding', 'logo_name_solo.png'),
    path.join(process.cwd(), 'public', 'branding', 'logo_name_solo.png'),
  ];
  for (const logoPath of candidates) {
    try {
      const bytes = await fs.readFile(logoPath);
      if (bytes.byteLength > 0) return bytes;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function buildTextPdf(title: string, subtitle: string, lines: Iterable<PdfLine>) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const logoBytes = await loadExportLogoBytes();
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoBytes) {
    try {
      logo = await doc.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  const styleByKind: Record<
    PdfLineKind,
    { font: PDFFont; size: number; lineHeight: number; blockGap: number }
  > = {
    section: { font: bold, size: 12, lineHeight: 15, blockGap: 4 },
    label: { font: bold, size: 10, lineHeight: 13, blockGap: 2 },
    body: { font: regular, size: 10, lineHeight: 13, blockGap: 2 },
    mono: { font: mono, size: 9, lineHeight: 12, blockGap: 1 },
    spacer: { font: regular, size: 10, lineHeight: 7, blockGap: 0 },
  };
  const contentWidth = pageWidth - margin * 2;
  const headerTopY = pageHeight - margin;
  const logoMaxWidth = 170;
  const logoMaxHeight = 36;
  let logoWidth = 0;
  let logoHeight = 0;
  let logoX = 0;
  let logoY = 0;
  if (logo) {
    const scale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height, 1);
    logoWidth = logo.width * scale;
    logoHeight = logo.height * scale;
    logoX = (pageWidth - logoWidth) / 2;
    logoY = headerTopY - logoHeight;
  }
  const headerTitleY = logoHeight > 0 ? logoY - 24 : headerTopY - 2;
  const headerSubtitleY = headerTitleY - 16;
  const headerRuleY = headerSubtitleY - 13;
  const bodyTopY = headerRuleY - 16;
  const footerY = margin - 14;
  const bodyBottomY = footerY + 16;

  let pageNumber = 0;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = bodyTopY;
  const titleText = normalizePdfText(title);
  const subtitleText = normalizePdfText(subtitle);
  const titleX = (pageWidth - bold.widthOfTextAtSize(titleText, 16)) / 2;
  const subtitleX = (pageWidth - regular.widthOfTextAtSize(subtitleText, 10)) / 2;

  const drawHeader = () => {
    if (logo && logoWidth > 0 && logoHeight > 0) {
      page.drawImage(logo, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    }
    page.drawText(titleText, {
      x: titleX,
      y: headerTitleY,
      font: bold,
      size: 16,
      color: rgb(0.06, 0.1, 0.16),
    });
    page.drawText(subtitleText, {
      x: subtitleX,
      y: headerSubtitleY,
      font: regular,
      size: 10,
      color: rgb(0.29, 0.34, 0.42),
    });
    page.drawLine({
      start: { x: margin, y: headerRuleY },
      end: { x: pageWidth - margin, y: headerRuleY },
      thickness: 1,
      color: rgb(0.87, 0.9, 0.94),
    });
  };

  const drawFooter = () => {
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - margin - 58,
      y: footerY,
      font: regular,
      size: 9,
      color: rgb(0.4, 0.45, 0.52),
    });
    page.drawText('Sonus', {
      x: margin,
      y: footerY,
      font: regular,
      size: 9,
      color: rgb(0.4, 0.45, 0.52),
    });
  };

  const nextPage = () => {
    pageNumber += 1;
    page = doc.addPage([pageWidth, pageHeight]);
    y = bodyTopY;
    drawHeader();
  };

  doc.removePage(0);
  nextPage();

  let wroteContent = false;
  for (const line of lines) {
    const style = styleByKind[line.kind];
    if (line.kind === 'spacer') {
      if (y - style.lineHeight < bodyBottomY) {
        drawFooter();
        nextPage();
      }
      y -= style.lineHeight;
      wroteContent = true;
      continue;
    }

    const wrapped = wrapPdfTextLine(line.text || '', contentWidth, style.font, style.size);
    const parts = wrapped.length ? wrapped : [''];
    for (const part of parts) {
      if (y - style.lineHeight < bodyBottomY) {
        drawFooter();
        nextPage();
      }
      page.drawText(part, {
        x: margin,
        y,
        font: style.font,
        size: style.size,
        color: rgb(0.1, 0.15, 0.22),
      });
      y -= style.lineHeight;
      wroteContent = true;
    }

    if (style.blockGap > 0) {
      if (y - style.blockGap < bodyBottomY) {
        drawFooter();
        nextPage();
      } else {
        y -= style.blockGap;
      }
    }
  }

  if (!wroteContent) {
    const fallback = styleByKind.body;
    page.drawText('-', {
      x: margin,
      y,
      font: fallback.font,
      size: fallback.size,
      color: rgb(0.1, 0.15, 0.22),
    });
  }
  drawFooter();
  return doc.save();
}

async function buildUserExportPdf(payload: Record<string, unknown>, userId: string) {
  const generatedAt = new Date().toISOString();
  const exportMeta = ((payload.exportMeta as Record<string, unknown> | undefined) || {}) as Record<
    string,
    unknown
  >;
  const profile = ((payload.profile as Record<string, unknown> | undefined) || {}) as Record<
    string,
    unknown
  >;

  const sectionEntries = Object.entries(payload).filter(
    ([key]) => key !== 'exportMeta' && key !== 'profile'
  );
  const sectionCounts = sectionEntries.map(([key, value]) => ({
    key,
    count: sectionRecordCount(value),
  }));
  const nonEmptySectionCount = sectionCounts.filter((entry) => entry.count > 0).length;
  const totalRecordCount = sectionCounts.reduce((sum, entry) => sum + entry.count, 0);

  const sortedCounts = [...sectionCounts].sort((a, b) => a.key.localeCompare(b.key));

  function* streamLines(): Generator<PdfLine> {
    yield { kind: 'section', text: 'Report Summary' };
    yield { kind: 'label', text: toPdfKeyValue('User ID', userId) };
    yield { kind: 'body', text: toPdfKeyValue('Generated At (UTC)', generatedAt) };
    yield { kind: 'body', text: toPdfKeyValue('Schema Version', exportMeta.schemaVersion) };
    yield {
      kind: 'body',
      text: toPdfKeyValue(
        'Exported By',
        exportMeta.exportedByAdminEmail || exportMeta.exportedByAdminUserId
      ),
    };
    yield { kind: 'body', text: toPdfKeyValue('Total Records', totalRecordCount) };
    yield { kind: 'body', text: toPdfKeyValue('Non-Empty Data Sections', nonEmptySectionCount) };
    yield { kind: 'spacer', text: '' };
    yield { kind: 'section', text: 'Profile Snapshot' };
    yield { kind: 'label', text: toPdfKeyValue('Display Name', profile.displayName) };
    yield { kind: 'body', text: toPdfKeyValue('Email', profile.email) };
    yield { kind: 'body', text: toPdfKeyValue('Target Language', profile.targetLanguage) };
    yield { kind: 'body', text: toPdfKeyValue('Timezone', profile.timezone) };
    yield { kind: 'body', text: toPdfKeyValue('Onboarding Complete', profile.onboardingComplete) };
    yield { kind: 'body', text: toPdfKeyValue('Profile Created At', profile.createdAt) };
    yield { kind: 'body', text: toPdfKeyValue('Profile Updated At', profile.updatedAt) };
    yield { kind: 'spacer', text: '' };
    yield { kind: 'section', text: 'Data Inventory' };
    yield { kind: 'mono', text: 'Section Name                         Records' };
    yield { kind: 'mono', text: '-----------------------------------  -------' };

    for (const entry of sortedCounts) {
      yield {
        kind: 'mono',
        text: `${entry.key.padEnd(35, ' ')}  ${String(entry.count).padStart(7, ' ')}`,
      };
    }

    if (exportMeta.warning) {
      yield { kind: 'spacer', text: '' };
      yield { kind: 'section', text: 'Notice' };
      yield { kind: 'body', text: String(exportMeta.warning) };
    }

    yield { kind: 'spacer', text: '' };
    yield { kind: 'section', text: 'Format Guidance' };
    yield {
      kind: 'body',
      text: 'Use JSON for complete structured records and CSV for spreadsheet-based review.',
    };
    yield { kind: 'spacer', text: '' };
    yield { kind: 'section', text: 'Complete Record Appendix' };

    const orderedSectionKeys = ['exportMeta', 'profile', ...sortedCounts.map((entry) => entry.key)];
    for (const sectionKey of orderedSectionKeys) {
      const rawSectionValue = payload[sectionKey];
      if (rawSectionValue === undefined) continue;
      const recordCount =
        sectionKey === 'exportMeta' || sectionKey === 'profile'
          ? 1
          : sectionRecordCount(rawSectionValue);
      yield { kind: 'spacer', text: '' };
      yield { kind: 'section', text: `${sectionKey} (${recordCount})` };

      if (Array.isArray(rawSectionValue)) {
        if (!rawSectionValue.length) {
          yield { kind: 'mono', text: '[]' };
          continue;
        }
        yield { kind: 'mono', text: '[' };
        for (let i = 0; i < rawSectionValue.length; i += 1) {
          const item = rawSectionValue[i];
          const json = JSON.stringify(
            item,
            (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
            2
          );
          const itemLines = (json || 'null').split('\n');
          for (let lineIdx = 0; lineIdx < itemLines.length; lineIdx += 1) {
            const line = itemLines[lineIdx];
            const suffix =
              lineIdx === itemLines.length - 1 && i < rawSectionValue.length - 1 ? ',' : '';
            yield { kind: 'mono', text: `  ${line}${suffix}` };
          }
        }
        yield { kind: 'mono', text: ']' };
        continue;
      }

      const sectionJson = JSON.stringify(
        rawSectionValue,
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2
      );
      const jsonLines = (sectionJson || 'null').split('\n');
      for (const jsonLine of jsonLines) {
        yield { kind: 'mono', text: jsonLine };
      }
    }
  }

  return buildTextPdf('Sonus User Data Export', 'Legal Data Access Report', streamLines());
}

export async function getUserProfileForExport(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function buildUserExportPayload(input: {
  userId: string;
  actorUserId: string;
  actorEmail: string | null;
  profile: unknown;
}) {
  const { userId, actorUserId, actorEmail, profile } = input;
  const [
    legalDocumentAcceptances,
    userProgress,
    quizAttempts,
    speakAttempts,
    wordMemoryState,
    progressEvents,
    localAuthCredentials,
    refreshSessions,
    passwordResetTokens,
    learningAccessControls,
    learningAccessAudits,
    supportNotesAsTarget,
    supportNotesAsActor,
    deletionRequestsAsTarget,
    deletionRequestsAsRequester,
    deletionRequestsAsResolver,
    accountSecurityEventsAsTarget,
    accountSecurityEventsAsActor,
    scheduledAccountDeletions,
    deletionCaseHistoryAsTarget,
    deletionCaseHistoryAsActor,
    adminAuditLogsAsTarget,
    adminAuditLogsAsActor,
  ] = await Promise.all([
    prisma.legalDocumentAcceptance.findMany({ where: { userId }, orderBy: { acceptedAt: 'asc' } }),
    prisma.userProgress.findUnique({ where: { userId } }),
    prisma.quizAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.speakAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.wordMemoryState.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.progressEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.localAuthCredential.findMany({
      where: { userId },
      select: { id: true, userId: true, email: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.refreshSession.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        familyId: true,
        createdIp: true,
        createdUserAgent: true,
        revokedReason: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.passwordResetToken.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        createdIp: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userLearningAccessControl.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.userLearningAccessAudit.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.supportNote.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.supportNote.findMany({ where: { actorUserId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.deletionRequest.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deletionRequest.findMany({
      where: { requestedByUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deletionRequest.findMany({
      where: { resolvedByUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.accountSecurityEvent.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.accountSecurityEvent.findMany({
      where: { actorUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.scheduledAccountDeletion.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deletionCaseHistory.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deletionCaseHistory.findMany({
      where: { resolvedByUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminAuditLog.findMany({
      where: { actorUserId: userId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    exportMeta: {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      exportedByAdminUserId: actorUserId,
      exportedByAdminEmail: actorEmail,
      userId,
      availableFormats: ['json', 'csv', 'pdf'],
      legalNotes: [
        'Times are in ISO-8601 UTC unless otherwise noted.',
        'This export includes both user-owned data and support/admin audit records tied to the user account.',
        'JSON remains the authoritative machine-readable format.',
      ],
    },
    profile,
    legalDocumentAcceptances,
    userProgress: userProgress ? [userProgress] : [],
    quizAttempts,
    speakAttempts,
    wordMemoryState,
    progressEvents,
    localAuthCredentials,
    refreshSessions,
    passwordResetTokens,
    learningAccessControls,
    learningAccessAudits,
    supportNotesAsTarget,
    supportNotesAsActor,
    deletionRequestsAsTarget,
    deletionRequestsAsRequester,
    deletionRequestsAsResolver,
    accountSecurityEventsAsTarget,
    accountSecurityEventsAsActor,
    scheduledAccountDeletions,
    deletionCaseHistoryAsTarget,
    deletionCaseHistoryAsActor,
    adminAuditLogsAsTarget,
    adminAuditLogsAsActor,
  } as Record<string, unknown>;
}

export function buildUserExportFallbackPayload(input: {
  userId: string;
  actorUserId: string;
  actorEmail: string | null;
  profile: unknown;
}) {
  return {
    exportMeta: {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      exportedByAdminUserId: input.actorUserId,
      exportedByAdminEmail: input.actorEmail,
      userId: input.userId,
      availableFormats: ['json', 'csv', 'pdf'],
      warning: 'Partial export generated because one or more optional datasets were unavailable.',
    },
    profile: input.profile,
    legalDocumentAcceptances: [],
    userProgress: [],
    quizAttempts: [],
    speakAttempts: [],
    wordMemoryState: [],
    progressEvents: [],
    localAuthCredentials: [],
    refreshSessions: [],
    passwordResetTokens: [],
    learningAccessControls: [],
    learningAccessAudits: [],
    supportNotesAsTarget: [],
    supportNotesAsActor: [],
    deletionRequestsAsTarget: [],
    deletionRequestsAsRequester: [],
    deletionRequestsAsResolver: [],
    accountSecurityEventsAsTarget: [],
    accountSecurityEventsAsActor: [],
    scheduledAccountDeletions: [],
    deletionCaseHistoryAsTarget: [],
    deletionCaseHistoryAsActor: [],
    adminAuditLogsAsTarget: [],
    adminAuditLogsAsActor: [],
  } as Record<string, unknown>;
}

export async function sendUserExportPayload(
  reply: FastifyReply,
  userId: string,
  format: UserExportFormat,
  payload: Record<string, unknown>
) {
  const filename = buildExportFilename(userId, format);
  if (format === 'csv') {
    const csv = buildUserExportCsv(payload);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.send(csv);
    return;
  }

  if (format === 'pdf') {
    const pdf = await buildUserExportPdf(payload, userId);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.send(Buffer.from(pdf));
    return;
  }

  reply.header('Content-Type', 'application/json; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  reply.send(stringifyExportPayload(payload));
}

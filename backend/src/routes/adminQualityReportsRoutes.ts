import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../lib/auth.js';
import { requireTrustedOrigin } from '../lib/originPolicy.js';
import {
  readQualityReportList,
  resolveQualityReportsDir,
  runQualityCommand,
} from '../services/adminQualityReportsService.js';
import {
  qualityCleanupBodySchema,
  qualityReportsQuerySchema,
  qualityRunFullBodySchema,
  qualityRunParamsSchema,
} from './adminSchemas.js';

type RegisterAdminQualityReportsRoutesDeps = {
  allowedOrigins: Set<string>;
};

export function registerAdminQualityReportsRoutes(
  app: FastifyInstance,
  deps: RegisterAdminQualityReportsRoutesDeps
) {
  app.get('/v1/admin/quality-reports', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = qualityReportsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }
    const reports = await readQualityReportList(parsed.data.limit);
    return { reports };
  });

  app.get(
    '/v1/admin/quality-reports/:runId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = qualityRunParamsSchema.safeParse(request.params ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid run id', issues: parsed.error.issues });
        return;
      }

      const reportsDir = await resolveQualityReportsDir();
      const runDir = path.join(reportsDir, parsed.data.runId);
      const normalizedReportsDir = path.resolve(reportsDir);
      const normalizedRunDir = path.resolve(runDir);
      if (!normalizedRunDir.startsWith(`${normalizedReportsDir}${path.sep}`)) {
        reply.code(400).send({ error: 'Invalid run id path.' });
        return;
      }

      const jsonPath = path.join(normalizedRunDir, 'quality-report.json');
      const markdownPath = path.join(normalizedRunDir, 'QUALITY_REPORT.md');
      const [jsonRaw, markdownRaw] = await Promise.all([
        fs.readFile(jsonPath, 'utf8').catch(() => null),
        fs.readFile(markdownPath, 'utf8').catch(() => null),
      ]);

      if (!jsonRaw || !markdownRaw) {
        reply.code(404).send({ error: 'Quality report run not found.' });
        return;
      }

      const parsedJson: unknown = (() => {
        try {
          return JSON.parse(jsonRaw);
        } catch {
          return null;
        }
      })();

      return {
        runId: parsed.data.runId,
        markdown: markdownRaw,
        json: parsedJson,
      };
    }
  );

  app.post(
    '/v1/admin/quality-reports/run-prod-safe',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
      return runQualityCommand({
        scriptName: 'quality:report:prod-safe:soft',
        qualityProfile: 'prod-safe',
      });
    }
  );

  app.post(
    '/v1/admin/quality-reports/run-full',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
      const parsed = qualityRunFullBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
        return;
      }
      const normalizedConfirmText = parsed.data.confirmText
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
      if (normalizedConfirmText !== 'RUN_FULL_SUITE' && normalizedConfirmText !== 'RUN_FULL_SITE') {
        reply.code(400).send({ error: 'Confirmation text mismatch. Use RUN_FULL_SUITE.' });
        return;
      }
      return runQualityCommand({
        scriptName: 'quality:report:soft',
        qualityProfile: 'full',
      });
    }
  );

  app.post(
    '/v1/admin/quality-reports/cleanup',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
      const parsed = qualityCleanupBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
        return;
      }

      const keepLatest = parsed.data.keepLatest;
      const reportsDir = await resolveQualityReportsDir();
      const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
      const runIds = entries
        .filter((entry) => entry.isDirectory() && /^quality-[0-9TZ.-]+$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a));

      const deleted: string[] = [];
      const toDelete = runIds.slice(keepLatest);
      for (const runId of toDelete) {
        const runDir = path.join(reportsDir, runId);
        const normalizedReportsDir = path.resolve(reportsDir);
        const normalizedRunDir = path.resolve(runDir);
        if (!normalizedRunDir.startsWith(`${normalizedReportsDir}${path.sep}`)) {
          continue;
        }
        await fs.rm(normalizedRunDir, { recursive: true, force: true }).catch(() => {});
        deleted.push(runId);
      }

      const [latest] = await readQualityReportList(1);
      return {
        ok: true,
        keepLatest,
        deletedCount: deleted.length,
        deletedRunIds: deleted,
        latestRunId: latest?.runId || null,
      };
    }
  );
}

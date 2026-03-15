import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../lib/auth.js';
import { computeImpactOutcomesMetrics } from '../services/adminImpactOutcomesService.js';
import { metricsOverviewQuerySchema } from './adminSchemas.js';

export function registerAdminImpactOutcomesRoute(app: FastifyInstance) {
  app.get(
    '/v1/admin/metrics/impact-outcomes',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = metricsOverviewQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowDays = parsed.data.windowDays;

      try {
        return await computeImpactOutcomesMetrics({ windowDays, request });
      } catch (error) {
        request.log.error({ err: error, windowDays }, 'admin.metrics.impact_outcomes_failed');
        reply.code(500).send({ error: 'Failed to load impact outcomes metrics.' });
        return;
      }
    }
  );
}

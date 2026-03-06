import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import {
  assertMetricsReadTokenOrThrow,
  getLearningMetricsSnapshot,
  recordClientTelemetry,
  toPrometheusText,
} from '../services/learningMetricsService.js';

const telemetrySchema = z.object({
  name: z.enum(['speak_stt_unavailable', 'speak_stt_error', 'speak_lookup_ready']),
  payload: z.record(z.unknown()).optional(),
});

export async function telemetryRoutes(app: FastifyInstance) {
  // Auth required. Accepts client-side telemetry pings for product health tracking.
  app.post('/v1/telemetry/client', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = telemetrySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    recordClientTelemetry({ name: parsed.data.name });
    return { ok: true };
  });

  // Token-protected endpoint for server-side learning metrics (JSON or Prometheus).
  app.get('/v1/metrics/learning', async (request, reply) => {
    try {
      const header = request.headers['x-metrics-token'];
      const token = Array.isArray(header) ? header[0] : header;
      assertMetricsReadTokenOrThrow(token);
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
      reply.code(statusCode).send({ error: (error as Error).message });
      return;
    }

    const format =
      typeof request.query === 'object' && request.query && 'format' in request.query
        ? String((request.query as Record<string, unknown>).format || '')
        : '';

    if (format.toLowerCase() === 'prometheus') {
      reply.type('text/plain; version=0.0.4');
      return toPrometheusText();
    }

    return getLearningMetricsSnapshot();
  });
}

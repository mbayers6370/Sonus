import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../lib/auth.js';
import {
  buildUserExportFallbackPayload,
  buildUserExportPayload,
  getUserProfileForExport,
  sendUserExportPayload,
} from '../services/adminUserExportService.js';
import { userExportQuerySchema, userIdParamsSchema } from './adminSchemas.js';

export function registerAdminUserExportRoutes(app: FastifyInstance) {
  app.get(
    '/v1/admin/users/:userId/export',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = userExportQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const format = parsedQuery.data.format;
      const profile = await getUserProfileForExport(userId);
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      try {
        const exportPayload = await buildUserExportPayload({
          userId,
          actorUserId: request.user.id,
          actorEmail: request.user.email || null,
          profile,
        });
        await sendUserExportPayload(reply, userId, format, exportPayload);
        return;
      } catch (error) {
        request.log.error({ err: error, userId, format }, 'admin.user_export_fallback_payload');
        const fallbackPayload = buildUserExportFallbackPayload({
          userId,
          actorUserId: request.user.id,
          actorEmail: request.user.email || null,
          profile,
        });
        await sendUserExportPayload(reply, userId, format, fallbackPayload);
      }
    }
  );
}

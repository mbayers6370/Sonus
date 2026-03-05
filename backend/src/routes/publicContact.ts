import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import { sendContactEmail } from '../services/contactEmailService.js';

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  message: z.string().trim().min(1).max(4000),
});

export async function publicContactRoutes(app: FastifyInstance) {
  const allowedOrigins = readAllowedOrigins();

  app.post('/v1/public/contact', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = contactSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const sent = await sendContactEmail({
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    });

    if (!sent) {
      reply.code(503).send({ error: 'Contact service is temporarily unavailable.' });
      return;
    }

    reply.send({ ok: true });
  });
}

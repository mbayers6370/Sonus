import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { meRoutes } from './routes/me.js';
import { attemptRoutes } from './routes/attempts.js';

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => {
    return { ok: true, authMode: env.AUTH_MODE };
  });

  await meRoutes(app);
  await attemptRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({
      error: 'Internal server error',
    });
  });

  return app;
}

async function start() {
  const app = await buildServer();

  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  await app.listen({
    host: '0.0.0.0',
    port: env.PORT,
  });
}

start().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

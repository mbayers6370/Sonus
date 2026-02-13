import 'fastify';
import type { AuthenticatedUser } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

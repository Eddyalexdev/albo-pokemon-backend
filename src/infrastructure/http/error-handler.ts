import type { FastifyInstance } from 'fastify';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError.js';

/**
 * Centralized error handler for Fastify.
 * Maps domain errors to HTTP 400/404, everything else to 500.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFoundError) {
      return reply.status(404).send({ error: err.code, message: err.message });
    }
    if (err instanceof DomainError) {
      return reply.status(400).send({ error: err.code, message: err.message });
    }
    app.log.error(err);
    return reply
      .status(500)
      .send({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  });
}

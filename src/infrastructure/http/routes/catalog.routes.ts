import type { FastifyInstance } from 'fastify';
import type { GetCatalog } from '../../../application/use-cases/GetCatalog.js';
import type { PokemonCatalogService } from '../../../domain/services/PokemonCatalogService.js';

/**
 * HTTP catalog routes (REST API).
 * GET /api/catalog         — list all Pokemon
 * GET /api/catalog/:id     — get Pokemon detail
 * GET /health              — health check
 */
export function registerCatalogRoutes(
  app: FastifyInstance,
  deps: { getCatalog: GetCatalog; catalog: PokemonCatalogService },
): void {
  app.get('/list', async () => {
    const items = await deps.getCatalog.execute();
    return items;
  });

  app.get<{ Params: { id: string } }>('/list/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'Pokemon ID must be a positive integer' });
    }
    const pokemon = await deps.catalog.getDetail(id);
    if (!pokemon) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Pokemon not found' });
    }
    return pokemon;
  });

  app.get('/health', async () => ({ status: 'ok' }));
}

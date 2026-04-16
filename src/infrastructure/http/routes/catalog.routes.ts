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
  app.get('/api/catalog', async () => {
    const items = await deps.getCatalog.execute();
    return { items };
  });

  app.get<{ Params: { id: string } }>('/api/catalog/:id', async (req) => {
    const id = Number(req.params.id);
    const pokemon = await deps.catalog.getDetail(id);
    return { pokemon };
  });

  app.get('/health', async () => ({ status: 'ok' }));
}

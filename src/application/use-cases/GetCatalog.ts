import { CatalogListItem, PokemonCatalogService } from '../../domain/services/PokemonCatalogService.js';

/**
 * Retrieves the full Pokemon catalog for listing.
 */
export class GetCatalog {
  constructor(private readonly _catalog: PokemonCatalogService) {}

  execute(): Promise<CatalogListItem[]> {
    return this._catalog.list();
  }
}
import { PokemonSnapshot } from '../entities/Pokemon.js';

/**
 * CatalogListItem — lightweight DTO from catalog list endpoint.
 */
export interface CatalogListItem {
  id: number;
  name: string;
}

/**
 * PokemonCatalogService — Port (driven)
 * Domain layer uses this interface to access the external Pokemon API.
 * Infrastructure provides the HTTP adapter.
 */
export interface PokemonCatalogService {
  list(): Promise<CatalogListItem[]>;
  getDetail(id: number): Promise<PokemonSnapshot>;
  getManyDetails(ids: number[]): Promise<PokemonSnapshot[]>;
}

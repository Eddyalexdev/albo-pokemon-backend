import { Move } from '../entities/Move.js';

/**
 * MoveCatalogService — Port (driven)
 * Domain layer uses this interface to fetch moves from an external catalog.
 */
export interface MoveCatalogService {
  getMovesForPokemon(pokemonId: number): Promise<Move[]>;
}
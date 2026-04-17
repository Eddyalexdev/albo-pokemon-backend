import { request } from 'undici';
import { Move } from '../../domain/entities/Move.js';
import { MoveCatalogService } from '../../domain/services/MoveCatalogService.js';

/**
 * PokeApiMoveService — Adapter (driven)
 * Fetches real Pokemon moves from https://pokeapi.co/
 *
 * Flow:
 * 1. GET /pokemon/{id} → get list of moves
 * 2. For each move, GET /move/{name} → get power, accuracy, type
 * 3. Pick 4 random moves from the available ones
 */
export class PokeApiMoveService implements MoveCatalogService {
  private readonly baseUrl = 'https://pokeapi.co/api/v2';
  private readonly maxMoves = 4;
  private readonly cache = new Map<number, Move[]>();

  async getMovesForPokemon(pokemonId: number): Promise<Move[]> {
    if (this.cache.has(pokemonId)) {
      return this.cache.get(pokemonId)!;
    }

    try {
      // Get Pokemon data with moves
      const res = await request(`${this.baseUrl}/pokemon/${pokemonId}`);
      if (res.statusCode >= 400) {
        return this.getFallbackMoves(pokemonId);
      }
      const body = (await res.body.json()) as PokemonApiResponse;
      const moves = body.moves ?? [];

      // Get details for each move (limit to avoid too many requests)
      const selectedMoves = this.pickRandomMoves(moves, this.maxMoves);
      const moveDetails = await Promise.all(
        selectedMoves.map((m) => this.fetchMoveDetail(m.move.url)),
      );

      const validMoves = moveDetails.filter((m): m is Move => m !== null);
      const result = validMoves.length > 0 ? validMoves : this.getFallbackMoves(pokemonId);

      this.cache.set(pokemonId, result);
      return result;
    } catch {
      return this.getFallbackMoves(pokemonId);
    }
  }

  private async fetchMoveDetail(url: string): Promise<Move | null> {
    try {
      const res = await request(url);
      if (res.statusCode >= 400) return null;
      const body = (await res.body.json()) as MoveApiResponse;

      // Skip moves with 0 power (status moves) or undefined
      if (!body.power || body.power === 0) return null;

      return {
        name: this.formatMoveName(body.name),
        power: body.power,
        accuracy: body.accuracy ?? 100,
        type: body.type?.name ?? 'normal',
      };
    } catch {
      return null;
    }
  }

  private pickRandomMoves(moves: PokemonMove[], count: number): PokemonMove[] {
    const copy = [...moves];
    const out: PokemonMove[] = [];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      const [item] = copy.splice(idx, 1);
      if (item) out.push(item);
    }
    return out;
  }

  private formatMoveName(name: string): string {
    return name
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Fallback moves when API fails — basic moves that work for any Pokemon
   */
  private getFallbackMoves(pokemonId: number): Move[] {
    return [
      { name: 'Tackle', power: 40, accuracy: 100, type: 'normal' },
      { name: 'Quick Attack', power: 35, accuracy: 100, type: 'normal' },
      { name: 'Body Slam', power: 50, accuracy: 85, type: 'normal' },
      { name: 'Hyper Beam', power: 65, accuracy: 70, type: 'normal' },
    ];
  }
}

// API response types
interface PokemonApiResponse {
  moves: PokemonMove[];
}

interface PokemonMove {
  move: {
    name: string;
    url: string;
  };
}

interface MoveApiResponse {
  name: string;
  power: number | null;
  accuracy: number | null;
  type: {
    name: string;
  };
}
import { request } from 'undici';
import { CatalogListItem, PokemonCatalogService } from '../../domain/services/PokemonCatalogService.js';
import { PokemonSnapshot } from '../../domain/entities/Pokemon.js';

/**
 * HttpPokemonCatalogService — Adapter (driven)
 * Implements PokemonCatalogService by calling the external PokeAPI.
 *
 * Wire format unwrapping happens here — domain never sees the envelope.
 *
 * GET /list   → { success, total, data: [{id, name, sprite}] }
 * GET /list/:id → { success, data: {id, name, type, hp, attack, defense, speed, sprite} }
 */
interface ListWireItem {
  id: number;
  name: string;
  sprite?: string;
}

interface DetailWireItem {
  id: number;
  name: string;
  type: string[];
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export class HttpPokemonCatalogService implements PokemonCatalogService {
  private listCache: CatalogListItem[] | null = null;

  constructor(private readonly baseUrl: string) {}

  async list(): Promise<CatalogListItem[]> {
    if (this.listCache) return this.listCache;
    const res = await request(`${this.baseUrl}/list`);
    if (res.statusCode >= 400) throw new Error(`Catalog list failed: ${res.statusCode}`);
    const body = (await res.body.json()) as Envelope<ListWireItem[]>;
    const items = (body.data ?? []).map((x) => ({ id: x.id, name: x.name }));
    this.listCache = items;
    return items;
  }

  async getDetail(id: number): Promise<PokemonSnapshot> {
    const res = await request(`${this.baseUrl}/list/${id}`);
    if (res.statusCode >= 400) throw new Error(`Catalog detail failed: ${res.statusCode}`);
    const body = (await res.body.json()) as Envelope<DetailWireItem>;
    const d = body.data;
    return {
      id: d.id,
      name: d.name,
      type: d.type ?? [],
      hp: d.hp,
      maxHp: d.hp,
      attack: d.attack,
      defense: d.defense,
      speed: d.speed,
      sprite: d.sprite,
      defeated: false,
    };
  }

  async getManyDetails(ids: number[]): Promise<PokemonSnapshot[]> {
    return Promise.all(ids.map((id) => this.getDetail(id)));
  }
}

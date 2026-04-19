import { request } from 'undici';
import { CatalogListItem, PokemonCatalogService } from '../../domain/services/PokemonCatalogService.js';
import { PokemonSnapshot } from '../../domain/entities/Pokemon.js';
import { WireSchemas } from '../http/wire/catalog.wire.js';

/**
 * HttpPokemonCatalogService — Adapter (driven)
 * Implements PokemonCatalogService by calling the external PokeAPI.
 *
 * Wire format unwrapping happens here — domain never sees the envelope.
 *
 * GET /list   → { success, total, data: [{id, name, sprite}] }
 * GET /list/:id → { success, data: {id, name, type, hp, attack, defense, speed, sprite} }
 */

export class HttpPokemonCatalogService implements PokemonCatalogService {
  private listCache: CatalogListItem[] | null = null;

  constructor(private readonly baseUrl: string) {}

  async list(): Promise<CatalogListItem[]> {
    if (this.listCache) return this.listCache;
    const res = await request(`${this.baseUrl}/list`);
    if (res.statusCode >= 400) throw new Error(`Catalog list failed: ${res.statusCode}`);
    const parsed = WireSchemas.Envelope(WireSchemas.ListWireItem.array()).safeParse(await res.body.json());
    if (!parsed.success) throw new Error(`Catalog list wire format invalid: ${parsed.error.message}`);
    const items = parsed.data.data.map((x) => ({ id: x.id, name: x.name }));
    this.listCache = items;
    return items;
  }

  async getDetail(id: number): Promise<PokemonSnapshot> {
    const res = await request(`${this.baseUrl}/list/${id}`);
    if (res.statusCode >= 400) throw new Error(`Catalog detail failed: ${res.statusCode}`);
    const parsed = WireSchemas.Envelope(WireSchemas.DetailWireItem).safeParse(await res.body.json());
    if (!parsed.success) throw new Error(`Catalog detail wire format invalid: ${parsed.error.message}`);
    const d = parsed.data.data;
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
    // NOTE: N+1 pattern — one HTTP call per Pokemon.
    // Acceptable for team size of 3. If team size grows, consider a batch endpoint.
    return Promise.all(ids.map((id) => this.getDetail(id)));
  }
}

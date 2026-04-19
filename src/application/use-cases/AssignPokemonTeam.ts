import { Pokemon } from '../../domain/entities/Pokemon.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { PokemonCatalogService } from '../../domain/services/PokemonCatalogService.js';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';
import { Mutex } from '../../shared/Mutex.js';

const TEAM_SIZE = 3;

/**
 * Assigns 3 random Pokemon to a player from the catalog.
 * Pokemon already taken by the opponent are excluded.
 * Uses a per-lobby Mutex to prevent race conditions when both players
 * request a team simultaneously.
 */
export class AssignPokemonTeam {
  private readonly mutexes = new Map<string, Mutex>();

  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _catalog: PokemonCatalogService,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  private getMutex(lobbyId: string): Mutex {
    if (!this.mutexes.has(lobbyId)) {
      this.mutexes.set(lobbyId, new Mutex());
    }
    return this.mutexes.get(lobbyId)!;
  }

  async execute(playerId: string, lobbyId: string): Promise<void> {
    const mutex = this.getMutex(lobbyId);
    await mutex.runExclusive(async () => {
      const lobby = await this._lobbies.findById(lobbyId);
      if (!lobby) throw new NotFoundError('Lobby not found');

      const player = lobby.findPlayerById(playerId);
      if (!player) throw new NotFoundError('Player not found in lobby');

      const opponent = lobby.opponentOf(playerId);
      const takenIds = new Set<number>((opponent?.team ?? []).map((p) => p.id));

      const all = await this._catalog.list();
      const available = all.filter((p) => !takenIds.has(p.id));
      if (available.length < TEAM_SIZE) {
        throw new DomainError('Not enough Pokemon available to form a team');
      }

      const picked = this.pickRandom(available, TEAM_SIZE).map((p) => p.id);
      const details = await this._catalog.getManyDetails(picked);

      const team = details.map(
        (d) =>
          new Pokemon(d.id, d.name, d.type, d.maxHp, d.attack, d.defense, d.speed, d.sprite),
      );

      player.assignTeam(team);
      await this._lobbies.save(lobby);
      this._publisher.lobbyStatus(lobby.toSnapshot(), lobbyId);
    });
  }

  /**
   * Cleanup mutex for a lobby — called when lobby is reset.
   */
  cleanup(lobbyId: string): void {
    this.mutexes.delete(lobbyId);
  }

  private pickRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      const [item] = copy.splice(idx, 1);
      if (item) out.push(item);
    }
    return out;
  }
}

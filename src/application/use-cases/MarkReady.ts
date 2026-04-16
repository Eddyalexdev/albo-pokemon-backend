import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

/**
 * Marks a player as ready. If both players are ready,
 * the battle starts automatically.
 */
export class MarkReady {
  constructor(
    private readonly lobbies: LobbyRepository,
    private readonly battles: BattleRepository,
    private readonly publisher: BattleEventPublisher,
  ) {}

  async execute(playerId: string): Promise<void> {
    const lobby = await this.lobbies.findOrCreateSingleton();
    lobby.markPlayerReady(playerId);

    const started = lobby.startBattleIfReady();
    await this.lobbies.save(lobby);
    this.publisher.lobbyStatus(lobby.toSnapshot());

    if (started) {
      await this.battles.create(lobby.id);
      this.publisher.battleStart(lobby.toSnapshot());
    }
  }
}

import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

/**
 * Marks a player as ready. If both players are ready,
 * the battle starts automatically.
 */
export class MarkReady {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _battles: BattleRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  async execute(playerId: string): Promise<void> {
    const lobby = await this._lobbies.findOrCreateSingleton();
    lobby.markPlayerReady(playerId);

    const started = lobby.startBattleIfReady();
    await this._lobbies.save(lobby);
    this._publisher.lobbyStatus(lobby.toSnapshot());

    if (started) {
      await this._battles.create(lobby.id);
      this._publisher.battleStart(lobby.toSnapshot());
    }
  }
}
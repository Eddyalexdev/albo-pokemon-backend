import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

/**
 * Resets the lobby to its initial state, allowing a new battle to start.
 */
export class ResetLobby {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  async execute(): Promise<void> {
    await this._lobbies.reset();
    const fresh = await this._lobbies.findOrCreateSingleton();
    this._publisher.lobbyStatus(fresh.toSnapshot());
  }
}
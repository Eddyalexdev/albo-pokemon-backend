import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

/**
 * Resets the lobby to its initial state, allowing a new battle to start.
 */
export class ResetLobby {
  constructor(
    private readonly lobbies: LobbyRepository,
    private readonly publisher: BattleEventPublisher,
  ) {}

  async execute(): Promise<void> {
    await this.lobbies.reset();
    const fresh = await this.lobbies.findOrCreateSingleton();
    this.publisher.lobbyStatus(fresh.toSnapshot());
  }
}

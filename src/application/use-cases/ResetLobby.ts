import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

/**
 * Deletes a lobby and creates a fresh one.
 * Allows starting a new battle after the previous one ended.
 * Also cleans up any associated battle record.
 */
export class ResetLobby {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _battles: BattleRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  async execute(lobbyId: string): Promise<void> {
    await this._battles.delete(lobbyId);
    await this._lobbies.delete(lobbyId);
    const fresh = await this._lobbies.create(lobbyId);
    this._publisher.lobbyStatus(fresh.toSnapshot(), lobbyId);
  }
}
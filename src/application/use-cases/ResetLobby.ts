import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';
import { AssignPokemonTeam } from './AssignPokemonTeam.js';
import { ProcessAttack } from './ProcessAttack.js';

/**
 * Deletes a lobby and creates a fresh one.
 * Allows starting a new battle after the previous one ended.
 * Also cleans up any associated battle record and in-memory mutexes.
 */
export class ResetLobby {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _battles: BattleRepository,
    private readonly _publisher: BattleEventPublisher,
    private readonly _assignTeam: AssignPokemonTeam,
    private readonly _processAttack: ProcessAttack,
  ) {}

  async execute(lobbyId: string): Promise<void> {
    await this._battles.delete(lobbyId);
    await this._lobbies.delete(lobbyId);

    // Clean up in-memory mutexes to prevent memory leaks
    this._assignTeam.cleanup(lobbyId);
    this._processAttack.cleanup(lobbyId);

    const fresh = await this._lobbies.create(lobbyId);
    this._publisher.lobbyStatus(fresh.toSnapshot(), lobbyId);
  }
}
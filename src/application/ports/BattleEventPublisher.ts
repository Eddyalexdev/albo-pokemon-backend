import { LobbySnapshot } from '../../domain/entities/Lobby.js';
import { TurnRecord } from '../../domain/entities/Battle.js';

/**
 * BattleEventPublisher — Port (driving)
 * Use cases emit events through this interface.
 * Infrastructure provides the Socket.IO adapter.
 */
export interface BattleEventPublisher {
  lobbyStatus(lobby: LobbySnapshot): void;
  battleStart(lobby: LobbySnapshot): void;
  turnResult(lobby: LobbySnapshot, turn: TurnRecord): void;
  pokemonDefeated(lobby: LobbySnapshot, playerId: string, pokemonId: number): void;
  pokemonEntered(lobby: LobbySnapshot, playerId: string, pokemonId: number): void;
  battleEnd(lobby: LobbySnapshot, winnerPlayerId: string): void;
  error(socketId: string, message: string): void;
}

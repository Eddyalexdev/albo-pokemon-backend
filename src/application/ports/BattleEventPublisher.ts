import { LobbySnapshot } from '../../domain/entities/Lobby.js';
import { TurnRecord } from '../../domain/entities/Battle.js';

/**
 * BattleEventPublisher — Port (driving)
 * Use cases emit events through this interface.
 * Infrastructure provides the Socket.IO adapter.
 */
export interface BattleEventPublisher {
  lobbyStatus(lobby: LobbySnapshot, lobbyId: string): void;
  battleStart(lobby: LobbySnapshot, lobbyId: string): void;
  turnResult(lobby: LobbySnapshot, turn: TurnRecord, lobbyId: string): void;
  pokemonDefeated(lobby: LobbySnapshot, playerId: string, pokemonId: number, lobbyId: string): void;
  pokemonEntered(lobby: LobbySnapshot, playerId: string, pokemonId: number, lobbyId: string): void;
  battleEnd(lobby: LobbySnapshot, winnerPlayerId: string, lobbyId: string): void;
}
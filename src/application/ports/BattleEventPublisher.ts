import { LobbySnapshot } from '../../domain/entities/Lobby.js';
import { TurnRecord } from '../../domain/entities/Battle.js';

/**
 * BattleEventPublisher — Port (driving)
 * Use cases emit events through this interface.
 * Infrastructure provides the Socket.IO adapter.
 */
export interface BattleEventPublisher {
  lobbyStatus(_lobby: LobbySnapshot): void;
  battleStart(_lobby: LobbySnapshot): void;
  turnResult(_lobby: LobbySnapshot, _turn: TurnRecord): void;
  pokemonDefeated(_lobby: LobbySnapshot, _playerId: string, _pokemonId: number): void;
  pokemonEntered(_lobby: LobbySnapshot, _playerId: string, _pokemonId: number): void;
  battleEnd(_lobby: LobbySnapshot, _winnerPlayerId: string): void;
  error(_socketId: string, _message: string): void;
}
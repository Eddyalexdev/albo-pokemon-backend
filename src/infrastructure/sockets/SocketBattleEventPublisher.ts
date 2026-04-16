import type { Server } from 'socket.io';
import { LobbySnapshot } from '../../domain/entities/Lobby.js';
import { TurnRecord } from '../../domain/entities/Battle.js';
import { BattleEventPublisher } from '../../application/ports/BattleEventPublisher.js';

export const LOBBY_ROOM = 'lobby:singleton';

/**
 * SocketBattleEventPublisher — Adapter (driving)
 * Implements BattleEventPublisher using Socket.IO.
 * All connected clients in the lobby room receive events.
 */
export class SocketBattleEventPublisher implements BattleEventPublisher {
  constructor(private readonly io: Server) {}

  lobbyStatus(lobby: LobbySnapshot): void {
    this.io.to(LOBBY_ROOM).emit('lobby_status', lobby);
  }

  battleStart(lobby: LobbySnapshot): void {
    this.io.to(LOBBY_ROOM).emit('battle_start', lobby);
  }

  turnResult(lobby: LobbySnapshot, turn: TurnRecord): void {
    this.io.to(LOBBY_ROOM).emit('turn_result', { lobby, turn });
  }

  pokemonDefeated(lobby: LobbySnapshot, playerId: string, pokemonId: number): void {
    this.io.to(LOBBY_ROOM).emit('pokemon_defeated', { lobby, playerId, pokemonId });
  }

  pokemonEntered(lobby: LobbySnapshot, playerId: string, pokemonId: number): void {
    this.io.to(LOBBY_ROOM).emit('pokemon_entered', { lobby, playerId, pokemonId });
  }

  battleEnd(lobby: LobbySnapshot, winnerPlayerId: string): void {
    this.io.to(LOBBY_ROOM).emit('battle_end', { lobby, winnerPlayerId });
  }

  error(socketId: string, message: string): void {
    this.io.to(socketId).emit('error_event', { message });
  }
}

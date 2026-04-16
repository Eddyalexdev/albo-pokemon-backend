import type { Server } from 'socket.io';
import { LobbySnapshot } from '../../domain/entities/Lobby.js';
import { TurnRecord } from '../../domain/entities/Battle.js';
import { BattleEventPublisher } from '../../application/ports/BattleEventPublisher.js';

function lobbyRoom(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}

/**
 * SocketBattleEventPublisher — Adapter (driving)
 * Implements BattleEventPublisher using Socket.IO.
 * All clients in the specific lobby room receive events.
 */
export class SocketBattleEventPublisher implements BattleEventPublisher {
  constructor(private readonly io: Server) {}

  lobbyStatus(lobby: LobbySnapshot, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('lobby_status', lobby);
  }

  battleStart(lobby: LobbySnapshot, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('battle_start', lobby);
  }

  turnResult(lobby: LobbySnapshot, turn: TurnRecord, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('turn_result', { lobby, turn });
  }

  pokemonDefeated(lobby: LobbySnapshot, playerId: string, pokemonId: number, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('pokemon_defeated', { lobby, playerId, pokemonId });
  }

  pokemonEntered(lobby: LobbySnapshot, playerId: string, pokemonId: number, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('pokemon_entered', { lobby, playerId, pokemonId });
  }

  battleEnd(lobby: LobbySnapshot, winnerPlayerId: string, lobbyId: string): void {
    this.io.to(lobbyRoom(lobbyId)).emit('battle_end', { lobby, winnerPlayerId });
  }

  error(socketId: string, message: string): void {
    this.io.to(socketId).emit('error_event', { message });
  }
}
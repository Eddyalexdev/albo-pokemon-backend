import { Lobby } from '../entities/Lobby.js';

/**
 * LobbyRepository — Port (driven)
 * Application layer depends on this abstract interface.
 * Infrastructure provides the MongoDB implementation.
 */
export interface LobbyRepository {
  findById(id: string): Promise<Lobby | null>;
  create(id: string): Promise<Lobby>;
  findWaitingLobby(): Promise<Lobby | null>;
  save(lobby: Lobby): Promise<void>;
  delete(id: string): Promise<void>;
}
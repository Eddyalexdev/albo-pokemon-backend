import { Lobby } from '../entities/Lobby.js';

/**
 * LobbyRepository — Port (driven)
 * Application layer depends on this abstract interface.
 * Infrastructure provides the MongoDB implementation.
 */
export interface LobbyRepository {
  findById(id: string): Promise<Lobby | null>;
  findOrCreateSingleton(): Promise<Lobby>;
  save(lobby: Lobby): Promise<void>;
  reset(): Promise<void>;
}

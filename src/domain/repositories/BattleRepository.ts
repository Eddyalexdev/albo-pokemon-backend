import { BattleSnapshot, TurnRecord } from '../entities/Battle.js';

/**
 * BattleRepository — Port (driven)
 * Application layer depends on this abstract interface.
 * Infrastructure provides the MongoDB implementation.
 */
export interface BattleRepository {
  create(lobbyId: string): Promise<BattleSnapshot>;
  appendTurn(battleId: string, turn: TurnRecord): Promise<void>;
  finish(battleId: string, winnerPlayerId: string): Promise<void>;
  findActiveByLobby(lobbyId: string): Promise<BattleSnapshot | null>;
}

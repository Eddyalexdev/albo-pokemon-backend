/**
 * TurnRecord — Value Object (immutable record of a single battle turn)
 * Battle — Entity tracking the full battle lifecycle and all turns.
 */

/**
 * Pure damage calculation — rule: damage = max(1, attack - defense)
 */
export function calculateDamage(attack: number, defense: number): number {
  const raw = attack - defense;
  return raw < 1 ? 1 : raw;
}

export interface TurnRecord {
  turnNumber: number;
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerPokemonId: number;
  defenderPokemonId: number;
  damage: number;
  defenderHpAfter: number;
  defenderDefeated: boolean;
  timestamp: string;
}

export interface BattleSnapshot {
  id: string;
  lobbyId: string;
  turns: TurnRecord[];
  winnerPlayerId: string | null;
  startedAt: string;
  endedAt: string | null;
}

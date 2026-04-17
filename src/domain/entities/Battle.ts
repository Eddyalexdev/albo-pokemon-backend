/**
 * TurnRecord — Value Object (immutable record of a single battle turn)
 * Battle — Entity tracking the full battle lifecycle and all turns.
 */

/**
 * Damage = max(1, attackerAttack - defenderDefense)
 * Spec: if the result is less than 1, set to 1 (minimum damage rule).
 */
export function calculateDamage(attackerAttack: number, defenderDefense: number): number {
  const raw = attackerAttack - defenderDefense;
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

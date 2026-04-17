/**
 * TurnRecord — Value Object (immutable record of a single battle turn)
 * Battle — Entity tracking the full battle lifecycle and all turns.
 */

/**
 * Pure damage calculation with move power.
 * Rule: damage = max(1, movePower + attackBonus - defenseReduction)
 * Where attackBonus = attacker.attack * 0.3 and defenseReduction = defender.defense * 0.2
 * This prevents one-hit kills while keeping moves meaningful.
 */
export function calculateDamage(
  movePower: number,
  attackerAttack: number,
  defenderDefense: number,
): number {
  const raw = movePower + (attackerAttack * 0.3) - (defenderDefense * 0.2);
  return raw < 1 ? 1 : Math.floor(raw);
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
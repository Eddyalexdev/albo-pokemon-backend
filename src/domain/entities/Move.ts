/**
 * Move — Value Object
 * Represents a Pokemon move with its stats.
 */
export interface Move {
  name: string;
  power: number;
  accuracy: number;
  type: string;
}

export interface MoveSnapshot {
  name: string;
  power: number;
  accuracy: number;
  type: string;
}

export function moveToSnapshot(m: Move): MoveSnapshot {
  return { name: m.name, power: m.power, accuracy: m.accuracy, type: m.type };
}

export function snapshotToMove(s: MoveSnapshot): Move {
  return { name: s.name, power: s.power, accuracy: s.accuracy, type: s.type };
}
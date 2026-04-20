import { describe, it, expect } from 'vitest';
import { Player } from './Player.js';
import { Pokemon } from './Pokemon.js';

function makePokemon(
  id: number,
  maxHp: number,
  attack: number,
  defense: number,
  speed: number,
  hp?: number,
): Pokemon {
  return new Pokemon(id, `Mon-${id}`, ['Normal'], maxHp, attack, defense, speed, 'url', hp ?? maxHp, hp !== undefined ? hp <= 0 : false);
}

function makeTeam(hpValues: number[], speed: number = 50): Pokemon[] {
  return hpValues.map(
    (hp, i) => makePokemon(i + 1, 100, 50, 50, speed, hp),
  );
}

describe('Player', () => {
  describe('markReady', () => {
    it('throws if team does not have 3 Pokemon', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      // Assign 2 Pokemon - should throw when calling markReady
      // Note: assignTeam itself throws if not exactly 3, so we need to test markReady behavior
      // The markReady method checks if team length is 3
      // Since assignTeam throws, we test the validation indirectly through the error
      expect(() => player.markReady()).toThrow();
    });

    it('works when team has 3 Pokemon', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      player.assignTeam(makeTeam([100, 100, 100]));
      expect(player.ready).toBe(false);
      player.markReady();
      expect(player.ready).toBe(true);
    });
  });

  describe('advanceToNextAlive', () => {
    it('returns false and does nothing when no Pokemon in team', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      expect(player.advanceToNextAlive()).toBe(false);
      expect(player.activeIndex).toBe(0);
    });

    it('returns true and advances activeIndex to next non-defeated', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      // Team: [defeated (index 0), alive (index 1), alive (index 2)]
      player.assignTeam(makeTeam([0, 80, 60]));
      expect(player.activePokemon?.id).toBe(1);
      expect(player.advanceToNextAlive()).toBe(true);
      expect(player.activeIndex).toBe(1);
      expect(player.activePokemon?.id).toBe(2);
    });
  });

  describe('hasAliveRemaining', () => {
    it('returns true if any Pokemon not defeated', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      player.assignTeam(makeTeam([0, 80, 60]));
      expect(player.hasAliveRemaining()).toBe(true);
    });

    it('returns false if all Pokemon defeated', () => {
      const player = new Player('player-1', 'socket-1', 'TestPlayer');
      player.assignTeam(makeTeam([0, 0, 0]));
      expect(player.hasAliveRemaining()).toBe(false);
    });
  });
});

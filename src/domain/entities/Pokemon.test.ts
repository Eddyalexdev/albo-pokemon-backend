import { describe, it, expect, beforeEach } from 'vitest';
import { Pokemon } from './Pokemon.js';

function makePokemon(overrides: {
  id?: number;
  name?: string;
  type?: string[];
  maxHp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  sprite?: string;
  hp?: number;
  defeated?: boolean;
} = {}): Pokemon {
  return new Pokemon(
    overrides.id ?? 1,
    overrides.name ?? 'TestMon',
    overrides.type ?? ['Normal'],
    overrides.maxHp ?? 100,
    overrides.attack ?? 50,
    overrides.defense ?? 50,
    overrides.speed ?? 50,
    overrides.sprite ?? 'https://example.com/sprite.gif',
    overrides.hp ?? overrides.maxHp ?? 100,
    overrides.defeated ?? false,
  );
}

describe('Pokemon', () => {
  describe('receiveDamage', () => {
    it('reduces currentHp correctly', () => {
      const pokemon = makePokemon({ maxHp: 100, hp: 100 });
      pokemon.receiveDamage(30);
      expect(pokemon.currentHp).toBe(70);
    });

    it('never goes below 0 (e.g., 10 damage on 5 HP results in 0, not -5)', () => {
      const pokemon = makePokemon({ maxHp: 100, hp: 5 });
      pokemon.receiveDamage(10);
      expect(pokemon.currentHp).toBe(0);
    });

    it('sets defeated to true when HP reaches 0', () => {
      const pokemon = makePokemon({ maxHp: 100, hp: 10 });
      pokemon.receiveDamage(10);
      expect(pokemon.currentHp).toBe(0);
      expect(pokemon.defeated).toBe(true);
    });

    it('does nothing on already defeated Pokemon', () => {
      const pokemon = makePokemon({ maxHp: 100, hp: 0, defeated: true });
      pokemon.receiveDamage(50);
      expect(pokemon.currentHp).toBe(0);
    });
  });
});

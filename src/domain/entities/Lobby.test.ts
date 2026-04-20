import { describe, it, expect, beforeEach } from 'vitest';
import { Lobby } from './Lobby.js';
import { Player } from './Player.js';
import { LobbyStatus } from '../value-objects/LobbyStatus.js';
import { Pokemon } from './Pokemon.js';

function makePlayer(id: string, overrides: { socketId?: string; nickname?: string } = {}): Player {
  return new Player(
    id,
    overrides.socketId ?? 'socket-1',
    overrides.nickname ?? `Player-${id}`,
  );
}

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

function makeTeamWithHp(hpValues: number[]): Pokemon[] {
  return hpValues.map(
    (hp, i) => makePokemon(i + 1, 100, 50, 50, 50, hp),
  );
}

describe('Lobby', () => {
  describe('startBattleIfReady', () => {
    it('returns false when not enough players', () => {
      const lobby = new Lobby('lobby-1');
      const player = makePlayer('player-1');
      player.assignTeam(makeTeamWithHp([100, 100, 100]));
      lobby.addPlayer(player);
      expect(lobby.startBattleIfReady()).toBe(false);
      expect(lobby.status).toBe(LobbyStatus.Waiting);
    });

    it('returns false when players not ready', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      player1.assignTeam(makeTeamWithHp([100, 100, 100]));
      player2.assignTeam(makeTeamWithHp([100, 100, 100]));
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      expect(lobby.startBattleIfReady()).toBe(false);
      expect(lobby.status).toBe(LobbyStatus.Waiting);
    });

    it('determines first turn by speed (higher speed first)', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      // Player 1 team with speed 30
      player1.assignTeam([
        makePokemon(1, 100, 50, 50, 30),
        makePokemon(2, 100, 50, 50, 30),
        makePokemon(3, 100, 50, 50, 30),
      ]);
      // Player 2 team with speed 70 (higher)
      player2.assignTeam([
        makePokemon(4, 100, 50, 50, 70),
        makePokemon(5, 100, 50, 50, 70),
        makePokemon(6, 100, 50, 50, 70),
      ]);
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      lobby.markPlayerReady(player1.id);
      lobby.markPlayerReady(player2.id);
      expect(lobby.startBattleIfReady()).toBe(true);
      expect(lobby.status).toBe(LobbyStatus.Battling);
      // Player 2 has higher speed, so player 2 should go first
      expect(lobby.currentTurnPlayerId).toBe(player2.id);
    });

    it('when speeds are equal, first player in array goes first', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      // Both teams have speed 50
      player1.assignTeam([
        makePokemon(1, 100, 50, 50, 50),
        makePokemon(2, 100, 50, 50, 50),
        makePokemon(3, 100, 50, 50, 50),
      ]);
      player2.assignTeam([
        makePokemon(4, 100, 50, 50, 50),
        makePokemon(5, 100, 50, 50, 50),
        makePokemon(6, 100, 50, 50, 50),
      ]);
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      lobby.markPlayerReady(player1.id);
      lobby.markPlayerReady(player2.id);
      expect(lobby.startBattleIfReady()).toBe(true);
      // First player in array (player1) should go first when speeds are equal
      expect(lobby.currentTurnPlayerId).toBe(player1.id);
    });
  });

  describe('switchTurn', () => {
    it('alternates between players', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      player1.assignTeam(makeTeamWithHp([100, 100, 100]));
      player2.assignTeam(makeTeamWithHp([100, 100, 100]));
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      lobby.markPlayerReady(player1.id);
      lobby.markPlayerReady(player2.id);
      lobby.startBattleIfReady();
      const firstTurn = lobby.currentTurnPlayerId;
      lobby.switchTurn();
      expect(lobby.currentTurnPlayerId).not.toBe(firstTurn);
      lobby.switchTurn();
      expect(lobby.currentTurnPlayerId).toBe(firstTurn);
    });
  });

  describe('finish', () => {
    it('sets status to finished and winnerPlayerId', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      lobby.finish(player1.id);
      expect(lobby.status).toBe(LobbyStatus.Finished);
      expect(lobby.winnerPlayerId).toBe(player1.id);
    });
  });

  describe('markPlayerReady', () => {
    it('marks correct player as ready', () => {
      const lobby = new Lobby('lobby-1');
      const player1 = makePlayer('player-1');
      const player2 = makePlayer('player-2');
      player1.assignTeam(makeTeamWithHp([100, 100, 100]));
      player2.assignTeam(makeTeamWithHp([100, 100, 100]));
      lobby.addPlayer(player1);
      lobby.addPlayer(player2);
      expect(player1.ready).toBe(false);
      expect(player2.ready).toBe(false);
      lobby.markPlayerReady(player1.id);
      expect(player1.ready).toBe(true);
      expect(player2.ready).toBe(false);
      lobby.markPlayerReady(player2.id);
      expect(player1.ready).toBe(true);
      expect(player2.ready).toBe(true);
    });
  });
});

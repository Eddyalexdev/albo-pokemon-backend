import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessAttack } from './ProcessAttack.js';
import { Lobby } from '../../domain/entities/Lobby.js';
import { Player } from '../../domain/entities/Player.js';
import { Pokemon } from '../../domain/entities/Pokemon.js';
import { BattleSnapshot } from '../../domain/entities/Battle.js';
import { NotFoundError, InvalidOperationError } from '../../domain/errors/DomainError.js';

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

function makePlayerWithTeam(id: string, pokemon: Pokemon[]): Player {
  const player = new Player(id, `socket-${id}`, `Player-${id}`);
  player.assignTeam(pokemon);
  return player;
}

function createLobbyBattleReady(
  lobbyId: string,
  player1: Player,
  player2: Player,
): { lobby: Lobby; battle: BattleSnapshot } {
  const lobby = new Lobby(lobbyId);
  lobby.addPlayer(player1);
  lobby.addPlayer(player2);
  lobby.markPlayerReady(player1.id);
  lobby.markPlayerReady(player2.id);
  lobby.startBattleIfReady();
  const battle: BattleSnapshot = {
    id: 'battle-1',
    lobbyId,
    turns: [],
    winnerPlayerId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  return { lobby, battle };
}

describe('ProcessAttack', () => {
  let useCase: ProcessAttack;
  let mockLobbies: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findWaitingLobby: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockBattles: {
    findActiveByLobby: ReturnType<typeof vi.fn>;
    appendTurn: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockPublisher: {
    turnResult: ReturnType<typeof vi.fn>;
    pokemonDefeated: ReturnType<typeof vi.fn>;
    pokemonEntered: ReturnType<typeof vi.fn>;
    battleEnd: ReturnType<typeof vi.fn>;
    lobbyStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLobbies = {
      findById: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      findWaitingLobby: vi.fn(),
      delete: vi.fn(),
    };
    mockBattles = {
      findActiveByLobby: vi.fn(),
      appendTurn: vi.fn(),
      finish: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };
    mockPublisher = {
      turnResult: vi.fn(),
      pokemonDefeated: vi.fn(),
      pokemonEntered: vi.fn(),
      battleEnd: vi.fn(),
      lobbyStatus: vi.fn(),
    };
    useCase = new ProcessAttack(mockLobbies as any, mockBattles as any, mockPublisher as any);
  });

  it('throws when lobby not found', async () => {
    mockLobbies.findById.mockResolvedValue(null);
    await expect(useCase.execute('player-1', 'lobby-1')).rejects.toThrow(NotFoundError);
  });

  it('throws when battle not active', async () => {
    const lobby = new Lobby('lobby-1');
    mockLobbies.findById.mockResolvedValue(lobby);
    await expect(useCase.execute('player-1', 'lobby-1')).rejects.toThrow(InvalidOperationError);
  });

  it('throws when not players turn', async () => {
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 50, 50, 30),
      makePokemon(2, 100, 50, 50, 30),
      makePokemon(3, 100, 50, 50, 30),
    ]);
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 100, 50, 50, 70),
      makePokemon(5, 100, 50, 50, 70),
      makePokemon(6, 100, 50, 50, 70),
    ]);
    const { lobby } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    // player2 has first turn but player1 attacks
    await expect(useCase.execute('player-1', 'lobby-1')).rejects.toThrow(InvalidOperationError);
  });

  it('processes attack and applies damage correctly', async () => {
    // Player 1 has higher speed (70) so goes first
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 84, 50, 70),
      makePokemon(2, 100, 50, 50, 70),
      makePokemon(3, 100, 50, 50, 70),
    ]);
    // Player 2 has lower speed (30)
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 100, 50, 50, 30),
      makePokemon(5, 100, 50, 50, 30),
      makePokemon(6, 100, 50, 50, 30),
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);
    // Player1 attacks (84 atk) vs Player2 def (50) = 34 damage
    await useCase.execute('player-1', 'lobby-1');
    expect(player2.activePokemon?.currentHp).toBe(66);
  });

  it('switches turn after attack', async () => {
    // Player 1 has higher speed (70) so goes first
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 50, 50, 70),
      makePokemon(2, 100, 50, 50, 70),
      makePokemon(3, 100, 50, 50, 70),
    ]);
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 100, 50, 50, 30),
      makePokemon(5, 100, 50, 50, 30),
      makePokemon(6, 100, 50, 50, 30),
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);
    // Player1 has first turn
    expect(lobby.currentTurnPlayerId).toBe('player-1');
    await useCase.execute('player-1', 'lobby-1');
    expect(lobby.currentTurnPlayerId).toBe('player-2');
  });

  it('emits turnResult after attack', async () => {
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 50, 50, 70),
      makePokemon(2, 100, 50, 50, 70),
      makePokemon(3, 100, 50, 50, 70),
    ]);
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 100, 50, 50, 30),
      makePokemon(5, 100, 50, 50, 30),
      makePokemon(6, 100, 50, 50, 30),
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);
    await useCase.execute('player-1', 'lobby-1');
    expect(mockPublisher.turnResult).toHaveBeenCalled();
    // turnResult(lobby.toSnapshot(), turn, lobbyId)
    // call[0] = lobby snapshot, call[1] = turn, call[2] = lobbyId
    const call = mockPublisher.turnResult.mock.calls[0]!;
    const turn = call[1] as { attackerPlayerId: string; defenderPlayerId: string };
    expect(turn.attackerPlayerId).toBe('player-1');
    expect(turn.defenderPlayerId).toBe('player-2');
  });

  it('emits pokemonDefeated and pokemonEntered when Pokemon defeated and has backup', async () => {
    // Player 1 has higher speed and attacks first
    // With attack=60 and defense=50, damage = 10, which defeats HP=5 Pokemon
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 60, 50, 70),
      makePokemon(2, 100, 50, 50, 70),
      makePokemon(3, 100, 50, 50, 70),
    ]);
    // Player2's first Pokemon has very low HP (5)
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 5, 50, 50, 30), // Will be defeated (10 damage > 5 HP)
      makePokemon(5, 100, 50, 50, 30),
      makePokemon(6, 100, 50, 50, 30),
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);
    // Player1 attacks - should defeat player2's first Pokemon
    await useCase.execute('player-1', 'lobby-1');
    expect(mockPublisher.pokemonDefeated).toHaveBeenCalled();
    expect(mockPublisher.pokemonEntered).toHaveBeenCalled();
  });

  it('emits battleEnd when last Pokemon defeated', async () => {
    // Setup: Player1 has high attack (60) to defeat low HP Pokemon
    // Player2 has 3 Pokemon with 1 HP each. After all 3 are defeated,
    // the battleEnd event should be emitted with player1 as winner.
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 60, 50, 70),
      makePokemon(2, 100, 50, 50, 70),
      makePokemon(3, 100, 50, 50, 70),
    ]);
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 1, 50, 50, 30), // 1 HP - will be defeated
      makePokemon(5, 1, 50, 50, 30), // 1 HP
      makePokemon(6, 1, 50, 50, 30), // 1 HP
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);

    // Turn order: player1 (speed 70) goes first, then player2 (speed 30)
    // But player1 has much higher attack (60 vs 50 defense = 10 damage)
    // So player1 can defeat each of player2's 1 HP Pokemon in one hit

    // Attack 1: player1 attacks player2's first Pokemon (HP=1)
    // After: player2's Pokemon defeated, player2 advances to Pokemon 2
    await useCase.execute('player-1', 'lobby-1');
    expect(player2.activePokemon?.id).toBe(5); // Should be on second Pokemon now
    expect(mockPublisher.pokemonDefeated).toHaveBeenCalled();
    expect(mockPublisher.pokemonEntered).toHaveBeenCalled();

    // Attack 2: player2 attacks player1 (but we're testing the sequence)
    // We need to mock player2's attack to not defeat player1
    mockBattles.appendTurn.mockResolvedValue(undefined);
    mockLobbies.save.mockResolvedValue(undefined);
    // Manually execute player2's turn - it won't end the battle
    await useCase.execute('player-2', 'lobby-1');

    // Attack 3: player1 attacks player2's second Pokemon (HP=1)
    // After: player2's Pokemon defeated, player2 advances to Pokemon 3
    vi.clearAllMocks();
    await useCase.execute('player-1', 'lobby-1');
    expect(player2.activePokemon?.id).toBe(6); // Should be on third Pokemon now

    // Attack 4: player2 attacks player1 again
    await useCase.execute('player-2', 'lobby-1');

    // Attack 5: player1 attacks player2's last Pokemon (HP=1)
    // After: player2's Pokemon defeated, no more Pokemon -> battleEnd
    vi.clearAllMocks();
    await useCase.execute('player-1', 'lobby-1');
    expect(mockPublisher.battleEnd).toHaveBeenCalled();
    const call = mockPublisher.battleEnd.mock.calls[0]!;
    expect(call[1]).toBe('player-1'); // player1 is winner
  });

  it('handles tie in turn order (first player always)', async () => {
    // Both teams have equal speed (50)
    const player1 = makePlayerWithTeam('player-1', [
      makePokemon(1, 100, 50, 50, 50),
      makePokemon(2, 100, 50, 50, 50),
      makePokemon(3, 100, 50, 50, 50),
    ]);
    const player2 = makePlayerWithTeam('player-2', [
      makePokemon(4, 100, 50, 50, 50),
      makePokemon(5, 100, 50, 50, 50),
      makePokemon(6, 100, 50, 50, 50),
    ]);
    const { lobby, battle } = createLobbyBattleReady('lobby-1', player1, player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockBattles.findActiveByLobby.mockResolvedValue(battle);
    // When speeds are equal, first player (player1) should go first
    expect(lobby.currentTurnPlayerId).toBe('player-1');
  });
});

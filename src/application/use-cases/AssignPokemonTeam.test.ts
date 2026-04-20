import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignPokemonTeam } from './AssignPokemonTeam.js';
import { Lobby } from '../../domain/entities/Lobby.js';
import { Player } from '../../domain/entities/Player.js';
import { Pokemon } from '../../domain/entities/Pokemon.js';
import { NotFoundError, DomainError } from '../../domain/errors/DomainError.js';

function makeTeam(hpValues: number[]): Pokemon[] {
  return hpValues.map(
    (hp, i) =>
      new Pokemon(i + 1, `Mon-${i}`, ['Normal'], 100, 50, 50, 50, 'url', hp, hp <= 0),
  );
}

function makePlayer(id: string, nickname: string, team?: Pokemon[]): Player {
  const player = new Player(id, `socket-${id}`, nickname);
  if (team) {
    player.assignTeam(team);
  }
  return player;
}

describe('AssignPokemonTeam', () => {
  let useCase: AssignPokemonTeam;
  let mockCatalog: {
    list: ReturnType<typeof vi.fn>;
    getManyDetails: ReturnType<typeof vi.fn>;
  };
  let mockLobbies: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findWaitingLobby: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockPublisher: {
    lobbyStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCatalog = {
      list: vi.fn(),
      getManyDetails: vi.fn(),
    };
    mockLobbies = {
      findById: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      findWaitingLobby: vi.fn(),
      delete: vi.fn(),
    };
    mockPublisher = {
      lobbyStatus: vi.fn(),
    };
    useCase = new AssignPokemonTeam(mockLobbies as any, mockCatalog as any, mockPublisher as any);
  });

  it('throws when lobby not found', async () => {
    mockLobbies.findById.mockResolvedValue(null);
    await expect(useCase.execute('player-1', 'lobby-1')).rejects.toThrow(NotFoundError);
  });

  it('throws when player not found in lobby', async () => {
    const lobby = new Lobby('lobby-1');
    const player = makePlayer('player-1', 'Player1', makeTeam([100, 100, 100]));
    lobby.addPlayer(player);
    mockLobbies.findById.mockResolvedValue(lobby);
    await expect(useCase.execute('player-not-exist', 'lobby-1')).rejects.toThrow(NotFoundError);
  });

  it('throws when not enough Pokemon available (less than 3)', async () => {
    const lobby = new Lobby('lobby-1');
    const player = makePlayer('player-1', 'Player1');
    lobby.addPlayer(player);
    mockLobbies.findById.mockResolvedValue(lobby);
    // Only 2 Pokemon available in catalog
    mockCatalog.list.mockResolvedValue([
      { id: 1, name: 'Pikachu' },
      { id: 2, name: 'Charmander' },
    ]);
    await expect(useCase.execute('player-1', 'lobby-1')).rejects.toThrow(DomainError);
  });

  it('assigns 3 Pokemon when available', async () => {
    const lobby = new Lobby('lobby-1');
    const player = makePlayer('player-1', 'Player1');
    lobby.addPlayer(player);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockCatalog.list.mockResolvedValue([
      { id: 1, name: 'Pikachu' },
      { id: 2, name: 'Charmander' },
      { id: 3, name: 'Squirtle' },
      { id: 4, name: 'Bulbasaur' },
    ]);
    mockCatalog.getManyDetails.mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: `Pokemon-${id}`,
          type: ['Normal'],
          maxHp: 100,
          attack: 50,
          defense: 50,
          speed: 50,
          sprite: 'url',
          hp: 100,
          defeated: false,
        })),
      ),
    );
    await useCase.execute('player-1', 'lobby-1');
    expect(player.team.length).toBe(3);
  });

  it('filters out opponents Pokemon from available pool', async () => {
    const lobby = new Lobby('lobby-1');
    const player1 = makePlayer('player-1', 'Player1');
    // Opponent has Pokemon with ids 1, 2, 3
    const player2 = makePlayer('player-2', 'Player2', makeTeam([100, 100, 100]));
    // Override player2's team to have specific ids
    player2.assignTeam([
      new Pokemon(1, 'Mon-1', ['Normal'], 100, 50, 50, 50, 'url', 100, false),
      new Pokemon(2, 'Mon-2', ['Normal'], 100, 50, 50, 50, 'url', 100, false),
      new Pokemon(3, 'Mon-3', ['Normal'], 100, 50, 50, 50, 'url', 100, false),
    ]);
    lobby.addPlayer(player1);
    lobby.addPlayer(player2);
    mockLobbies.findById.mockResolvedValue(lobby);
    // Catalog has 1, 2, 3 (taken) and 4, 5, 6, 7 (available)
    mockCatalog.list.mockResolvedValue([
      { id: 1, name: 'Pikachu' },
      { id: 2, name: 'Charmander' },
      { id: 3, name: 'Squirtle' },
      { id: 4, name: 'Bulbasaur' },
      { id: 5, name: 'Metapod' },
      { id: 6, name: 'Weedle' },
      { id: 7, name: 'Caterpie' },
    ]);
    mockCatalog.getManyDetails.mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: `Pokemon-${id}`,
          type: ['Normal'],
          maxHp: 100,
          attack: 50,
          defense: 50,
          speed: 50,
          sprite: 'url',
          hp: 100,
          defeated: false,
        })),
      ),
    );
    await useCase.execute('player-1', 'lobby-1');
    // Should only get Pokemon from the available pool (4, 5, 6, 7) - 3 are needed
    expect(player1.team.length).toBe(3);
    // All assigned Pokemon should have ids >= 4
    player1.team.forEach((p) => {
      expect(p.id).toBeGreaterThanOrEqual(4);
    });
  });

  it('persists lobby after assignment', async () => {
    const lobby = new Lobby('lobby-1');
    const player = makePlayer('player-1', 'Player1');
    lobby.addPlayer(player);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockCatalog.list.mockResolvedValue([
      { id: 1, name: 'Pikachu' },
      { id: 2, name: 'Charmander' },
      { id: 3, name: 'Squirtle' },
      { id: 4, name: 'Bulbasaur' },
    ]);
    mockCatalog.getManyDetails.mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: `Pokemon-${id}`,
          type: ['Normal'],
          maxHp: 100,
          attack: 50,
          defense: 50,
          speed: 50,
          sprite: 'url',
          hp: 100,
          defeated: false,
        })),
      ),
    );
    await useCase.execute('player-1', 'lobby-1');
    expect(mockLobbies.save).toHaveBeenCalledWith(lobby);
  });

  it('emits lobbyStatus after assignment', async () => {
    const lobby = new Lobby('lobby-1');
    const player = makePlayer('player-1', 'Player1');
    lobby.addPlayer(player);
    mockLobbies.findById.mockResolvedValue(lobby);
    mockCatalog.list.mockResolvedValue([
      { id: 1, name: 'Pikachu' },
      { id: 2, name: 'Charmander' },
      { id: 3, name: 'Squirtle' },
      { id: 4, name: 'Bulbasaur' },
    ]);
    mockCatalog.getManyDetails.mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: `Pokemon-${id}`,
          type: ['Normal'],
          maxHp: 100,
          attack: 50,
          defense: 50,
          speed: 50,
          sprite: 'url',
          hp: 100,
          defeated: false,
        })),
      ),
    );
    await useCase.execute('player-1', 'lobby-1');
    expect(mockPublisher.lobbyStatus).toHaveBeenCalledWith(lobby.toSnapshot(), 'lobby-1');
  });
});

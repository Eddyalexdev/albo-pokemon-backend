import { Pokemon, PokemonSnapshot } from './Pokemon.js';

/**
 * Player — Entity
 * Aggregate root for a player's team and battle state.
 * Identity is stable (id assigned by JoinLobby use case).
 */
export interface PlayerSnapshot {
  id: string;
  socketId: string;
  nickname: string;
  team: PokemonSnapshot[];
  activeIndex: number;
  ready: boolean;
}

export class Player {
  constructor(
    public readonly id: string,
    public socketId: string,
    public readonly nickname: string,
    private _team: Pokemon[] = [],
    private _activeIndex: number = 0,
    private _ready: boolean = false,
  ) {}

  get team(): readonly Pokemon[] {
    return this._team;
  }

  get ready(): boolean {
    return this._ready;
  }

  get activeIndex(): number {
    return this._activeIndex;
  }

  get activePokemon(): Pokemon | null {
    return this._team[this._activeIndex] ?? null;
  }

  updateSocketId(newSocketId: string): void {
    this.socketId = newSocketId;
  }

  assignTeam(team: Pokemon[]): void {
    if (team.length !== 3) {
      throw new Error('A team must have exactly 3 Pokemon');
    }
    this._team = team;
    this._activeIndex = 0;
    this._ready = false;
  }

  markReady(): void {
    if (this._team.length !== 3) {
      throw new Error('Cannot be ready without a full team');
    }
    this._ready = true;
  }

  /**
   * Advance to the next non-defeated Pokemon.
   * Returns true if a new active was found.
   */
  advanceToNextAlive(): boolean {
    for (let i = this._activeIndex + 1; i < this._team.length; i++) {
      const p = this._team[i]!;
      if (!p.defeated) {
        this._activeIndex = i;
        return true;
      }
    }
    return false;
  }

  hasAliveRemaining(): boolean {
    return this._team.some((p) => !p.defeated);
  }

  toSnapshot(): PlayerSnapshot {
    return {
      id: this.id,
      socketId: this.socketId,
      nickname: this.nickname,
      team: this._team.map((p) => p.toSnapshot()),
      activeIndex: this._activeIndex,
      ready: this._ready,
    };
  }

  static fromSnapshot(s: PlayerSnapshot): Player {
    return new Player(
      s.id,
      s.socketId,
      s.nickname,
      s.team.map((p) => Pokemon.fromSnapshot(p)),
      s.activeIndex,
      s.ready,
    );
  }
}

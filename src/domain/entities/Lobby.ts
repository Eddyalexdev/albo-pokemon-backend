import { Player, PlayerSnapshot } from './Player.js';
import { LobbyStatus } from '../value-objects/LobbyStatus.js';
import { DomainError } from '../errors/DomainError.js';

/**
 * Lobby — Entity / Aggregate Root
 * Manages the single lobby lifecycle: waiting → ready → battling → finished.
 * Coordinates turn order and winner declaration.
 */
export interface LobbySnapshot {
  id: string;
  status: LobbyStatus;
  players: PlayerSnapshot[];
  currentTurnPlayerId: string | null;
  winnerPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class Lobby {
  constructor(
    public readonly _id: string,
    private _status: LobbyStatus = LobbyStatus.Waiting,
    private _players: Player[] = [],
    private _currentTurnPlayerId: string | null = null,
    private _winnerPlayerId: string | null = null,
    public readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date(),
  ) {}

  get status(): LobbyStatus {
    return this._status;
  }

  get players(): readonly Player[] {
    return this._players;
  }

  get currentTurnPlayerId(): string | null {
    return this._currentTurnPlayerId;
  }

  get winnerPlayerId(): string | null {
    return this._winnerPlayerId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  addPlayer(player: Player): void {
    if (this._players.length >= 2) {
      throw new DomainError('Lobby is full');
    }
    if (this._players.some((p) => p.nickname === player.nickname)) {
      throw new DomainError('Nickname already taken in this lobby');
    }
    this._players.push(player);
    this.touch();
  }

  removePlayerBySocket(socketId: string): void {
    this._players = this._players.filter((p) => p.socketId !== socketId);
    if (this._status === LobbyStatus.Waiting || this._status === LobbyStatus.Ready) {
      this._status = LobbyStatus.Waiting;
    }
    this.touch();
  }

  findPlayerById(playerId: string): Player | undefined {
    return this._players.find((p) => p.id === playerId);
  }

  findPlayerBySocket(socketId: string): Player | undefined {
    return this._players.find((p) => p.socketId === socketId);
  }

  opponentOf(playerId: string): Player | undefined {
    return this._players.find((p) => p.id !== playerId);
  }

  /**
   * When both players are ready, transition to Battling
   * and set first turn by highest Speed stat.
   */
  startBattleIfReady(): boolean {
    if (this._players.length !== 2) return false;
    if (!this._players.every((p) => p.ready)) return false;
    if (this._status === LobbyStatus.Battling) return false;

    this._status = LobbyStatus.Battling;
    const [a, b] = this._players;
    if (!a || !b) return false;
    const sa = a.activePokemon?.speed ?? 0;
    const sb = b.activePokemon?.speed ?? 0;
    this._currentTurnPlayerId = sa >= sb ? a.id : b.id;
    this.touch();
    return true;
  }

  switchTurn(): void {
    const current = this._currentTurnPlayerId;
    const next = this._players.find((p) => p.id !== current);
    this._currentTurnPlayerId = next?.id ?? null;
    this.touch();
  }

  finish(winnerPlayerId: string): void {
    this._status = LobbyStatus.Finished;
    this._winnerPlayerId = winnerPlayerId;
    this._currentTurnPlayerId = null;
    this.touch();
  }

  markPlayerReady(playerId: string): void {
    const p = this.findPlayerById(playerId);
    if (!p) throw new DomainError('Player not found in lobby');
    p.markReady();
    if (this._players.length === 2 && this._players.every((x) => x.ready)) {
      this._status = LobbyStatus.Ready;
    }
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  toSnapshot(): LobbySnapshot {
return {
      id: this._id,
      status: this._status,
      players: this._players.map((p) => p.toSnapshot()),
      currentTurnPlayerId: this._currentTurnPlayerId,
      winnerPlayerId: this._winnerPlayerId,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromSnapshot(s: LobbySnapshot): Lobby {
    return new Lobby(
      s.id,
      s.status,
      s.players.map((p) => Player.fromSnapshot(p)),
      s.currentTurnPlayerId,
      s.winnerPlayerId,
      new Date(s.createdAt),
      new Date(s.updatedAt),
    );
  }
}

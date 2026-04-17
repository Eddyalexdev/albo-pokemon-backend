import { randomUUID } from 'node:crypto';
import { Player } from '../../domain/entities/Player.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';
import type { LobbySnapshot } from '../../domain/entities/Lobby.js';

export interface JoinLobbyInput {
  nickname: string;
  socketId: string;
  lobbyId?: string;
}

export interface JoinLobbyOutput {
  playerId: string;
  lobbyId: string;
  lobby: LobbySnapshot;
}

export class JoinLobby {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  async execute(input: JoinLobbyInput): Promise<JoinLobbyOutput> {
    const nickname = input.nickname.trim();
    if (!nickname) throw new DomainError('Nickname is required');

    const lobbyId = input.lobbyId ?? (await this._lobbies.findWaitingLobby())?.id;
    const lobby = lobbyId
      ? await this._lobbies.findById(lobbyId) ?? await this._lobbies.create(lobbyId)
      : await this._lobbies.create(randomUUID());

    // Check for reconnection: player with same nickname but disconnected
    // If found, update socketId and return
    const existingPlayer = lobby.players.find((p) => p.nickname === nickname);
    if (existingPlayer) {
      existingPlayer.updateSocketId(input.socketId);
      await this._lobbies.save(lobby);
      const snapshot = lobby.toSnapshot();
      return { playerId: existingPlayer.id, lobbyId: lobby.id, lobby: snapshot };
    }

    if (lobby.players.length >= 2) {
      throw new DomainError('Lobby is full');
    }

    const player = new Player(randomUUID(), input.socketId, nickname);
    lobby.addPlayer(player);
    await this._lobbies.save(lobby);

    const snapshot = lobby.toSnapshot();
    this._publisher.lobbyStatus(snapshot, lobby.id);
    return { playerId: player.id, lobbyId: lobby.id, lobby: snapshot };
  }
}
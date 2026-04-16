import { randomUUID } from 'node:crypto';
import { Player } from '../../domain/entities/Player.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

export interface JoinLobbyInput {
  nickname: string;
  socketId: string;
  lobbyId?: string;
}

export interface JoinLobbyOutput {
  playerId: string;
  lobbyId: string;
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

    if (lobby.players.length >= 2) {
      throw new DomainError('Lobby is full');
    }

    const player = new Player(randomUUID(), input.socketId, nickname);
    lobby.addPlayer(player);
    await this._lobbies.save(lobby);

    this._publisher.lobbyStatus(lobby.toSnapshot(), lobby.id);
    return { playerId: player.id, lobbyId: lobby.id };
  }
}
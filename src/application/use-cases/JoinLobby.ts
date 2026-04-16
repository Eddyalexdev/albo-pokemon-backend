import { randomUUID } from 'node:crypto';
import { Player } from '../../domain/entities/Player.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';

export interface JoinLobbyInput {
  nickname: string;
  socketId: string;
}

export interface JoinLobbyOutput {
  playerId: string;
  lobbyId: string;
}

export class JoinLobby {
  constructor(
    private readonly lobbies: LobbyRepository,
    private readonly publisher: BattleEventPublisher,
  ) {}

  async execute(input: JoinLobbyInput): Promise<JoinLobbyOutput> {
    const nickname = input.nickname.trim();
    if (!nickname) throw new DomainError('Nickname is required');

    const lobby = await this.lobbies.findOrCreateSingleton();
    const player = new Player(randomUUID(), input.socketId, nickname);
    lobby.addPlayer(player);
    await this.lobbies.save(lobby);

    this.publisher.lobbyStatus(lobby.toSnapshot());
    return { playerId: player.id, lobbyId: lobby.id };
  }
}

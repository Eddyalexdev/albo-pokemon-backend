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
  reconnected: boolean;
}

/**
 * JoinLobby — Use Case
 *
 * Adds a player to the lobby by nickname. Supports reconnection:
 * if the nickname already exists in the lobby (from a previous session),
 * the socketId is updated and the player resumes their session.
 *
 * Flow:
 *  1. Find or create a waiting lobby
 *  2. If same nickname reconnecting → update socketId, return reconnected=true
 *  3. If lobby full → error
 *  4. Otherwise → add new player
 */
export class JoinLobby {
  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  /**
   * @param input.nickname - Player's trainer nickname (1-20 chars)
   * @param input.socketId - Current socket connection id
   * @param input.lobbyId - Optional specific lobby to join (else joins first waiting)
   * @throws DomainError('Lobby is full') - When lobby already has 2 players
   * @throws DomainError('Nickname is required') - When nickname is empty
   */
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
      return { playerId: existingPlayer.id, lobbyId: lobby.id, lobby: snapshot, reconnected: true };
    }

    if (lobby.players.length >= 2) {
      throw new DomainError('Lobby is full');
    }

    const player = new Player(randomUUID(), input.socketId, nickname);
    lobby.addPlayer(player);
    await this._lobbies.save(lobby);

    const snapshot = lobby.toSnapshot();
    this._publisher.lobbyStatus(snapshot, lobby.id);
    return { playerId: player.id, lobbyId: lobby.id, lobby: snapshot, reconnected: false };
  }
}
import { Lobby, LobbySnapshot } from '../../domain/entities/Lobby.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { LobbyStatus } from '../../domain/value-objects/LobbyStatus.js';
import { LobbyModel } from '../database/models/LobbyModel.js';

export class MongoLobbyRepository implements LobbyRepository {
  async findById(id: string): Promise<Lobby | null> {
    const doc = await LobbyModel.findById(id).lean();
    if (!doc) return null;
    return Lobby.fromSnapshot(this.toSnapshot(doc));
  }

  async create(id: string): Promise<Lobby> {
    const fresh = new Lobby(id);
    await this.save(fresh);
    return fresh;
  }

  async findWaitingLobby(): Promise<Lobby | null> {
    const doc = await LobbyModel.findOne({
      status: LobbyStatus.Waiting,
      $expr: { $lt: [{ $size: '$players' }, 2] },
    })
      .sort({ createdAt: 1 })
      .lean();
    if (!doc) return null;
    return Lobby.fromSnapshot(this.toSnapshot(doc));
  }

  async save(lobby: Lobby): Promise<void> {
    const s = lobby.toSnapshot();
    await LobbyModel.findByIdAndUpdate(
      s.id,
      {
        _id: s.id,
        status: s.status,
        players: s.players,
        currentTurnPlayerId: s.currentTurnPlayerId,
        winnerPlayerId: s.winnerPlayerId,
      },
      { upsert: true, new: true },
    );
  }

  async delete(id: string): Promise<void> {
    await LobbyModel.findByIdAndDelete(id);
  }

  private toSnapshot(doc: Record<string, unknown>): LobbySnapshot {
    return {
      id: doc._id as string,
      status: doc.status as LobbyStatus,
      players: doc.players as LobbySnapshot['players'],
      currentTurnPlayerId: (doc.currentTurnPlayerId as string | null) ?? null,
      winnerPlayerId: (doc.winnerPlayerId as string | null) ?? null,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date().toISOString(),
      updatedAt:
        doc.updatedAt instanceof Date
          ? doc.updatedAt.toISOString()
          : new Date().toISOString(),
    };
  }
}
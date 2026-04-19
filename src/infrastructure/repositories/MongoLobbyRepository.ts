import { z } from 'zod';
import { Lobby, LobbySnapshot } from '../../domain/entities/Lobby.js';
import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { LobbyStatus } from '../../domain/value-objects/LobbyStatus.js';
import { LobbyModel } from '../database/models/LobbyModel.js';

/**
 * Wire validation schema for raw MongoDB Lobby documents.
 * Validates at runtime that the persisted data matches our expected shape.
 */
const PlayerDocSchema = z.object({
  id: z.string(),
  socketId: z.string(),
  nickname: z.string(),
  team: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      type: z.array(z.string()),
      hp: z.number(),
      maxHp: z.number(),
      attack: z.number(),
      defense: z.number(),
      speed: z.number(),
      sprite: z.string().url(),
      defeated: z.boolean(),
    }),
  ),
  activeIndex: z.number().int(),
  ready: z.boolean(),
});

const LobbyDocSchema = z.object({
  _id: z.string(),
  status: z.enum(['waiting', 'ready', 'battling', 'finished']),
  players: z.array(PlayerDocSchema),
  currentTurnPlayerId: z.string().nullable(),
  winnerPlayerId: z.string().nullable(),
  createdAt: z.instanceof(Date),
  updatedAt: z.instanceof(Date),
});

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
    const parsed = LobbyDocSchema.safeParse(doc);
    if (!parsed.success) {
      throw new Error(`Invalid lobby document from MongoDB: ${parsed.error.message}`);
    }
    const d = parsed.data;
    return {
      id: d._id,
      status: d.status as LobbyStatus,
      players: d.players,
      currentTurnPlayerId: d.currentTurnPlayerId ?? null,
      winnerPlayerId: d.winnerPlayerId ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
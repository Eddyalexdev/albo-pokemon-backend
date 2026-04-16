import { randomUUID } from 'node:crypto';
import { BattleSnapshot, TurnRecord } from '../../domain/entities/Battle.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleModel } from '../database/models/BattleModel.js';

export class MongoBattleRepository implements BattleRepository {
  async create(lobbyId: string): Promise<BattleSnapshot> {
    const doc = await BattleModel.create({
      _id: randomUUID(),
      lobbyId,
      turns: [],
      startedAt: new Date(),
    });
    return this.toSnapshot(doc.toObject());
  }

  async appendTurn(battleId: string, turn: TurnRecord): Promise<void> {
    await BattleModel.updateOne({ _id: battleId }, { $push: { turns: turn } });
  }

  async finish(battleId: string, winnerPlayerId: string): Promise<void> {
    await BattleModel.updateOne(
      { _id: battleId },
      { $set: { winnerPlayerId, endedAt: new Date() } },
    );
  }

  async findActiveByLobby(lobbyId: string): Promise<BattleSnapshot | null> {
    const doc = await BattleModel.findOne({ lobbyId, endedAt: null })
      .sort({ startedAt: -1 })
      .lean();
    return doc ? this.toSnapshot(doc) : null;
  }

  private toSnapshot(doc: Record<string, unknown>): BattleSnapshot {
    return {
      id: doc._id as string,
      lobbyId: doc.lobbyId as string,
      turns: (doc.turns as TurnRecord[]) ?? [],
      winnerPlayerId: (doc.winnerPlayerId as string | null) ?? null,
      startedAt:
        doc.startedAt instanceof Date
          ? doc.startedAt.toISOString()
          : new Date().toISOString(),
      endedAt:
        doc.endedAt instanceof Date ? doc.endedAt.toISOString() : null,
    };
  }
}

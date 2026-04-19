import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BattleSnapshot, TurnRecord } from '../../domain/entities/Battle.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { BattleModel } from '../database/models/BattleModel.js';

/**
 * Wire validation schema for raw MongoDB Battle documents.
 * Validates at runtime that the persisted data matches our expected shape.
 */
const TurnRecordDocSchema = z.object({
  turnNumber: z.number().int().nonnegative(),
  attackerPlayerId: z.string(),
  defenderPlayerId: z.string(),
  attackerPokemonId: z.number().int(),
  defenderPokemonId: z.number().int(),
  damage: z.number().nonnegative(),
  defenderHpAfter: z.number().nonnegative(),
  defenderDefeated: z.boolean(),
  timestamp: z.string(),
});

const BattleDocSchema = z.object({
  _id: z.string(),
  lobbyId: z.string(),
  turns: z.array(TurnRecordDocSchema),
  winnerPlayerId: z.string().nullable(),
  startedAt: z.instanceof(Date),
  endedAt: z.instanceof(Date).nullable(),
});

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

  async delete(lobbyId: string): Promise<void> {
    await BattleModel.deleteMany({ lobbyId });
  }

  private toSnapshot(doc: Record<string, unknown>): BattleSnapshot {
    const parsed = BattleDocSchema.safeParse(doc);
    if (!parsed.success) {
      throw new Error(`Invalid battle document from MongoDB: ${parsed.error.message}`);
    }
    const d = parsed.data;
    return {
      id: d._id,
      lobbyId: d.lobbyId,
      turns: d.turns,
      winnerPlayerId: d.winnerPlayerId ?? null,
      startedAt: d.startedAt.toISOString(),
      endedAt: d.endedAt?.toISOString() ?? null,
    };
  }
}

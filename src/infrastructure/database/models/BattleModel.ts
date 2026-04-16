import { Schema, model, InferSchemaType } from 'mongoose';

const TurnSchema = new Schema(
  {
    turnNumber: { type: Number, required: true },
    attackerPlayerId: { type: String, required: true },
    defenderPlayerId: { type: String, required: true },
    attackerPokemonId: { type: Number, required: true },
    defenderPokemonId: { type: Number, required: true },
    damage: { type: Number, required: true },
    defenderHpAfter: { type: Number, required: true },
    defenderDefeated: { type: Boolean, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false },
);

const BattleSchema = new Schema(
  {
    _id: { type: String, required: true },
    lobbyId: { type: String, required: true, index: true },
    turns: { type: [TurnSchema], default: [] },
    winnerPlayerId: { type: String, default: null },
    startedAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export type BattleDoc = InferSchemaType<typeof BattleSchema>;
export const BattleModel = model('Battle', BattleSchema);

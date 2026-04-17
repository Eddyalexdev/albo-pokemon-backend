import { Schema, model, InferSchemaType } from 'mongoose';

const MoveSchema = new Schema(
  {
    name: { type: String, required: true },
    power: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const PokemonSchema = new Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    type: { type: [String], required: true },
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    speed: { type: Number, required: true },
    sprite: { type: String, required: true },
    defeated: { type: Boolean, default: false },
    moves: { type: [MoveSchema], default: [] },
  },
  { _id: false },
);

const PlayerSchema = new Schema(
  {
    id: { type: String, required: true },
    socketId: { type: String, required: true },
    nickname: { type: String, required: true },
    team: { type: [PokemonSchema], default: [] },
    activeIndex: { type: Number, default: 0 },
    ready: { type: Boolean, default: false },
  },
  { _id: false },
);

const LobbySchema = new Schema(
  {
    _id: { type: String, required: true },
    status: {
      type: String,
      enum: ['waiting', 'ready', 'battling', 'finished'],
      default: 'waiting',
    },
    players: { type: [PlayerSchema], default: [] },
    currentTurnPlayerId: { type: String, default: null },
    winnerPlayerId: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export type LobbyDoc = InferSchemaType<typeof LobbySchema>;
export const LobbyModel = model('Lobby', LobbySchema);

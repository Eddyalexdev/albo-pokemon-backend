import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { JoinLobby } from '../../../application/use-cases/JoinLobby.js';
import { AssignPokemonTeam } from '../../../application/use-cases/AssignPokemonTeam.js';
import { MarkReady } from '../../../application/use-cases/MarkReady.js';
import { ProcessAttack } from '../../../application/use-cases/ProcessAttack.js';
import { ResetLobby } from '../../../application/use-cases/ResetLobby.js';
import { DomainError } from '../../../domain/errors/DomainError.js';
import { LOBBY_ROOM } from '../SocketBattleEventPublisher.js';

export interface LobbyHandlersDeps {
  joinLobby: JoinLobby;
  assignTeam: AssignPokemonTeam;
  markReady: MarkReady;
  processAttack: ProcessAttack;
  resetLobby: ResetLobby;
}

const joinSchema = z.object({ nickname: z.string().min(1).max(20) });

interface SocketData {
  playerId?: string;
}

/** Player ↔ socket mapping kept in memory (single-lobby scope). */
const playerBySocket = new Map<string, string>();

export function registerLobbyHandlers(io: Server, deps: LobbyHandlersDeps): void {
  io.on('connection', (socket: Socket) => {
    socket.join(LOBBY_ROOM);

    socket.on('join_lobby', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        const { nickname } = joinSchema.parse(payload);
        const result = await deps.joinLobby.execute({ nickname, socketId: socket.id });
        (socket.data as SocketData).playerId = result.playerId;
        playerBySocket.set(socket.id, result.playerId);
        ack?.({ ok: true, ...result });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('assign_pokemon', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const playerId = requirePlayer(socket);
        await deps.assignTeam.execute(playerId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('ready', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const playerId = requirePlayer(socket);
        await deps.markReady.execute(playerId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('attack', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const playerId = requirePlayer(socket);
        await deps.processAttack.execute(playerId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('reset_lobby', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        await deps.resetLobby.execute();
        (socket.data as SocketData).playerId = undefined;
        playerBySocket.delete(socket.id);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('disconnect', () => {
      playerBySocket.delete(socket.id);
    });
  });
}

function requirePlayer(socket: Socket): string {
  const playerId = (socket.data as SocketData).playerId;
  if (!playerId) throw new DomainError('Join the lobby first');
  return playerId;
}

function handleError(socket: Socket, err: unknown, ack?: (res: unknown) => void): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const code = err instanceof DomainError ? err.code : 'INTERNAL_ERROR';
  ack?.({ ok: false, code, message });
  socket.emit('error_event', { code, message });
}

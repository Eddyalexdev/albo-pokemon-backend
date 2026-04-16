import type { Server, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { JoinLobby } from '../../../application/use-cases/JoinLobby.js';
import { AssignPokemonTeam } from '../../../application/use-cases/AssignPokemonTeam.js';
import { MarkReady } from '../../../application/use-cases/MarkReady.js';
import { ProcessAttack } from '../../../application/use-cases/ProcessAttack.js';
import { ResetLobby } from '../../../application/use-cases/ResetLobby.js';
import { DomainError } from '../../../domain/errors/DomainError.js';

export interface LobbyHandlersDeps {
  joinLobby: JoinLobby;
  assignTeam: AssignPokemonTeam;
  markReady: MarkReady;
  processAttack: ProcessAttack;
  resetLobby: ResetLobby;
}

const joinSchema = z.object({
  nickname: z.string().min(1).max(20),
  lobbyId: z.string().optional(),
});

interface SocketInfo {
  playerId: string;
  lobbyId: string;
}

const socketInfoMap = new Map<string, SocketInfo>();

function lobbyRoom(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}

export function registerLobbyHandlers(io: Server, deps: LobbyHandlersDeps): void {
  io.on('connection', (socket: Socket) => {
    socket.on('create_lobby', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        const newLobbyId = randomUUID();
        const lobby = await deps.joinLobby.execute({
          nickname: 'HOST',
          socketId: socket.id,
          lobbyId: newLobbyId,
        });
        socket.join(lobbyRoom(lobby.lobbyId));
        socketInfoMap.set(socket.id, { playerId: lobby.playerId, lobbyId: lobby.lobbyId });
        ack?.({ ok: true, lobbyId: lobby.lobbyId });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('join_lobby', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        const { nickname, lobbyId } = joinSchema.parse(payload);
        const result = await deps.joinLobby.execute({ nickname, socketId: socket.id, lobbyId });
        socket.join(lobbyRoom(result.lobbyId));
        socketInfoMap.set(socket.id, { playerId: result.playerId, lobbyId: result.lobbyId });
        ack?.({ ok: true, ...result });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('assign_pokemon', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const { playerId, lobbyId } = requirePlayer(socket);
        await deps.assignTeam.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('ready', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const { playerId, lobbyId } = requirePlayer(socket);
        await deps.markReady.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('attack', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const { playerId, lobbyId } = requirePlayer(socket);
        await deps.processAttack.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('reset_lobby', async (_: unknown, ack?: (res: unknown) => void) => {
      try {
        const { lobbyId } = requirePlayer(socket);
        await deps.resetLobby.execute(lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('disconnect', () => {
      socketInfoMap.delete(socket.id);
    });
  });
}

function requirePlayer(socket: Socket): SocketInfo {
  const info = socketInfoMap.get(socket.id);
  if (!info) throw new DomainError('Join the lobby first');
  return info;
}

function handleError(socket: Socket, err: unknown, ack?: (res: unknown) => void): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const code = err instanceof DomainError ? err.code : 'INTERNAL_ERROR';
  ack?.({ ok: false, code, message });
  socket.emit('error_event', { code, message });
}
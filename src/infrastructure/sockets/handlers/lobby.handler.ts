import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { JoinLobby } from '../../../application/use-cases/JoinLobby.js';
import { AssignPokemonTeam } from '../../../application/use-cases/AssignPokemonTeam.js';
import { MarkReady } from '../../../application/use-cases/MarkReady.js';
import { ProcessAttack } from '../../../application/use-cases/ProcessAttack.js';
import { ResetLobby } from '../../../application/use-cases/ResetLobby.js';
import { DomainError, NotFoundError } from '../../../domain/errors/DomainError.js';
import { LobbyRepository } from '../../../domain/repositories/LobbyRepository.js';
import { lobbyRoom } from '../../../shared/socket.js';

export interface LobbyHandlersDeps {
  joinLobby: JoinLobby;
  assignTeam: AssignPokemonTeam;
  markReady: MarkReady;
  processAttack: ProcessAttack;
  resetLobby: ResetLobby;
  lobbies: LobbyRepository;
}

const joinSchema = z.object({
  nickname: z.string().min(1).max(20),
});

// Intentional empty payload schemas — these events carry no data;
// state is retrieved from the authenticated socket identity (socketInfoMap).
const assignPokemonSchema = z.object({});
const readySchema = z.object({});
const attackSchema = z.object({});
const resetLobbySchema = z.object({});

interface SocketInfo {
  playerId: string;
  lobbyId: string;
}

/**
 * In-memory socket-to-player mapping.
 * NOTE: This Map is per-process. In a multi-process deployment (PM2 cluster,
 * Node.js cluster module), each process has its own Map, leading to inconsistent
 * state. If horizontal scaling is planned, replace this with a shared store
 * (e.g., Redis + Socket.IO adapter).
 */
const socketInfoMap = new Map<string, SocketInfo>();

/**
 * Removes stale socket entry when a player reconnects with a new socket.
 * Prevents race condition where two sockets share the same playerId.
 */
function removeStaleSocketEntry(playerId: string): void {
  for (const [socketId, info] of socketInfoMap.entries()) {
    if (info.playerId === playerId) {
      socketInfoMap.delete(socketId);
      break;
    }
  }
}

export function registerLobbyHandlers(io: Server, deps: LobbyHandlersDeps): void {
  io.on('connection', (socket: Socket) => {
    socket.on('join_lobby', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        const { nickname } = joinSchema.parse(payload);
        const result = await deps.joinLobby.execute({ nickname, socketId: socket.id });

        // If reconnecting, invalidate the old socket entry to prevent
        // two sockets from being associated with the same playerId
        if (result.reconnected) {
          removeStaleSocketEntry(result.playerId);
        }

        socket.join(lobbyRoom(result.lobbyId));
        socketInfoMap.set(socket.id, { playerId: result.playerId, lobbyId: result.lobbyId });
        socket.emit('lobby_status', result.lobby);
        ack?.({ ok: true, playerId: result.playerId, lobbyId: result.lobbyId });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('assign_pokemon', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        assignPokemonSchema.parse(payload); // validates even if empty
        const { playerId, lobbyId } = await requirePlayer(socket, deps.lobbies);
        await deps.assignTeam.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('ready', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        readySchema.parse(payload);
        const { playerId, lobbyId } = await requirePlayer(socket, deps.lobbies);
        await deps.markReady.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('attack', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        attackSchema.parse(payload);
        const { playerId, lobbyId } = await requirePlayer(socket, deps.lobbies);
        await deps.processAttack.execute(playerId, lobbyId);
        ack?.({ ok: true });
      } catch (err) {
        handleError(socket, err, ack);
      }
    });

    socket.on('reset_lobby', async (payload: unknown, ack?: (res: unknown) => void) => {
      try {
        resetLobbySchema.parse(payload);
        const { lobbyId } = await requirePlayer(socket, deps.lobbies);
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

/**
 * Validates that the socket has joined a lobby and the player still exists
 * in the actual lobby state (not just in the local socket map).
 * Prevents authorization bypass where a socket could hold stale playerId.
 */
async function requirePlayer(socket: Socket, lobbies: LobbyRepository): Promise<SocketInfo> {
  const info = socketInfoMap.get(socket.id);
  if (!info) throw new DomainError('Join the lobby first');

  const lobby = await lobbies.findById(info.lobbyId);
  if (!lobby) throw new NotFoundError('Lobby not found');

  const player = lobby.findPlayerById(info.playerId);
  if (!player) throw new DomainError('You are no longer part of this lobby');

  return info;
}

function handleError(socket: Socket, err: unknown, ack?: (res: unknown) => void): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const code = err instanceof DomainError ? err.code : 'INTERNAL_ERROR';
  ack?.({ ok: false, code, message });
  socket.emit('error_event', { code, message });
}

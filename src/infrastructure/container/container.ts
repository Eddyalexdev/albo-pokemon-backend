import type { Server } from 'socket.io';
import { Env } from '../config/env.js';
import { MongoLobbyRepository } from '../repositories/MongoLobbyRepository.js';
import { MongoBattleRepository } from '../repositories/MongoBattleRepository.js';
import { HttpPokemonCatalogService } from '../services/HttpPokemonCatalogService.js';
import { SocketBattleEventPublisher } from '../sockets/SocketBattleEventPublisher.js';
import { GetCatalog } from '../../application/use-cases/GetCatalog.js';
import { JoinLobby } from '../../application/use-cases/JoinLobby.js';
import { AssignPokemonTeam } from '../../application/use-cases/AssignPokemonTeam.js';
import { MarkReady } from '../../application/use-cases/MarkReady.js';
import { ProcessAttack } from '../../application/use-cases/ProcessAttack.js';
import { ResetLobby } from '../../application/use-cases/ResetLobby.js';

/**
 * DI container — explicit wiring, no reflection needed.
 * Wires domain ports to infrastructure adapters.
 */
export function buildContainer(env: Env, io: Server) {
  const lobbies = new MongoLobbyRepository();
  const battles = new MongoBattleRepository();
  const catalog = new HttpPokemonCatalogService(env.POKEMON_API_BASE_URL);
  const publisher = new SocketBattleEventPublisher(io);

  const getCatalog = new GetCatalog(catalog);
  const joinLobby = new JoinLobby(lobbies, publisher);
  const assignTeam = new AssignPokemonTeam(lobbies, catalog, publisher);
  const markReady = new MarkReady(lobbies, battles, publisher);
  const processAttack = new ProcessAttack(lobbies, battles, publisher);
  const resetLobby = new ResetLobby(lobbies, battles, publisher);

  return {
    catalog,
    publisher,
    getCatalog,
    joinLobby,
    assignTeam,
    markReady,
    processAttack,
    resetLobby,
  };
}

export type Container = ReturnType<typeof buildContainer>;

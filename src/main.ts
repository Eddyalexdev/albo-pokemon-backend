import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { loadEnv } from './infrastructure/config/env.js';
import { connectMongo, disconnectMongo } from './infrastructure/database/connection.js';
import { buildContainer } from './infrastructure/container/container.js';
import { registerCatalogRoutes } from './infrastructure/http/routes/catalog.routes.js';
import { registerErrorHandler } from './infrastructure/http/error-handler.js';
import { registerLobbyHandlers } from './infrastructure/sockets/handlers/lobby.handler.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: { target: 'pino-pretty' },
    },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  registerErrorHandler(app);

  await connectMongo(env.MONGO_URI);
  app.log.info('MongoDB connected');

  const io = new SocketIOServer(app.server, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  const container = buildContainer(env, io);

  registerCatalogRoutes(app, {
    getCatalog: container.getCatalog,
    catalog: container.catalog,
  });

  registerLobbyHandlers(io, {
    joinLobby: container.joinLobby,
    assignTeam: container.assignTeam,
    markReady: container.markReady,
    processAttack: container.processAttack,
    resetLobby: container.resetLobby,
  });

  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down`);
    io.close();
    await app.close();
    await disconnectMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});

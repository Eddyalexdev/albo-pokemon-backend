# Architecture

## Overview

Pokemon Stadium Lite follows **Clean Architecture** principles with strict layer separation. The codebase is divided into three main layers, each with a specific responsibility.

## Layer Structure

```
src/
├── domain/                    # Business rules (pure, no dependencies)
│   ├── entities/              # Core business objects
│   ├── value-objects/        # Immutable value types
│   ├── repositories/          # Port interfaces (driven)
│   ├── services/             # Port interfaces (driven)
│   └── errors/              # Domain error types
│
├── application/              # Use cases (orchestration)
│   ├── use-cases/           # Application business rules
│   └── ports/               # Port interfaces (driving)
│
├── infrastructure/           # External implementations
│   ├── http/               # Fastify REST API
│   ├── sockets/            # Socket.IO real-time
│   ├── repositories/       # MongoDB adapters
│   ├── services/           # External API adapters
│   ├── database/           # Mongoose models
│   ├── config/             # Environment validation
│   └── container/          # Dependency injection wiring
│
└── shared/                  # Cross-layer utilities
    ├── Mutex.ts            # Async mutex for atomic operations
    └── socket.ts           # Socket.IO helpers
```

## Dependency Rule

Dependencies flow inward only. Each layer depends only on layers closer to the center.

```
         Infrastructure
              |
              v
         Application
              |
              v
            Domain
```

- **Domain** knows nothing about Application or Infrastructure
- **Application** knows about Domain and port interfaces
- **Infrastructure** implements the port interfaces defined by Domain and Application

## Layer Responsibilities

### Domain Layer

Contains pure business logic with zero external dependencies.

**Entities** are the core business objects:
- `Lobby` - Aggregate root managing game state
- `Player` - Player with team and battle state
- `Pokemon` - Pokemon with HP, stats, and status

**Value Objects** are immutable types:
- `LobbyStatus` - Enum: waiting, ready, battling, finished

**Ports** define interfaces without implementation:
- `LobbyRepository` - Persistence contract for lobbies
- `BattleRepository` - Persistence contract for battles
- `PokemonCatalogService` - External catalog contract

### Application Layer

Contains use cases that orchestrate domain entities. Each use case represents a single business action.

**Use Cases:**
- `JoinLobby` - Enter lobby with nickname
- `AssignPokemonTeam` - Receive random team
- `MarkReady` - Confirm readiness
- `ProcessAttack` - Execute battle attack
- `ResetLobby` - Start new game
- `GetCatalog` - List Pokemon catalog

**Ports** define how use cases interact with external systems:
- `BattleEventPublisher` - Real-time event publishing

### Infrastructure Layer

Implements the ports defined by Domain and Application layers. Contains all framework and external tool code.

**HTTP** - Fastify REST API for catalog access
**Sockets** - Socket.IO handlers for real-time game events
**Repositories** - MongoDB/Mongoose persistence
**Services** - HTTP client to external Pokemon API
**Config** - Zod-based environment validation

## Dependency Injection

All dependencies are wired explicitly in `container.ts`. There is no service locator or DI framework.

```typescript
// src/infrastructure/container/container.ts
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
  const resetLobby = new ResetLobby(lobbies, battles, publisher, assignTeam, processAttack);

  return { catalog, publisher, lobbies, getCatalog, joinLobby, assignTeam, markReady, processAttack, resetLobby };
}
```

## Key Design Decisions

### 1. Aggregate Root Pattern

`Lobby` is the aggregate root. All game state changes go through the Lobby entity. Players and Pokemon do not exist independently of a Lobby.

### 2. Port/Adapter Separation

The domain defines interfaces (ports) without knowing their implementations (adapters). This allows swapping MongoDB for PostgreSQL, or Socket.IO for pure WebSockets, without changing business logic.

### 3. Mutex for Atomic Operations

`ProcessAttack` uses a per-lobby Mutex to serialize turn processing. This prevents race conditions when multiple attack requests arrive simultaneously.

### 4. Domain Events via Port

The `BattleEventPublisher` port decouples business logic from real-time delivery. Use cases emit events through the port; infrastructure implements delivery via Socket.IO.

## File Naming Conventions

- Entities: `PascalCase.ts` (e.g., `Lobby.ts`, `Player.ts`)
- Use cases: `PascalCase.ts` (e.g., `JoinLobby.ts`, `ProcessAttack.ts`)
- Repositories: `PascalCase.ts` (e.g., `MongoLobbyRepository.ts`)
- Ports: `PascalCase.ts` (e.g., `BattleEventPublisher.ts`)
- Value objects: `PascalCase.ts` (e.g., `LobbyStatus.ts`)
- Errors: `PascalCase.ts` (e.g., `DomainError.ts`)

## Module Resolution

All imports use the `.js` extension (ESM convention):

```typescript
import { Lobby } from '../../domain/entities/Lobby.js';
```

TypeScript strips the extension during compilation; the runtime import requires it for ESM.

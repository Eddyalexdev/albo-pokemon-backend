# Business Logic

## Battle System

### Damage Calculation

**Rule:** Damage is calculated as the difference between attacker's attack and defender's defense, with a minimum of 1.

```
damage = attacker.attack - defender.defense
if damage < 1 then damage = 1
```

**Implementation:**
```typescript
// src/domain/entities/Battle.ts
export function calculateDamage(attackerAttack: number, defenderDefense: number): number {
  const raw = attackerAttack - defenderDefense;
  return raw < 1 ? 1 : raw;
}
```

**Examples:**
| Attacker Attack | Defender Defense | Raw Damage | Final Damage |
|-----------------|------------------|------------|--------------|
| 84 | 78 | 6 | 6 |
| 84 | 88 | -4 | 1 (minimum) |
| 126 | 126 | 0 | 1 (minimum) |
| 100 | 50 | 50 | 50 |

### HP Update

**Rule:** After damage is applied, defender's current HP is reduced. HP cannot go below 0.

```
defender.currentHp = defender.currentHp - damage
if defender.currentHp < 0 then defender.currentHp = 0
```

**Implementation:**
```typescript
// src/domain/entities/Pokemon.ts
receiveDamage(damage: number): void {
  if (this._defeated) return;
  const next = this._currentHp - damage;
  this._currentHp = next < 0 ? 0 : next;
  if (this._currentHp === 0) this._defeated = true;
}
```

### Turn Order

**Rule:** The first turn belongs to the player whose active Pokemon has the higher Speed stat.

```
firstAttacker = speed(playerA.activePokemon) >= speed(playerB.activePokemon)
  ? playerA
  : playerB
```

**Implementation:**
```typescript
// src/domain/entities/Lobby.ts
startBattleIfReady(): boolean {
  const [a, b] = this._players;
  const sa = a.activePokemon?.speed ?? 0;
  const sb = b.activePokemon?.speed ?? 0;
  this._currentTurnPlayerId = sa >= sb ? a.id : b.id;
  return true;
}
```

If both Pokemon have equal Speed, Player A (first in array) goes first.

### Turn Switching

After each attack, the turn switches to the opponent.

**Implementation:**
```typescript
// src/domain/entities/Lobby.ts
switchTurn(): void {
  const current = this._currentTurnPlayerId;
  const next = this._players.find((p) => p.id !== current);
  this._currentTurnPlayerId = next?.id ?? null;
}
```

### Defeat Conditions

**Rule:** A Pokemon is defeated when its HP reaches 0.

**Rule:** When a Pokemon is defeated and the player has remaining Pokemon, the next Pokemon in the team automatically enters battle.

**Rule:** When a player has no remaining Pokemon (all defeated), the battle ends and the opponent is declared winner.

**Implementation:**
```typescript
// src/application/use-cases/ProcessAttack.ts

if (defenderMon.defeated) {
  // Notify that Pokemon fainted
  this._publisher.pokemonDefeated(...);

  // Attempt to advance to next alive Pokemon
  const advanced = defender.advanceToNextAlive();
  if (advanced && defender.activePokemon) {
    // Notify that substitute entered
    this._publisher.pokemonEntered(...);
  }

  // Check if player is eliminated
  if (!defender.hasAliveRemaining()) {
    lobby.finish(attacker.id);
    await this._lobbies.save(lobby);
    await this._battles.finish(battle.id, attacker.id);
    this._publisher.battleEnd(...);
    return;
  }
}

// Continue battle - switch turns
lobby.switchTurn();
```

## Team Selection

### Team Size

**Rule:** Each player receives exactly 3 Pokemon.

### Team Randomization

**Rule:** Team assignment is random every time using Fisher-Yates shuffle variant.

**Implementation:**
```typescript
// src/application/use-cases/AssignPokemonTeam.ts
private pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    const [item] = copy.splice(idx, 1);
    if (item) out.push(item);
  }
  return out;
}
```

### No Overlap Between Players

**Rule:** A Pokemon assigned to one player cannot be assigned to the opponent.

**Implementation:**
```typescript
// Get opponent's Pokemon IDs
const opponent = lobby.opponentOf(playerId);
const takenIds = new Set<number>((opponent?.team ?? []).map((p) => p.id));

// Filter out taken Pokemon
const available = all.filter((p) => !takenIds.has(p.id));
```

## Lobby State Machine

### States

| State | Description |
|-------|-------------|
| `waiting` | Lobby exists but not full (0-2 players), or waiting for ready |
| `ready` | Both players have confirmed teams and are ready |
| `battling` | Battle in progress |
| `finished` | Battle concluded, winner declared |

### State Transitions

```
waiting ──(2 players join)─────> waiting
        ──(assign_pokemon)────> waiting
        ──(both ready)────────> ready ──> battling
battling ──(all Pokemon defeated)──> finished
finished ──(reset_lobby)──────> waiting
```

### Battle Start Condition

**Rule:** Battle starts automatically when both players are ready.

**Implementation:**
```typescript
// src/domain/entities/Lobby.ts
startBattleIfReady(): boolean {
  if (this._players.length !== 2) return false;
  if (!this._players.every((p) => p.ready)) return false;

  this._status = LobbyStatus.Battling;
  // Determine first turn by Speed
  ...
  return true;
}
```

## Concurrency Control

### Atomic Attack Processing

**Rule:** Only one attack can be processed at a time per lobby. Attacks are serialized using a Mutex.

**Why:** Without serialization, two simultaneous attacks could read the same HP value before either writes, corrupting the state.

**Implementation:**
```typescript
// src/application/use-cases/ProcessAttack.ts
export class ProcessAttack {
  private readonly mutexes = new Map<string, Mutex>();

  private getMutex(lobbyId: string): Mutex {
    if (!this.mutexes.has(lobbyId)) {
      this.mutexes.set(lobbyId, new Mutex());
    }
    return this.mutexes.get(lobbyId)!;
  }

  async execute(playerId: string, lobbyId: string): Promise<void> {
    const mutex = this.getMutex(lobbyId);
    await mutex.runExclusive(async () => {
      // All attack processing here
    });
  }
}
```

### Mutex Cleanup

**Rule:** Mutexes are cleaned up when a lobby is reset to prevent memory leaks.

**Implementation:**
```typescript
// src/application/use-cases/ResetLobby.ts
async execute(lobbyId: string): Promise<void> {
  await this._battles.delete(lobbyId);
  await this._lobbies.delete(lobbyId);

  // Clean up in-memory mutexes
  this._assignTeam.cleanup(lobbyId);
  this._processAttack.cleanup(lobbyId);

  const fresh = await this._lobbies.create(lobbyId);
  this._publisher.lobbyStatus(fresh.toSnapshot(), lobbyId);
}
```

## Persistence Rules

### What Gets Persisted

All game state is persisted to MongoDB for recovery after server restart:

- Lobby state (status, players, teams, HP, turn)
- Battle history (all turn records)
- Player status (ready, socketId for reconnection)

### Persistence Points

| Action | What is saved |
|--------|-------------|
| JoinLobby | Lobby with new player |
| AssignPokemonTeam | Lobby with updated team |
| MarkReady | Lobby with player ready flag |
| ProcessAttack | Lobby (HP, turn) + Battle (turn record) |
| ResetLobby | Fresh empty lobby |

### Turn Counter Persistence

**Rule:** Turn counter survives server restarts by loading from persisted Battle.turns.length.

**Implementation:**
```typescript
// Load battle to get current turn count
const battle = await this._battles.findActiveByLobby(lobby.id);

// Initialize counter from persisted state (only if not already set)
this.initializeTurnCounter(lobbyId, battle.turns.length);
```

## Real-time Events

### Event Emission Points

| Event | Emitted when |
|-------|-------------|
| `lobby_status` | Any lobby state change |
| `battle_start` | Both players ready, battle begins |
| `turn_result` | After each attack is processed |
| `pokemon_defeated` | When a Pokemon HP reaches 0 |
| `pokemon_entered` | When a substitute Pokemon enters battle |
| `battle_end` | When a player wins |

### Event Payload Structure

```typescript
// lobby_status - full state sync
{ lobby: LobbySnapshot }

// battle_start - battle begins
{ lobby: LobbySnapshot }

// turn_result - attack completed
{ lobby: LobbySnapshot, turn: TurnRecord }

// pokemon_defeated - Pokemon fainted
{ lobby: LobbySnapshot, playerId: string, pokemonId: number }

// pokemon_entered - substitute enters
{ lobby: LobbySnapshot, playerId: string, pokemonId: number }

// battle_end - game over
{ lobby: LobbySnapshot, winnerPlayerId: string }
```

## Error Handling

### Error Types

| Error | Code | When |
|-------|------|------|
| `DomainError` | `DOMAIN_ERROR` | Generic business rule violation |
| `NotFoundError` | `NOT_FOUND` | Entity not found in database |
| `InvalidOperationError` | `INVALID_OPERATION` | Invalid state transition |
| Validation errors | `INVALID_TEAM`, `TEAM_INCOMPLETE` | Domain validation |

### Error-to-Client Mapping

```typescript
// src/infrastructure/http/error-handler.ts
registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(400).send({ code: error.code, message: error.message });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ code: error.code, message: error.message });
    }
    // Generic error -> 500
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Internal error' });
  });
}
```

## Input Validation

### Socket Events

| Event | Validation |
|-------|-----------|
| `join_lobby` | nickname: string, 1-20 chars |
| `assign_pokemon` | No payload (state from socket identity) |
| `ready` | No payload |
| `attack` | No payload |
| `reset_lobby` | No payload |

### REST API

| Endpoint | Validation |
|----------|-----------|
| `GET /list/:id` | id must be positive integer, returns 404 if not found |
| `GET /list` | No params |

### Environment Variables (Zod)

| Variable | Validation |
|----------|-----------|
| PORT | positive integer, default 8080 |
| HOST | string, default 0.0.0.0 |
| MONGO_URI | string, no default |
| POKEMON_API_BASE_URL | valid URL, required |
| CORS_ORIGIN | non-empty string, required (no default) |
| LOG_LEVEL | enum: fatal, error, warn, info, debug, trace, default info |

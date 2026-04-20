# Testing

## Overview

The project uses **Vitest** as the testing framework. Tests are located alongside the source files they test, using the `*.test.ts` naming convention.

## Running Tests

```bash
# Run tests once
pnpm test:run

# Run tests in watch mode (re-runs on file changes)
pnpm test

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

```
src/
├── domain/
│   └── entities/
│       ├── Battle.test.ts       # calculateDamage tests
│       ├── Pokemon.test.ts       # receiveDamage tests
│       ├── Player.test.ts       # markReady, advanceToNextAlive tests
│       └── Lobby.test.ts         # startBattleIfReady, switchTurn tests
│
└── application/
    └── use-cases/
        ├── AssignPokemonTeam.test.ts  # Team assignment tests
        └── ProcessAttack.test.ts       # Attack processing tests
```

## Test Categories

### Domain Logic Tests (P0)

These tests validate the core business rules with no external dependencies.

**Battle.calculateDamage**
- Damage equals attack minus defense when attack > defense
- Damage is always at least 1 (minimum damage rule)

**Pokemon.receiveDamage**
- HP decreases correctly after damage
- HP never goes below 0
- Pokemon is marked defeated when HP reaches 0
- Already defeated Pokemon cannot receive more damage

**Lobby.startBattleIfReady**
- Battle does not start without 2 players
- Battle does not start without all players ready
- First turn belongs to player with highest Speed
- When Speed is equal, first player in array goes first

**Lobby.switchTurn**
- Turn alternates correctly between players

**Player.advanceToNextAlive**
- Returns false when no alive Pokemon in team
- Returns true and advances activeIndex when backup Pokemon available
- Correctly skips defeated Pokemon

### Use Case Tests (P1)

These tests validate business flows using mocked dependencies.

**AssignPokemonTeam**
- Throws error when lobby not found
- Throws error when player not found
- Throws error when not enough Pokemon available
- Assigns exactly 3 Pokemon randomly
- Excludes opponent's Pokemon from selection
- Persists lobby after assignment
- Emits lobbyStatus after assignment

**ProcessAttack**
- Throws error when lobby not found
- Throws error when battle not active
- Throws error when not player's turn
- Applies correct damage calculation
- Switches turn after attack
- Emits turnResult after attack
- Emits pokemonDefeated and pokemonEntered when Pokemon defeated with backup
- Emits battleEnd when last Pokemon defeated

## Mock Strategy

Mocks are used to isolate use cases from external dependencies:

```typescript
// Example mock setup
const mockCatalog = {
  list: vi.fn(),
  getManyDetails: vi.fn(),
};
const mockLobbies = {
  findById: vi.fn(),
  save: vi.fn(),
};
const mockPublisher = {
  lobbyStatus: vi.fn(),
};
```

Each test resets mocks with `beforeEach` to ensure test isolation.

## Coverage Goals

| Category | Current Coverage |
|----------|-----------------|
| Domain entities | High |
| Application use cases | Medium |
| Infrastructure | Not tested (integration tests needed) |

## Adding New Tests

1. Create a `*.test.ts` file alongside the source file
2. Import the module with `.js` extension (ESM)
3. Use `describe` to group related tests
4. Use `it` or `test` for individual test cases
5. Use `expect` for assertions
6. Reset mocks in `beforeEach`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateDamage } from './Battle.js';

describe('calculateDamage', () => {
  it('returns attack minus defense when positive', () => {
    expect(calculateDamage(84, 78)).toBe(6);
  });

  it('returns 1 when attack equals defense', () => {
    expect(calculateDamage(50, 50)).toBe(1);
  });
});
```

## CI Integration

Tests run automatically on every push and pull request via GitHub Actions. See `.github/workflows/ci.yml` for the test job configuration.

The test job runs in parallel with lint and typecheck jobs. All three must pass before the build job starts.

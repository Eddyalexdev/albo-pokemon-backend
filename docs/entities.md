# Domain Entities

## Entity Relationships

```
+-------------------------------------------------------------+
|                          Lobby                               |
|                    (Aggregate Root)                          |
|                                                             |
|  - id: string                                               |
|  - status: LobbyStatus                                      |
|  - currentTurnPlayerId: string | null                       |
|  - winnerPlayerId: string | null                            |
|  - players: Player[]  (0-2 players)                        |
|                                                             |
|  Methods:                                                    |
|  - addPlayer(player: Player)                                |
|  - removePlayerBySocket(socketId: string)                  |
|  - findPlayerById(playerId: string): Player | undefined    |
|  - opponentOf(playerId: string): Player | undefined        |
|  - startBattleIfReady(): boolean                             |
|  - switchTurn()                                             |
|  - finish(winnerPlayerId: string)                            |
|  - markPlayerReady(playerId: string)                         |
|  - toSnapshot(): LobbySnapshot                               |
+-------------------------------------------------------------+
                |
                | contains 0-2
                v
+-------------------------------------------------------------+
|                         Player                               |
|                                                             |
|  - id: string                                               |
|  - socketId: string                                         |
|  - nickname: string                                         |
|  - team: Pokemon[]  (exactly 3)                            |
|  - activeIndex: number  (0, 1, or 2)                       |
|  - ready: boolean                                           |
|                                                             |
|  Derived:                                                    |
|  - activePokemon: Pokemon | null                            |
|  - hasAliveRemaining(): boolean                             |
|                                                             |
|  Methods:                                                    |
|  - assignTeam(team: Pokemon[])                              |
|  - markReady()                                              |
|  - advanceToNextAlive(): boolean                            |
|  - updateSocketId(socketId: string)                         |
|  - toSnapshot(): PlayerSnapshot                              |
+-------------------------------------------------------------+
                |
                | contains 3
                v
+-------------------------------------------------------------+
|                        Pokemon                              |
|                                                             |
|  - id: number                                               |
|  - name: string                                             |
|  - type: string[]                                            |
|  - maxHp: number                                            |
|  - attack: number                                           |
|  - defense: number                                          |
|  - speed: number                                            |
|  - sprite: string                                           |
|                                                             |
|  State (mutable):                                           |
|  - currentHp: number                                        |
|  - defeated: boolean                                         |
|                                                             |
|  Methods:                                                    |
|  - receiveDamage(damage: number)                           |
|  - toSnapshot(): PokemonSnapshot                             |
+-------------------------------------------------------------+
```

## LobbyStatus Enum

```
+-------------------+
|    LobbyStatus    |
+-------------------+
| waiting           |  <- 2 players joined, waiting for ready
| ready            |  <- both players ready, battle about to start
| battling         |  <- battle in progress
| finished         |  <- battle ended, winner declared
+-------------------+
```

## State Transitions

```
                    JoinLobby
                  +------------+
                  |            |
                  v            |
              +--------+       |
              |(new)   |       |
              +---+----+       |
                  |            |
         +--------+--------+   |
         |                 |   |
    JoinLobby        JoinLobby
    (reconnect)       (new)    |
         |                 |   |
         v                 v   v
    +---------+    +----------------+
    | waiting |<---| waiting        |
    |(1 player)|   | (2 players)   |
    +---------+    +-------+--------+
                              |
                         MarkReady
                         (both)
                              |
                              v
                        +----------+
                        | battling|
                        +----+-----+
                             |
                  +----------+----------+
                  |                     |
           battle_end              battle_end
                  |                     |
                  v                     v
            +-----------+       +-----------+
            | finished  |       | finished  |
            +-----------+       +-----------+
```

## Battle Entity

```
+-------------------------------------------------------------+
|                        Battle                                |
|                                                             |
|  - id: string                                               |
|  - lobbyId: string                                          |
|  - turns: TurnRecord[]                                      |
|  - winnerPlayerId: string | null                            |
|  - startedAt: string                                        |
|  - endedAt: string | null                                   |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
|                      TurnRecord                              |
|                                                             |
|  - turnNumber: number                                       |
|  - attackerPlayerId: string                                |
|  - defenderPlayerId: string                                 |
|  - attackerPokemonId: number                                |
|  - defenderPokemonId: number                                |
|  - damage: number                                           |
|  - defenderHpAfter: number                                  |
|  - defenderDefeated: boolean                                 |
|  - timestamp: string                                        |
+-------------------------------------------------------------+
```

## Persistence Models (MongoDB)

### Lobby Document
```json
{
  "_id": "lobby-uuid",
  "status": "battling",
  "players": [
    {
      "id": "player-uuid",
      "socketId": "socket-abc",
      "nickname": "Ash",
      "team": [
        {
          "id": 6,
          "name": "Charizard",
          "type": ["Fire", "Flying"],
          "hp": 78,
          "maxHp": 78,
          "attack": 84,
          "defense": 78,
          "speed": 100,
          "sprite": "https://...",
          "defeated": false
        }
      ],
      "activeIndex": 0,
      "ready": true
    }
  ],
  "currentTurnPlayerId": "player-uuid",
  "winnerPlayerId": null,
  "createdAt": "2024-...",
  "updatedAt": "2024-..."
}
```

### Battle Document
```json
{
  "_id": "battle-uuid",
  "lobbyId": "lobby-uuid",
  "turns": [
    {
      "turnNumber": 1,
      "attackerPlayerId": "ash-uuid",
      "defenderPlayerId": "misty-uuid",
      "attackerPokemonId": 6,
      "defenderPokemonId": 9,
      "damage": 4,
      "defenderHpAfter": 61,
      "defenderDefeated": false,
      "timestamp": "2024-..."
    }
  ],
  "startedAt": "2024-...",
  "endedAt": null,
  "winnerPlayerId": null
}
```

## Snapshot Pattern

All entities implement `toSnapshot()` and `fromSnapshot()` for serialization:

```typescript
// Entity -> Plain object (for persistence/transmission)
toSnapshot(): EntitySnapshot

// Plain object -> Entity instance (for reconstruction)
fromSnapshot(snapshot: EntitySnapshot): Entity
```

This decouples the entity from how it is stored or transmitted.

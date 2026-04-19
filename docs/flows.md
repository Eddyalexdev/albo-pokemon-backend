# Game Flows

## Complete Game Flow

```
CLIENT                                                          SERVER
  |                                                               |
  |---------------- join_lobby { nickname: "Ash" } -------------->|
  |                                                               |
  |                              [Find or create lobby]            |
  |                              [Create Player entity]          |
  |                              [Persist to MongoDB]             |
  |                                                               |
  |<------------- lobby_status { lobby, playerId, lobbyId } ------|
  |<-------------------- { ok: true } ---------------------------|
  |                                                               |
  |--- assign_pokemon --->|                                      |
  |                      [Mutex: acquire lock]                   |
  |                      [Get catalog from external API]         |
  |                      [Pick 3 random, no overlap with opp]  |
  |                      [Save team to player]                   |
  |                      [Mutex: release lock]                   |
  |<--- { ok: true } ---|                                       |
  |<-- lobby_status ---|  (updated with team)                   |
  |                                                               |
  |                    << PLAYER 2 JOINS >>                       |
  |                                                               |
  |--- assign_pokemon --->|                                      |
  |                      [Mutex: acquire lock]                   |
  |                      [Opponent has 3 already - exclude those]|
  |                      [Pick 3 random from remaining]         |
  |                      [Save team to player]                   |
  |<--- { ok: true } ---|                                       |
  |<-- lobby_status ---|                                        |
  |                                                               |
  |--- ready ----------->|                                      |
  |                      [Mark player as ready]                  |
  |                      [Check: both ready?]                    |
  |                      [If yes: startBattleIfReady()]           |
  |                      [Determine first turn by Speed]          |
  |                      [Create Battle in MongoDB]               |
  |<-- { ok: true } ---|                                        |
  |<-- battle_start ---|  (battle begins)                       |
  |<-- lobby_status ---|  (with currentTurnPlayerId)            |
  |                                                               |
  |--- ready ----------->|  (Player 2 also ready)               |
  |<-- { ok: true } ---|                                       |
  |<-- battle_start ---|                                       |
  |<-- lobby_status ---|                                        |
  |                                                               |
  |==============================================================|
  |===================== BATTLE BEGINS ===========================|
  |==============================================================|
  |                                                               |
  |--- attack ------------>|                                    |
  |                      [Mutex: acquire lock]                   |
  |                      [Validate: is it this player's turn?]  |
  |                      [Validate: battle is active?]           |
  |                      [Load Battle from MongoDB]               |
  |                      [Calculate damage: max(1, atk - def)]  |
  |                      [Apply damage to defender Pokemon]       |
  |                      [Append TurnRecord to Battle]           |
  |                      [Pokemon defeated?]                     |
  |                        -> yes: advance to next alive          |
  |                        -> no alive: finish battle             |
  |                        -> alive: switch turn                 |
  |                      [Persist lobby + battle]                 |
  |                      [Emit events to all in lobby room]      |
  |                      [Mutex: release lock]                   |
  |<-- turn_result ------|  (damage, HP remaining)              |
  |<-- lobby_status ------|  (updated state, turn switched)       |
  |                                                               |
  |                    ... alternating attacks ...                |
  |                                                               |
  |<-- pokemon_defeated -|  (when a Pokemon reaches 0 HP)        |
  |<-- pokemon_entered --|  (when next Pokemon auto-swaps in)    |
  |<-- battle_end -------|  (when winner is determined)          |
  |                                                               |
  |--- reset_lobby ----->|  (start new game)                    |
  |                      [Delete Battle from MongoDB]             |
  |                      [Delete Lobby from MongoDB]              |
  |                      [Cleanup mutexes]                        |
  |                      [Create fresh Lobby]                     |
  |<-- lobby_status ------|  (empty lobby, ready for players)    |
```

## Socket.IO Event Flow

### Client to Server Events

| Event | Payload | Handler | Description |
|-------|---------|---------|-------------|
| `join_lobby` | `{ nickname: string }` | `JoinLobby` | Enter lobby with trainer name |
| `assign_pokemon` | `{}` | `AssignPokemonTeam` | Request random team |
| `ready` | `{}` | `MarkReady` | Confirm team and readiness |
| `attack` | `{}` | `ProcessAttack` | Execute attack on opponent |
| `reset_lobby` | `{}` | `ResetLobby` | Clear lobby and start over |

### Server to Client Events

| Event | Payload | Trigger | Description |
|-------|---------|---------|-------------|
| `lobby_status` | `{ lobby: LobbySnapshot }` | Any state change | Full lobby sync |
| `battle_start` | `{ lobby: LobbySnapshot }` | Both players ready | Battle begins |
| `turn_result` | `{ lobby, turn }` | After attack processed | Damage applied |
| `pokemon_defeated` | `{ lobby, playerId, pokemonId }` | Defender HP reaches 0 | Pokemon fainted |
| `pokemon_entered` | `{ lobby, playerId, pokemonId }` | Next Pokemon auto-swaps | Substitute enters |
| `battle_end` | `{ lobby, winnerPlayerId }` | Winner declared | Game over |
| `error_event` | `{ code, message }` | Any server error | Error notification |

## Lobby Lifecycle

```
                         join_lobby
                       +----------->+
                       |            |
                       |  +------+  |
                       |  |(new)|  |
                       |  +--+---+  |
                       |     |     |
                       +-----+-----+
                             |
                    +--------+--------+
                    |                     |
               join_lobby          join_lobby
               (reconnect)         (1st player)
                    |                     |
                    v                     v
             +------------+      +----------------+
             |  waiting   |      |    waiting     |
             |(1 player)  |      |  (2 players)   |
             +------------+      +-------+--------+
                                         |
                                    assign_pokemon (x2)
                                         |
                                         v
                                  +------------+
                                  |  waiting   |
                                  |(both have   |
                                  |  teams)    |
                                  +-----+------+
                                        |
                                   ready (x2)
                                        |
                                        v
                                  +-----------+
                                  | battling  |
                                  +-----+-----+
                                        |
                         +--------------+---------------+
                         |                              |
                   battle_end                    battle_end
                         |                              |
                         v                              v
                   +-----------+                +-----------+
                   | finished  |                | finished  |
                   |(winner: A)|                |(winner: B)|
                   +-----------+                +-----------+
                         |                              |
                    reset_lobby                    reset_lobby
                         |                              |
                         +---------------+--------------+
                                         |
                                         v
                                  +------------+
                                  |  waiting   |
                                  | (2 players)|
                                  +-----+------+
                                        |
                                   (loop)
```

## Attack Turn Processing (Detailed)

```
Client sends "attack"
        |
        v
+---------------------+
| Acquire Mutex       |  <- Ensures no concurrent attacks
+---------------------+
        |
        v
+---------------------+
| Load Lobby from DB  |  <- Get current state
+---------------------+
        |
        v
+---------------------+
| Validate Turn       |  <- Is it this player's turn?
| Validate Status     |  <- Is battle active?
+---------------------+
        |
        v
+---------------------+
| Load Battle from DB |  <- Get turn history
+---------------------+
        |
        v
+---------------------+
| Get active Pokemon  |  <- Attacker and defender
+---------------------+
        |
        v
+---------------------+
| Calculate Damage    |  <- damage = max(1, atk - def)
+---------------------+
        |
        v
+---------------------+
| Apply Damage         |  <- defender.hp -= damage
| Check Defeated      |  <- if hp <= 0, mark defeated
+---------------------+
        |
        v
+---------------------+
| Persist Turn        |  <- Append TurnRecord to Battle
+---------------------+
        |
        v
        |<---- if defender defeated ---->|
        |                                |
        v                                v
+---------------------+    +---------------------+
| Has Alive Pokemon?  |    | No Pokemon Left    |
+---------------------+    +---------------------+
        |                                |
        | yes                            | yes
        v                                v
+---------------------+    +---------------------+
| Advance to Next     |    | Declare Winner     |
| Emit pokemon_entered |    | Emit battle_end    |
+---------------------+    +---------------------+
        |                                |
        v                                v
+---------------------+    +---------------------+
| Switch Turn         |    | Persist Winner      |
| Persist Lobby       |    | to Battle + Lobby   |
+---------------------+    +---------------------+
        |
        v
+---------------------+
| Emit turn_result    |
| Emit lobby_status   |
+---------------------+
        |
        v
+---------------------+
| Release Mutex       |
+---------------------+
```

## Team Assignment Flow

```
assign_pokemon event received
        |
        v
+---------------------+
| Acquire Mutex       |  <- Serialize team assignment
+---------------------+
        |
        v
+---------------------+
| Load Lobby from DB  |
+---------------------+
        |
        v
+---------------------+
| Get Opponent Team   |  <- Find opponent's Pokemon IDs
| Build Exclusion Set |
+---------------------+
        |
        v
+---------------------+
| Fetch Full Catalog  |  <- GET from external API
| Filter Available    |  <- Exclude opponent's Pokemon
+---------------------+
        |
        v
+---------------------+
| Validate Count      |  <- Need at least 3 available
+---------------------+
        |
        v
+---------------------+
| Pick 3 Random       |  <- Fisher-Yates shuffle
+---------------------+
        |
        v
+---------------------+
| Fetch Details       |  <- GET /list/:id for each
| Create Pokemon objs |
+---------------------+
        |
        v
+---------------------+
| Assign to Player    |  <- player.assignTeam(team)
| Set activeIndex = 0 |
+---------------------+
        |
        v
+---------------------+
| Persist Lobby       |
+---------------------+
        |
        v
+---------------------+
| Emit lobby_status   |  <- Clients see updated team
+---------------------+
        |
        v
+---------------------+
| Release Mutex       |
+---------------------+
```

## Reconnection Flow

```
Player disconnects (socket.io disconnect)
        |
        v
+---------------------+
| Remove socketId     |  <- socketInfoMap.delete(socketId)
| from entry          |
+---------------------+

Player reconnects with new socket
        |
        v
+---------------------+
| Send join_lobby     |
| Same nickname       |
+---------------------+
        |
        v
+---------------------+
| Find Lobby          |
| Find Player by nick|  <- Player exists with old socketId
+---------------------+
        |
        v
+---------------------+
| Update socketId     |  <- player.updateSocketId(newSocketId)
| Mark reconnected=true|
+---------------------+
        |
        v
+---------------------+
| Remove stale entry   |  <- removeStaleSocketEntry(playerId)
| from socketInfoMap  |     (old socket entry invalidated)
+---------------------+
        |
        v
+---------------------+
| Add new entry       |  <- socketInfoMap.set(newSocketId, ...)
+---------------------+
        |
        v
+---------------------+
| Emit lobby_status   |
+---------------------+
```

## REST API Flow

```
GET /list
        |
        v
+---------------------+
| GetCatalog.execute()|
+---------------------+
        |
        v
+---------------------+
| catalog.list()     |  <- Uses cached list or fetches
| Returns CatalogListItem[]|
+---------------------+

GET /list/:id
        |
        v
+---------------------+
| Validate id         |  <- Must be positive integer
+---------------------+
        |
        v
+---------------------+
| catalog.getDetail()|
| Returns PokemonSnapshot|
+---------------------+
        |
        v
+---------------------+
| Not found?          |  <- Return 404
+---------------------+

GET /health
        |
        v
+---------------------+
| Returns { status:   |
| "ok" } immediately  |
+---------------------+
```

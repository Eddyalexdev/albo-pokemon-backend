import { LobbyRepository } from '../../domain/repositories/LobbyRepository.js';
import { BattleRepository } from '../../domain/repositories/BattleRepository.js';
import { calculateDamage, TurnRecord } from '../../domain/entities/Battle.js';
import { LobbyStatus } from '../../domain/value-objects/LobbyStatus.js';
import { DomainError, InvalidOperationError, NotFoundError } from '../../domain/errors/DomainError.js';
import { BattleEventPublisher } from '../ports/BattleEventPublisher.js';
import { Mutex } from '../../shared/Mutex.js';

/**
 * ProcessAttack — Use Case
 * Processes a single attack atomically.
 *
 * Concurrency model: a process-wide Mutex serializes all attack processing.
 * Since the spec requires a single lobby, this guarantees atomic turn handling
 * without race conditions.
 *
 * Flow:
 *  1. Acquire lock
 *  2. Reload lobby + validate turn ownership
 *  3. Apply damage, swap defeated Pokemon, detect winner
 *  4. Persist + emit events
 *  5. Release lock
 */
export class ProcessAttack {
  private readonly mutex = new Mutex();
  private turnCounter = 0;

  constructor(
    private readonly _lobbies: LobbyRepository,
    private readonly _battles: BattleRepository,
    private readonly _publisher: BattleEventPublisher,
  ) {}

  async execute(playerId: string): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const lobby = await this._lobbies.findOrCreateSingleton();

      if (lobby.status !== LobbyStatus.Battling) {
        throw new InvalidOperationError('Battle is not active');
      }
      if (lobby.currentTurnPlayerId !== playerId) {
        throw new InvalidOperationError('Not your turn');
      }

      const attacker = lobby.findPlayerById(playerId);
      const defender = lobby.opponentOf(playerId);
      if (!attacker || !defender) throw new NotFoundError('Players not available');

      const attackerMon = attacker.activePokemon;
      const defenderMon = defender.activePokemon;
      if (!attackerMon || !defenderMon) {
        throw new DomainError('Active Pokemon missing');
      }

      const damage = calculateDamage(attackerMon.attack, defenderMon.defense);
      defenderMon.receiveDamage(damage);

      const battle = await this._battles.findActiveByLobby(lobby.id);
      if (!battle) throw new NotFoundError('Active battle not found');

      const turn: TurnRecord = {
        turnNumber: ++this.turnCounter,
        attackerPlayerId: attacker.id,
        defenderPlayerId: defender.id,
        attackerPokemonId: attackerMon.id,
        defenderPokemonId: defenderMon.id,
        damage,
        defenderHpAfter: defenderMon.currentHp,
        defenderDefeated: defenderMon.defeated,
        timestamp: new Date().toISOString(),
      };
      await this._battles.appendTurn(battle.id, turn);

      this._publisher.turnResult(lobby.toSnapshot(), turn);

      if (defenderMon.defeated) {
        this._publisher.pokemonDefeated(lobby.toSnapshot(), defender.id, defenderMon.id);

        const advanced = defender.advanceToNextAlive();
        if (advanced && defender.activePokemon) {
          this._publisher.pokemonEntered(
            lobby.toSnapshot(),
            defender.id,
            defender.activePokemon.id,
          );
        }

        if (!defender.hasAliveRemaining()) {
          lobby.finish(attacker.id);
          await this._lobbies.save(lobby);
          await this._battles.finish(battle.id, attacker.id);
          this._publisher.battleEnd(lobby.toSnapshot(), attacker.id);
          return;
        }
      }

      lobby.switchTurn();
      await this._lobbies.save(lobby);
      this._publisher.lobbyStatus(lobby.toSnapshot());
    });
  }
}
/**
 * Pokemon — Entity
 * Pure domain model. No framework imports.
 * Identity is stable (id is assigned by external catalog).
 */
export interface PokemonSnapshot {
  id: number;
  name: string;
  type: string[];
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string;
  defeated: boolean;
}

export class Pokemon {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly type: string[],
    public readonly maxHp: number,
    public readonly attack: number,
    public readonly defense: number,
    public readonly speed: number,
    public readonly sprite: string,
    private _currentHp: number = maxHp,
    private _defeated: boolean = false,
  ) {}

  get currentHp(): number {
    return this._currentHp;
  }

  get defeated(): boolean {
    return this._defeated;
  }

  /**
   * HP must never go below 0.
   * When HP reaches 0 the Pokemon is marked defeated.
   */
  receiveDamage(damage: number): void {
    if (this._defeated) return;
    const next = this._currentHp - damage;
    this._currentHp = next < 0 ? 0 : next;
    if (this._currentHp === 0) this._defeated = true;
  }

  toSnapshot(): PokemonSnapshot {
    return {
      id: this.id,
      name: this.name,
      type: [...this.type],
      hp: this._currentHp,
      maxHp: this.maxHp,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      sprite: this.sprite,
      defeated: this._defeated,
    };
  }

  static fromSnapshot(s: PokemonSnapshot): Pokemon {
    return new Pokemon(
      s.id,
      s.name,
      s.type,
      s.maxHp,
      s.attack,
      s.defense,
      s.speed,
      s.sprite,
      s.hp,
      s.defeated,
    );
  }
}

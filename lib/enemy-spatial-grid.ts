type SpatialEnemy = { dead: boolean; root: { position: { x: number; z: number } } };
const SIDE = 32;
const CELL_SIZE = 2;
const OFFSET = SIDE / 2;
const EMPTY: readonly never[] = [];
const ascending = (a: number, b: number) => a - b;

/** Reusable broad phase for the arena's 0.85m separation and 1.7m charge push. */
export class EnemySpatialGrid<E extends SpatialEnemy> {
  private readonly heads = new Int32Array(SIDE * SIDE).fill(-1);
  private activeCount = 0;
  private minRow = SIDE;
  private maxRow = -1;
  private minColumn = SIDE;
  private maxColumn = -1;
  private next = new Int32Array(0);
  private previous = new Int32Array(0);
  private cells = new Int32Array(0);
  private indices = new WeakMap<E, number>();
  private enemies: readonly E[] = EMPTY;
  private readonly candidates: number[] = [];
  private readonly allIndices: number[] = [];

  private coordinate(value: number) {
    // The arena is bounded at +/-30.2m. Out-of-arena positions conservatively share edge cells.
    return Math.max(0, Math.min(SIDE - 1, Math.floor(value / CELL_SIZE) + OFFSET));
  }

  private cell(enemy: E) {
    const { x, z } = enemy.root.position;
    return this.coordinate(z) * SIDE + this.coordinate(x);
  }

  rebuild(enemies: readonly E[]) {
    this.enemies = enemies;
    this.heads.fill(-1);
    this.activeCount = 0;
    this.minRow = this.minColumn = SIDE;
    this.maxRow = this.maxColumn = -1;
    this.allIndices.length = enemies.length;
    if (this.cells.length < enemies.length) {
      const capacity = Math.max(64, this.cells.length * 2, enemies.length);
      this.next = new Int32Array(capacity);
      this.previous = new Int32Array(capacity);
      this.cells = new Int32Array(capacity);
    }
    for (let index = 0; index < enemies.length; index++) {
      const enemy = enemies[index];
      this.allIndices[index] = index;
      this.indices.set(enemy, index);
      this.cells[index] = -1;
      if (!enemy.dead) this.insert(index, this.cell(enemy));
    }
  }

  private insert(index: number, cell: number) {
    const head = this.heads[cell];
    this.cells[index] = cell;
    this.previous[index] = -1;
    this.next[index] = head;
    if (head !== -1) this.previous[head] = index;
    this.heads[cell] = index;
    this.activeCount++;
    const row = Math.floor(cell / SIDE), column = cell % SIDE;
    // Bounds may expand during sequential movement; rebuild tightens them next frame.
    this.minRow = Math.min(this.minRow, row);
    this.maxRow = Math.max(this.maxRow, row);
    this.minColumn = Math.min(this.minColumn, column);
    this.maxColumn = Math.max(this.maxColumn, column);
  }

  private detach(index: number) {
    const cell = this.cells[index];
    if (cell === -1) return;
    const previous = this.previous[index], next = this.next[index];
    if (previous === -1) this.heads[cell] = next;
    else this.next[previous] = next;
    if (next !== -1) this.previous[next] = previous;
    this.cells[index] = -1;
    this.activeCount--;
  }

  update(enemy: E) {
    const index = this.indices.get(enemy);
    if (index === undefined || this.enemies[index] !== enemy) return;
    if (enemy.dead) { this.detach(index); return; }
    const cell = this.cell(enemy);
    if (this.cells[index] === cell) return;
    this.detach(index);
    this.insert(index, cell);
  }

  remove(enemy: E) {
    const index = this.indices.get(enemy);
    if (index !== undefined && this.enemies[index] === enemy) this.detach(index);
    this.indices.delete(enemy);
  }

  /** The returned scratch array is valid until the next query; moving members does not change it. */
  query(x: number, z: number): readonly number[] {
    const cx = this.coordinate(x), cz = this.coordinate(z);
    const minRow = Math.max(0, cz - 1), maxRow = Math.min(SIDE - 1, cz + 1);
    const minColumn = Math.max(0, cx - 1), maxColumn = Math.min(SIDE - 1, cx + 1);
    // Dense crowds already need every comparison. Avoid collecting/sorting all members again.
    if (this.activeCount === this.enemies.length &&
      minRow <= this.minRow && maxRow >= this.maxRow &&
      minColumn <= this.minColumn && maxColumn >= this.maxColumn) return this.allIndices;
    let count = 0;
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        for (let index = this.heads[row * SIDE + column]; index !== -1; index = this.next[index]) {
          if (!this.enemies[index].dead) this.candidates[count++] = index;
        }
      }
    }
    this.candidates.length = count;
    // Keep floating-point accumulation and sequential pushes in the original enemy-array order.
    return this.candidates.sort(ascending);
  }

  get(index: number): E {
    return this.enemies[index];
  }

  clear() {
    this.heads.fill(-1);
    this.activeCount = 0;
    this.minRow = this.minColumn = SIDE;
    this.maxRow = this.maxColumn = -1;
    this.enemies = EMPTY;
    this.candidates.length = 0;
    this.allIndices.length = 0;
    this.indices = new WeakMap();
  }
}

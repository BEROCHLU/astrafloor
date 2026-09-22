const SIZE = 61;
const OFFSET = 30;
const DIRECTIONS = [1, 0, -1, 0, 0, 1, 0, -1] as const;

/** Shared distance field for ordinary enemies and Hans. Obstacles remain static between invalidations. */
export class NavigationGrid {
  private readonly blocked = new Uint8Array(SIZE * SIZE);
  private readonly queue = new Uint16Array(SIZE * SIZE);
  private blockedValid = false;
  private source = -1;
  readonly distances: Int16Array;

  constructor(distances: Int16Array) {
    this.distances = distances;
  }

  invalidate() {
    this.blockedValid = false;
    this.source = -1;
  }

  update(playerX: number, playerZ: number, isBlocked: (x: number, z: number) => boolean) {
    if (!this.blockedValid) {
      for (let z = 0; z < SIZE; z++)
        for (let x = 0; x < SIZE; x++)
          this.blocked[z * SIZE + x] = Number(isBlocked(x - OFFSET, z - OFFSET));
      this.blockedValid = true;
    }
    const px = Math.min(SIZE - 1, Math.max(0, Math.round(playerX) + OFFSET));
    const pz = Math.min(SIZE - 1, Math.max(0, Math.round(playerZ) + OFFSET));
    const start = pz * SIZE + px;
    if (start === this.source) return false;

    const nav = this.distances;
    nav.fill(-1);
    this.queue[0] = start;
    nav[start] = 0; // Preserve the original behavior even when the starting cell is blocked.
    let tail = 1;
    for (let head = 0; head < tail; head++) {
      const n = this.queue[head], x = n % SIZE, z = Math.floor(n / SIZE);
      for (let direction = 0; direction < DIRECTIONS.length; direction += 2) {
        const nx = x + DIRECTIONS[direction], nz = z + DIRECTIONS[direction + 1];
        if (nx < 0 || nx >= SIZE || nz < 0 || nz >= SIZE) continue;
        const next = nz * SIZE + nx;
        if (this.blocked[next] || nav[next] >= 0) continue;
        nav[next] = nav[n] + 1;
        this.queue[tail++] = next;
      }
    }
    this.source = start;
    return true;
  }
}

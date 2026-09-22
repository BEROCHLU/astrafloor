import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game } from '../lib/game.ts';
import { NavigationGrid } from '../lib/navigation.ts';

// The pre-cache breadth-first search is the oracle for the complete distance field.
function originalNavigation(game) {
  const nav = new Int16Array(61 * 61).fill(-1), blocked = new Uint8Array(61 * 61);
  for (let z = 0; z < 61; z++)
    for (let x = 0; x < 61; x++)
      if (game.blocked(x - 30, z - 30, 0.5)) blocked[z * 61 + x] = 1;
  const px = T.MathUtils.clamp(Math.round(game.camera.position.x) + 30, 0, 60);
  const pz = T.MathUtils.clamp(Math.round(game.camera.position.z) + 30, 0, 60);
  const queue = [pz * 61 + px];
  nav[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head], x = n % 61, z = Math.floor(n / 61);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, next = nz * 61 + nx;
      if (nx < 0 || nx > 60 || nz < 0 || nz > 60 || blocked[next] || nav[next] >= 0) continue;
      nav[next] = nav[n] + 1;
      queue.push(next);
    }
  }
  return nav;
}

const box = (x1, z1, x2, z2) => new T.Box3(new T.Vector3(x1, 0, z1), new T.Vector3(x2, 3, z2));
function fixture(obstacles = []) {
  return Object.assign(Object.create(Game.prototype), {
    camera: new T.PerspectiveCamera(), nav: new Int16Array(61 * 61), navTime: 0,
    obstacles, enemies: [], state: { mode: 'playing' },
  });
}

test('cached navigation matches the original field at edges, passages, and blocked starting cells', () => {
  const maps = [[], [box(-3, -12, 3, 12)], [box(-30, -0.1, 30, 0.1)],
    [box(-8, -8, -2, 8), box(2, -8, 8, 8), box(-8, 8, 8, 9)]];
  for (const obstacles of maps) {
    const game = fixture(obstacles);
    for (const [x, z] of [[0, 0], [0.49, -0.49], [0.5, -0.5], [-4, 7], [30, -30], [-32, 32]]) {
      game.camera.position.set(x, 1.7, z);
      game.updateNavigation();
      assert.deepEqual(game.nav, originalNavigation(game), `player ${x},${z}`);
    }
  }
});

test('same-cell updates skip exploration; moving cells reuses occupancy and working buffers', () => {
  const distances = new Int16Array(61 * 61), grid = new NavigationGrid(distances);
  let checks = 0;
  const blocked = (x, z) => { checks++; return x === 3 && z < 6; };
  assert.equal(grid.update(0, 0, blocked), true);
  assert.equal(checks, 61 * 61);
  const field = distances.slice(), queue = grid.queue, occupancy = grid.blocked;
  assert.equal(grid.update(0.49, 0.49, blocked), false);
  assert.deepEqual(distances, field);
  assert.equal(grid.update(0.5, 0.49, blocked), true);
  assert.notDeepEqual(distances, field);
  assert.equal(checks, 61 * 61, 'player movement does not re-check static obstacles');
  assert.equal(grid.queue, queue);
  assert.equal(grid.blocked, occupancy);
  assert.equal(grid.distances, distances);
});

test('invalidating obstacle changes rebuilds occupancy and paths even when the player stays in the same cell', () => {
  const game = fixture();
  game.updateNavigation();
  const originalBuffer = game.nav;
  game.navTime = 0.4;
  game.obstacles.push(box(-2, 2, 2, 6));
  game.invalidateNavigation();
  assert.equal(game.navTime, 0);
  game.updateNavigation();
  assert.equal(game.nav, originalBuffer);
  assert.deepEqual(game.nav, originalNavigation(game));
  assert.equal(game.nav[34 * 61 + 30], -1);
  game.obstacles[0].translate(new T.Vector3(10, 0, 0));
  game.invalidateNavigation();
  game.updateNavigation();
  assert.deepEqual(game.nav, originalNavigation(game));
  assert.equal(game.nav[34 * 61 + 30], 4);
});

test('enemy updates keep the existing refresh interval and pause behavior', () => {
  const game = fixture();
  let updates = 0;
  game.updateNavigation = function () { updates++; Game.prototype.updateNavigation.call(this); };
  game.updateEnemies(0.01);
  assert.equal(updates, 1);
  assert.equal(game.navTime, 0.55);
  game.camera.position.x = 4;
  game.updateEnemies(0.3);
  assert.equal(updates, 1);
  const remaining = game.navTime;
  game.state.mode = 'paused';
  game.updateEnemies(1);
  assert.equal(game.navTime, remaining);
  game.state.mode = 'playing';
  game.updateEnemies(0.3);
  assert.equal(updates, 2);
  assert.deepEqual(game.nav, originalNavigation(game));
});

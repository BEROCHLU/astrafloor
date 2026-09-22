import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EnemySpatialGrid } from '../lib/enemy-spatial-grid.ts';
import { Game, ENEMY_SPECS } from '../lib/game.ts';

const point = (x, z) => ({ dead: false, root: { position: { x, z } } });
const nearby = (enemies, x, z, radius) => enemies.flatMap((enemy, index) =>
  !enemy.dead && Math.hypot(enemy.root.position.x - x, enemy.root.position.z - z) < radius ? [index] : []);

test('nine-cell queries preserve full-scan neighbors and array order across cell and arena boundaries', () => {
  let seed = 123;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const enemies = Array.from({ length: 100 }, () => point(random() * 62 - 31, random() * 62 - 31));
  for (const x of [-35, -32, -30.2, -2.01, -2, -0.01, 0, 1.99, 2, 30.2, 32, 35])
    for (const z of [-2.01, -2, -0.01, 0, 1.99, 2]) enemies.push(point(x, z));
  enemies[4].dead = true;
  const grid = new EnemySpatialGrid();
  grid.rebuild(enemies);
  for (const enemy of enemies) {
    const { x, z } = enemy.root.position;
    const indices = grid.query(x, z);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
    assert.equal(new Set(indices).size, indices.length);
    for (const radius of [0.85, 1.7]) {
      const actual = indices.filter(index => Math.hypot(grid.get(index).root.position.x - x, grid.get(index).root.position.z - z) < radius);
      assert.deepEqual(actual, nearby(enemies, x, z, radius), `${x},${z} radius ${radius}`);
    }
  }
});

test('moves, deaths, compaction and spawning update membership without invalidating an in-progress query', () => {
  const enemies = [point(0, 0), point(0.2, 0.2), point(8, 0), point(0.4, 0.4)];
  const grid = new EnemySpatialGrid();
  grid.rebuild(enemies);
  const candidates = grid.query(0, 0);
  assert.deepEqual(candidates, [0, 1, 3]);
  const originalCandidates = [...candidates];
  enemies[1].root.position.x = 8.1;
  grid.update(enemies[1]);
  assert.deepEqual(candidates, originalCandidates, 'push updates must not alter the current candidate iteration');
  assert.deepEqual(grid.query(0, 0), [0, 3]);
  assert.deepEqual(grid.query(8, 0), [1, 2]);
  enemies[2].root.position.x = 0.3;
  grid.update(enemies[2]);
  assert.deepEqual(grid.query(0, 0), [0, 2, 3]);
  enemies[0].dead = true;
  grid.remove(enemies[0]);
  enemies[3].dead = true;
  grid.update(enemies[3]); // A membership update can also remove a newly dead enemy.
  assert.deepEqual(grid.query(0, 0), [2]);
  const survivors = enemies.filter(enemy => !enemy.dead);
  survivors.push(point(0.5, 0));
  grid.rebuild(survivors);
  grid.remove(enemies[0]); // A stale index must not remove the survivor that now has that index.
  assert.deepEqual(grid.query(0, 0), [1, 2]);
  grid.clear();
  assert.deepEqual(grid.query(0, 0), []);
  grid.rebuild([point(0, 0)]);
  assert.deepEqual(grid.query(0, 0), [0]);
});

test('sparse crowds reduce candidates while reusing grid buffers and query storage', () => {
  const enemies = Array.from({ length: 48 }, (_, i) => point((i % 8) * 3 - 12, Math.floor(i / 8) * 3 - 9));
  const grid = new EnemySpatialGrid();
  grid.rebuild(enemies);
  const buffers = [grid.heads, grid.next, grid.previous, grid.cells];
  const scratch = grid.query(0, 0);
  let comparisons = 0;
  for (let i = 0; i < enemies.length; i++) {
    const { x, z } = enemies[i].root.position;
    const candidates = grid.query(x, z);
    assert.equal(candidates, scratch);
    comparisons += candidates.filter(index => index !== i).length;
  }
  assert.ok(comparisons < enemies.length * (enemies.length - 1) / 4);
  grid.rebuild(enemies);
  [grid.heads, grid.next, grid.previous, grid.cells].forEach((buffer, i) => assert.equal(buffer, buffers[i]));
  const dense = Array.from({ length: 130 }, () => point(0, 0));
  grid.rebuild(dense);
  assert.equal(grid.query(0, 0).length, 130, 'capacity growth keeps every dense-crowd member');
  dense[60].dead = true;
  grid.remove(dense[60]);
  assert.deepEqual(grid.query(0, 0), nearby(dense, 0, 0, 1.7), 'dense queries exclude newly dead members');
});

// Full scan oracle: identical movement/attack code, but every query visits the original enemy array.
class FullScan {
  rebuild(enemies) { this.enemies = enemies; this.indices = enemies.map((_, index) => index); }
  query() { return this.indices; }
  get(index) { return this.enemies[index]; }
  update() {}
  remove() {}
  clear() {}
}

function enemy(id, kind, x, z) {
  const node = () => new T.Group(), stats = ENEMY_SPECS[kind];
  const e = {
    root: node(), torso: node(), neck: node(), shadow: node(),
    arms: [node(), node()], elbows: [node(), node()], knees: [node(), node()], legs: [node(), node()],
    hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage, kind,
    phase: 0.4, attack: 0.8, meleeSwing: 0, scrakeEnraged: false,
    ragePhase: 'calm', rageTime: 10, chargeDirection: new T.Vector3(),
    rangedWindup: 0, rangedCooldown: 1.2, rangedAim: null, dead: false,
  };
  e.root.name = id;
  e.root.position.set(x, 0, z);
  if (kind === 1) e.blade = node();
  if (kind === 2) { e.chainsaw = node(); e.sawChain = node(); e.sawChain.add(node(), node()); }
  if (kind === 3) { e.drill = node(); e.drillBit = node(); e.drillBitLeft = node(); e.rageIndicator = node(); }
  return e;
}

function game(specs, obstacles = []) {
  const g = Object.assign(Object.create(Game.prototype), {
    enemies: specs.map(([kind, x, z], i) => enemy(`enemy-${i}`, kind, x, z)),
    state: { mode: 'playing', health: 10000, armor: 0, kills: 0, remaining: specs.length, cash: 0 },
    camera: new T.PerspectiveCamera(), nav: new Int16Array(61 * 61), navTime: 1000,
    obstacles, walls: [], feet: 0, corpses: [], hits: [],
    hasEnemyMeleeSight() { return true; }, updateRangedEnemy() { return false; },
    sound() {}, burst() {}, message() {},
    damagePlayer(amount) { this.hits.push(amount); this.state.health -= amount; },
  });
  g.camera.position.set(10, 1.7, 10);
  g.updateNavigation();
  return g;
}

function snapshot(g) {
  return {
    health: g.state.health, hits: g.hits,
    enemies: g.enemies.map(e => ({
      id: e.root.name, position: e.root.position.toArray(), facing: e.root.rotation.toArray(),
      hp: e.hp, phase: e.phase, attack: e.attack, meleeSwing: e.meleeSwing,
      ragePhase: e.ragePhase, rageTime: e.rageTime, scrakeEnraged: e.scrakeEnraged,
      arms: e.arms.map(arm => arm.rotation.toArray()), shadow: e.shadow.position.toArray(),
    })),
  };
}

test('sequential crowd movement and Scrake rage match full scans exactly, including death and new spawns', () => {
  for (const dense of [false, true]) {
    const spacing = dense ? 0.17 : 1.91;
    const specs = Array.from({ length: 36 }, (_, i) => [i % 3, (i % 6) * spacing - 2.01, Math.floor(i / 6) * spacing - 2.01]);
    const optimized = game(specs), original = game(specs);
    original.enemyGrid = new FullScan();
    for (const g of [optimized, original]) {
      g.enemies[2].scrakeEnraged = true;
      g.enemies[2].speed *= 3.5;
    }
    for (let frame = 0; frame < 80; frame++) {
      for (const g of [optimized, original]) {
        if (frame === 10) g.damageEnemy(g.enemies[3], 10000, new T.Vector3());
        if (frame === 20) g.enemies.push(enemy('new-spawn', 0, -0.01, -0.01));
        if (frame === 30) g.state.mode = 'paused';
        if (frame === 32) g.state.mode = 'playing';
        g.updateEnemies(frame % 2 ? 0.016 : 0.05);
      }
      assert.deepEqual(snapshot(optimized), snapshot(original), `dense=${dense}, frame=${frame}`);
    }
  }
});

test('multiple Freshpound charges preserve substep pushes, candidate order and wall blocking', () => {
  const specs = [[0, -0.05, -2], [3, -2.05, -2], [0, 0.05, -2], [0, 2.05, -2.1],
    [3, 3.95, -2], [2, 1.8, -1.95], [0, 0, -1.6], [0, 4.1, -2.2]];
  const wall = new T.Box3(new T.Vector3(5, 0, -5), new T.Vector3(5.1, 4, 5));
  const optimized = game(specs, [wall]), original = game(specs, [wall]);
  original.enemyGrid = new FullScan();
  for (const g of [optimized, original]) {
    for (const index of [1, 4]) {
      const e = g.enemies[index];
      e.ragePhase = 'charging'; e.rageTime = 3;
      e.chargeDirection.set(index === 1 ? 1 : -1, 0, 0);
    }
  }
  for (let frame = 0; frame < 50; frame++) {
    optimized.updateEnemies(0.05);
    original.updateEnemies(0.05);
    assert.deepEqual(snapshot(optimized), snapshot(original), `charge frame ${frame}`);
  }
});

test('Hans movement is visible to later enemy separation within the same frame', () => {
  const specs = [[7, -6, 0], [0, 0, 0], [1, 0.5, 0.2]];
  const optimized = game(specs), original = game(specs);
  original.enemyGrid = new FullScan();
  for (const g of [optimized, original]) {
    g.hans = { update() { g.enemies[0].root.position.set(0.1, 0, 0.1); } };
  }
  optimized.updateEnemies(0.05);
  original.updateEnemies(0.05);
  assert.deepEqual(snapshot(optimized), snapshot(original));
});

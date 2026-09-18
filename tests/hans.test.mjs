import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';
import { HANS } from '../lib/hans.ts';

function fixture(t, spawn = true) {
  const g = Object.create(Game.prototype), graphics = new Graphics();
  Object.assign(g, {
    graphics, scene: new T.Scene(), camera: new T.PerspectiveCamera(), ray: new T.Raycaster(),
    state: { mode: 'playing', wave: 7, health: 100, armor: 0, cash: 1000, kills: 0, remaining: 1,
      owned: [true, true, true, true], medicalKits: 2, healCooldown: 0, katana: true, level: 2, boss: null },
    difficulty: 1.35, difficultyMode: 'hard', pending: 1, navTime: 0,
    nav: new Int16Array(61 * 61), keys: new Set(), obstacles: [], walls: [], enemies: [], corpses: [],
    particles: [], enemyProjectiles: [], thrownGrenades: [], rockets: [], feet: 0, weaponIndex: 0,
    ammo: [15, 30, 10, 1], reserve: [60, 120, 20, 10],
    sound() {}, hurtSound() {}, meleeSound() {}, burst() {}, message() {}, emit() {}, lock() {}, waveAlertSound() {},
    contactShadow(x, z) {
      const shadow = new T.Mesh(graphics.plane, graphics.material(new T.MeshBasicMaterial()));
      shadow.position.set(x, 0.025, z); g.scene.add(shadow); return shadow;
    },
  });
  g.camera.position.set(0, 1.7, 0); g.scene.add(g.camera);
  if (spawn) { g.spawn(); g.enemies[0].root.position.set(0, 0, -10); }
  t.after(() => { g.clearEnemyProjectiles(); g.hans?.dispose(); graphics.dispose(); });
  return g;
}
function wall(g, z = -3) {
  const mesh = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  mesh.position.set(0, 2, z); mesh.scale.set(8, 4, 0.3); g.scene.add(mesh);
  g.scene.updateMatrixWorld(true); g.walls.push(mesh); g.obstacles.push(new T.Box3().setFromObject(mesh));
  return mesh;
}
function advance(g, seconds) {
  for (let time = 0; time < seconds - 0.00001; time += 0.05) g.hans.update(Math.min(0.05, seconds - time));
}

test('Hard and Normal wave 6 rewards and resupply lead to Hans on Wave 7 (20000 HP on Hard, 15000 HP on Normal)', (t) => {
  const g = fixture(t, false);
  g.state.wave = 6; g.state.health = 20; g.state.remaining = 0; g.pending = 0;
  g.completeWave();
  assert.equal(g.state.mode, 'cleared'); assert.equal(g.state.health, 100); assert.equal(g.state.cash, 1550);
  g.openShop(); g.buy('health'); assert.equal(g.state.medicalKits, 3);
  g.nextWave();
  assert.equal(g.state.wave, 7); assert.equal(g.pending, 1); assert.equal(g.state.remaining, 1);
  assert.equal(g.chooseEnemyKind(), HANS.kind);
  g.spawn(); assert.equal(g.enemies.length, 1); assert.equal(g.pending, 0); assert.equal(g.enemies[0].hp, 20000);
  assert.equal(g.hans.maxHealth, 20000);
  assert.equal(g.hans.snapshot().maxHealth, 20000);
  assert.equal(g.state.katana, true); assert.equal(g.state.level, 2);
  const normal = fixture(t, false);
  normal.difficultyMode = 'normal'; normal.state.wave = 6; normal.completeWave();
  assert.equal(normal.state.mode, 'cleared');
  normal.openShop();
  normal.nextWave();
  assert.equal(normal.state.wave, 7);
  assert.equal(normal.pending, 1);
  assert.equal(normal.chooseEnemyKind(), HANS.kind);
  normal.spawn();
  assert.equal(normal.enemies[0].hp, 15000);
  assert.equal(normal.hans.maxHealth, 15000);
  assert.equal(normal.hans.snapshot().maxHealth, 15000);
  normal.enemies[0].dead = true;
  normal.enemies = [];
  normal.completeWave();
  assert.equal(normal.state.mode, 'won');
});

test('Hans model binds both rifles and a headshot target with bounded reusable resources', (t) => {
  const g = fixture(t), a = g.enemies[0], b = g.graphics.createEnemy(7);
  assert.ok(a.root.getObjectByName('hans-backpack')); assert.ok(a.hans.reactor);
  assert.equal(a.hans.rifles.length, 2); assert.equal(a.hans.muzzles.length, 2);
  a.root.updateMatrixWorld(true);
  const target = new T.Box3().setFromObject(a.neck).getCenter(new T.Vector3());
  const ray = new T.Raycaster(target.clone().add(new T.Vector3(0, 0, 4)), new T.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects(a.parts)[0]?.object.userData.hitZone, 'head');
  assert.ok(a.parts.every((part) => !part.userData.noHit));
  a.arms[0].rotation.x = -1; assert.notEqual(a.arms[0].rotation.x, b.arms[0].rotation.x);
  let triangles = 0, draws = 0;
  a.root.traverseVisible((o) => { if (o instanceof T.Mesh) { draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  assert.ok(triangles < 16000, `${triangles} triangles`); assert.ok(draws < 65, `${draws} draw calls`);
  const before = [g.graphics.geometries.size, g.graphics.materials.size, g.graphics.enemyMaterials.materials.size];
  for (let i = 0; i < 8; i++) g.graphics.createEnemy(7);
  assert.deepEqual([g.graphics.geometries.size, g.graphics.materials.size, g.graphics.enemyMaterials.materials.size], before);
});

test('boss cycles through all requested actions and pauses its combat clock', (t) => {
  const g = fixture(t); g.state.health = 10000;
  const seen = new Set();
  for (let i = 0; i < 900; i++) { g.updateEnemies(0.05); seen.add(g.hans.action); }
  for (const action of ['rifle', 'gas-windup', 'dash', 'leap', 'stunned']) assert.ok(seen.has(action), action);
  g.state.mode = 'paused';
  const before = [g.hans.timer, g.hans.energy, ...g.enemies[0].root.position.toArray()];
  g.updateEnemies(2); g.hans.update(2);
  assert.deepEqual([g.hans.timer, g.hans.energy, ...g.enemies[0].root.position.toArray()], before);
});

test('energy depletion stuns for four seconds, exposes bonus damage, then recharges', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  h.energy = 0; h.update(0.01); assert.equal(h.action, 'stunned');
  const pos = e.root.position.clone(); advance(g, 3.9);
  assert.equal(h.action, 'stunned'); assert.deepEqual(e.root.position, pos);
  g.damageEnemy(e, 100, pos); assert.equal(e.hp, HANS.hpHard - 150);
  advance(g, 0.11); assert.equal(h.action, 'approach'); assert.ok(h.energy > 99);
  g.damageEnemy(e, 100, pos); assert.equal(e.hp, HANS.hpHard - 250);
  e.hp = h.maxHealth * 0.65; assert.equal(h.snapshot().phase, 2);
  e.hp = h.maxHealth * 0.3; assert.equal(h.snapshot().phase, 3);
});

test('leaping claw hits once, and leap/dash substeps cannot cross solid cover', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  e.root.position.set(0, 0, -4); h.direction.set(0, 0, 1); h.action = 'leap'; h.timer = h.motionDuration = 0.7;
  advance(g, 0.7); assert.equal(g.state.health, 70);
  e.root.position.set(0, 0, -6); wall(g, -3);
  h.action = 'leap'; h.timer = h.motionDuration = 0.7; h.clawHit = false;
  advance(g, 0.7); assert.ok(e.root.position.z < -3.5); assert.equal(g.state.health, 70);
  e.root.position.set(0, 0, -6); h.action = 'dash'; h.timer = 0.65;
  advance(g, 0.65); assert.ok(e.root.position.z < -3.5);
});

test('dual rifles alternate muzzle origins and their fast bullets stop at cover', (t) => {
  const g = fixture(t), h = g.hans;
  t.mock.method(Math, 'random', () => 0.5);
  h.action = 'rifle'; h.timer = 2.4; h.aim.set(0, 1, 0); advance(g, 0.15);
  assert.equal(g.enemyProjectiles.length, 2);
  assert.ok(g.enemyProjectiles[0].mesh.position.x < 0); assert.ok(g.enemyProjectiles[1].mesh.position.x > 0);
  assert.ok(Math.abs(g.enemyProjectiles[0].velocity.length() - HANS.rifleSpeed) < 1e-8);
  wall(g, -5);
  for (let i = 0; i < 20; i++) g.updateEnemyProjectiles(0.05);
  assert.equal(g.state.health, 100); assert.equal(g.enemyProjectiles.length, 0);
});

test('visible gas grenades create temporary non-stacking hazards, pause, and respect cover', (t) => {
  const g = fixture(t), h = g.hans;
  h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  assert.equal(h.grenades.length, 2); assert.equal(h.clouds.length, 0); assert.equal(g.state.health, 100);
  assert.ok(h.grenades.every((p) => p.mesh.parent === g.scene));
  g.state.mode = 'paused'; const fuse = h.grenades[0].fuse;
  h.updateHazards(2); assert.equal(h.grenades[0].fuse, fuse);
  g.state.mode = 'playing'; for (let i = 0; i < 30; i++) h.updateHazards(0.05);
  assert.equal(h.grenades.length, 0); assert.equal(h.clouds.length, 2);
  h.clouds.forEach((cloud) => cloud.mesh.position.set(0, 0, 0));
  const before = g.state.health; h.gasTick = 0; h.updateHazards(0.5);
  assert.equal(before - g.state.health, HANS.gasDamagePerSecond * 0.5, 'overlapping clouds do not stack');
  h.clouds.forEach((cloud) => cloud.mesh.position.set(0, 0, -3)); wall(g, -1.5);
  const sheltered = g.state.health; h.updateHazards(0.5); assert.equal(g.state.health, sheltered);
  h.updateHazards(6); assert.equal(h.clouds.length, 0);
});

test('gas grenades bounce off cover instead of delivering poison through it', (t) => {
  const g = fixture(t), h = g.hans;
  wall(g, -5); h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  for (let i = 0; i < 32; i++) h.updateHazards(0.05);
  assert.equal(h.clouds.length, 2); assert.ok(h.clouds.every((p) => p.mesh.position.z < -5));
  assert.equal(g.state.health, 100);
});

test('boss death clears gas and bullets, stops attacks and allows the Hard victory', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  h.action = 'rifle'; h.timer = 1; h.update(0.02);
  assert.ok(h.grenades.length && g.enemyProjectiles.length);
  g.damageEnemy(e, e.hp + 1, e.root.position);
  assert.equal(e.dead, true); assert.equal(g.state.remaining, 0);
  assert.equal(h.grenades.length, 0); assert.equal(h.clouds.length, 0); assert.equal(g.enemyProjectiles.length, 0);
  const timer = h.timer; h.update(1); assert.equal(h.timer, timer);
  g.completeWave(); assert.equal(g.state.mode, 'won'); assert.equal(g.state.health, 100);
});

test('MKb42 rifle aiming directly tracks player position without delayed lerp', (t) => {
  const g = fixture(t), h = g.hans;
  h.action = 'rifle'; h.timer = 2.4;
  g.camera.position.set(4, 1.7, -2);
  h.update(0.05);
  assert.equal(h.aim.x, 4);
  assert.equal(h.aim.y, 1.7);
  assert.equal(h.aim.z, -2);
  // Player moves to another position
  g.camera.position.set(-3, 2.0, 5);
  h.update(0.05);
  assert.equal(h.aim.x, -3);
  assert.equal(h.aim.y, 2.0);
  assert.equal(h.aim.z, 5);
  // Also tracks during rifle-windup
  h.action = 'rifle-windup'; h.timer = 0.5;
  g.camera.position.set(7, 1.8, -9);
  h.update(0.05);
  assert.equal(h.aim.x, 7);
  assert.equal(h.aim.y, 1.8);
  assert.equal(h.aim.z, -9);
});

test('Hans movement speed and dash speed are scaled to pressure the player across all 3 phases', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  assert.equal(HANS.speed, 6.0);
  // Phase 1 (100% HP)
  assert.equal(h.phase, 1);
  e.root.position.set(0, 0, -10);
  g.camera.position.set(0, 1.7, 0);
  // Measure 1 second of chase (6.0 + 1 * 0.24 = 6.24 m/s)
  h.action = 'approach'; h.timer = 99;
  advance(g, 1.0);
  const phase1Speed = e.root.position.z - (-10);
  assert.ok(Math.abs(phase1Speed - 6.24) < 0.05, `Phase 1 chase speed was ${phase1Speed}, expected ~6.24`);

  // Dash speed across phases:
  // Phase 1: 16.2 + 1 * 1.8 = 18.0 m/s
  e.root.position.set(0, 0, -20);
  h.action = 'dash'; h.direction.set(0, 0, 1); h.timer = 0.65;
  advance(g, 0.1);
  const dash1Distance = e.root.position.z - (-20);
  assert.ok(Math.abs(dash1Distance - 1.8) < 0.05, `Phase 1 dash moved ${dash1Distance} in 0.1s, expected ~1.8m (18m/s)`);

  // Phase 2 (50% HP): 16.2 + 2 * 1.8 = 19.8 m/s
  e.hp = HANS.hp * 0.5;
  assert.equal(h.phase, 2);
  e.root.position.set(0, 0, -20);
  h.action = 'dash'; h.direction.set(0, 0, 1); h.timer = 0.65;
  advance(g, 0.1);
  const dash2Distance = e.root.position.z - (-20);
  assert.ok(Math.abs(dash2Distance - 1.98) < 0.05, `Phase 2 dash moved ${dash2Distance} in 0.1s, expected ~1.98m (19.8m/s)`);

  // Phase 3 (20% HP): 16.2 + 3 * 1.8 = 21.6 m/s
  e.hp = HANS.hp * 0.2;
  assert.equal(h.phase, 3);
  e.root.position.set(0, 0, -20);
  h.action = 'dash'; h.direction.set(0, 0, 1); h.timer = 0.65;
  advance(g, 0.1);
  const dash3Distance = e.root.position.z - (-20);
  assert.ok(Math.abs(dash3Distance - 2.16) < 0.05, `Phase 3 dash moved ${dash3Distance} in 0.1s, expected ~2.16m (21.6m/s)`);
});

test('gas grenade damage is 24 / 30 / 36 DPS across phases 1, 2, and 3', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  assert.equal(HANS.gasDamagePerSecond, 24);

  // Phase 1 throw
  h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  assert.equal(h.grenades[0].damage, 24);
  h.clearHazards();

  // Phase 2 throw
  e.hp = HANS.hp * 0.5;
  assert.equal(h.phase, 2);
  h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  assert.equal(h.grenades[0].damage, 30);
  h.clearHazards();

  // Phase 3 throw
  e.hp = HANS.hp * 0.2;
  assert.equal(h.phase, 3);
  h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0); h.update(0.02);
  assert.equal(h.grenades[0].damage, 36);
  assert.equal(h.grenades.length, 3);
  h.clearHazards();
});

test('MKb42 bullets cannot penetrate cover or containers even when firing right against them', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  t.mock.method(Math, 'random', () => 0.5);

  // Place a solid wall representing a shipping container at z = -5, thickness 2m (z: -6 to -4).
  const geom = new T.BoxGeometry(1, 1, 1);
  const mat = new T.MeshStandardMaterial();
  const container = new T.Mesh(geom, mat);
  container.position.set(0, 1.7, -5);
  container.scale.set(8, 3.4, 2);
  container.updateMatrixWorld(true);
  g.walls.push(container);
  g.obstacles.push(new T.Box3().setFromObject(container));
  g.scene.add(container);

  // Hans is standing at z = -3.5 (0.5m south of the container wall at z = -4.0).
  // Player is on the opposite side of the container at z = -10.
  e.root.position.set(0, 0, -3.5);
  g.camera.position.set(0, 1.7, -10);
  h.action = 'rifle';
  h.timer = 2.4;
  h.aim.copy(g.camera.position);

  // Advance to fire bullets
  advance(g, 0.15);
  assert.ok(g.enemyProjectiles.length > 0, 'bullets were fired');

  // Verify that all spawned bullets are outside the container Box3
  const containerBox = g.obstacles[g.obstacles.length - 1];
  for (const p of g.enemyProjectiles) {
    assert.equal(containerBox.containsPoint(p.mesh.position), false, 'bullet origin must not be inside container');
    assert.ok(p.mesh.position.z >= -4.01, 'bullet must be clamped outside south wall');
  }

  // Update projectiles across multiple frames
  for (let i = 0; i < 20; i++) g.updateEnemyProjectiles(0.05);

  // Player behind container took no damage
  assert.equal(g.state.health, 100, 'player behind cover must take no damage');
  assert.equal(g.enemyProjectiles.length, 0, 'all bullets stopped at container');
});

test('Hans energy drain and action consumption costs maintain energy longer before depletion', (t) => {
  const g = fixture(t), h = g.hans, e = g.enemies[0];
  g.state.health = 10000;

  // Verify rebalanced constants
  assert.equal(HANS.energy, 100);
  assert.equal(HANS.energyDrain, 1);
  assert.equal(HANS.rifleCost, 18);
  assert.equal(HANS.gasCost, 22);
  assert.equal(HANS.dashCost, 12);
  assert.equal(HANS.leapCost, 20);

  // 1. Verify passive drain is 1 energy per second
  h.action = 'approach'; h.timer = 99; h.energy = 100;
  e.root.position.set(0, 0, -50); // far away so no action triggers
  advance(g, 2.0);
  assert.ok(Math.abs(h.energy - (100 - 2.0 * HANS.energyDrain)) < 0.05, `Energy after 2s drain: ${h.energy}`);

  // 2. Verify rifle action spends HANS.rifleCost (18)
  h.energy = 100; h.action = 'rifle-windup'; h.timer = 0.01; h.aim.set(0, 1, 0);
  h.update(0.02);
  assert.equal(h.action, 'rifle');
  assert.ok(Math.abs(h.energy - (100 - HANS.rifleCost - 0.02 * HANS.energyDrain)) < 0.05);

  // 3. Verify gas action spends HANS.gasCost (22)
  h.energy = 100; h.action = 'gas-windup'; h.timer = 0.01; h.aim.set(0, 1, 0);
  h.update(0.02);
  assert.equal(h.action, 'recover');
  assert.ok(Math.abs(h.energy - (100 - HANS.gasCost - 0.02 * HANS.energyDrain)) < 0.05);
  h.clearHazards();

  // 4. Verify dash action spends HANS.dashCost (12)
  h.energy = 100; h.action = 'dash-windup'; h.timer = 0.01; h.aim.set(0, 1, 0);
  h.update(0.02);
  assert.equal(h.action, 'dash');
  assert.ok(Math.abs(h.energy - (100 - HANS.dashCost - 0.02 * HANS.energyDrain)) < 0.05);

  // 5. Verify leap action spends HANS.leapCost (20)
  h.energy = 100; h.action = 'leap-windup'; h.timer = 0.01; h.aim.set(0, 1, 0);
  h.update(0.02);
  assert.equal(h.action, 'leap');
  assert.ok(Math.abs(h.energy - (100 - HANS.leapCost - 0.02 * HANS.energyDrain)) < 0.05);

  // 6. Verify Hans completes a full 4-action rotation (rifle, gas, dash, leap) with energy remaining
  const g2 = fixture(t), h2 = g2.hans, e2 = g2.enemies[0];
  g2.state.health = 10000;
  e2.root.position.set(0, 0, -5);
  g2.camera.position.set(0, 1.7, 0);

  // Initial approach (1.5s) -> sequence 0: rifle windup (0.85s) + rifle (2.4s) + recover (0.78s) + approach (0.35s)
  advance(g2, 1.5 + 0.05);
  assert.equal(h2.action, 'rifle-windup');
  advance(g2, 0.85 + 2.4 + 0.78 + 0.35);
  assert.ok(h2.energy > 50, `Energy after rifle cycle should be > 50, got ${h2.energy}`);

  // Sequence 1: gas windup (1.0s) + recover (0.78s) + approach (0.35s)
  advance(g2, 0.05);
  assert.equal(h2.action, 'gas-windup');
  advance(g2, 1.0 + 0.78 + 0.35);
  assert.ok(h2.energy > 30, `Energy after gas cycle should be > 30, got ${h2.energy}`);
  h2.clearHazards();

  // Sequence 2: dash windup (0.5s) + dash (0.65s) + recover (0.78s) + approach (0.35s)
  advance(g2, 0.05);
  assert.equal(h2.action, 'dash-windup');
  advance(g2, 0.5);
  assert.equal(h2.action, 'dash');
  advance(g2, 0.65 + 0.78 + 0.35);
  assert.ok(h2.energy > 15, `Energy after dash cycle should be > 15, got ${h2.energy}`);

  // Sequence 3: leap windup (0.7s) + leap (~0.7s) + recover (0.78s) + approach (0.35s)
  advance(g2, 0.05);
  assert.equal(h2.action, 'leap-windup');
  advance(g2, 0.7);
  assert.equal(h2.action, 'leap');
  advance(g2, 0.7 + 0.78 + 0.35);

  // Full rotation complete: Hans has performed rifle, gas, dash, leap and still has energy!
  assert.ok(h2.energy > 0, `Hans should not be out of charge after full 4-action rotation, got ${h2.energy}`);
  assert.notEqual(h2.action, 'stunned', 'Hans must not be stunned after 1 rotation');

  // Advance into 5th action (close melee leap attack) which exhausts remaining energy and triggers stun
  advance(g2, 0.05);
  assert.equal(h2.action, 'leap-windup', '5th action at close range triggers claw attack');
  advance(g2, 0.7 + 0.7 + 0.8);
  assert.equal(h2.action, 'stunned', 'Hans should stun after completing prolonged combat through 5th action');

  // 7. Verify ranged 5th action path: when player stays outside melee range (>= 3m), 5th action fires rifles to exhaustion
  const g3 = fixture(t), h3 = g3.hans, e3 = g3.enemies[0];
  g3.state.health = 10000;
  e3.root.position.set(0, 0, -5);
  g3.camera.position.set(0, 1.7, 0);
  advance(g3, 1.5 + 0.85 + 2.4 + 0.78 + 0.35); // rifle cycle
  advance(g3, 1.0 + 0.78 + 0.35); // gas cycle
  h3.clearHazards();
  advance(g3, 0.5 + 0.65 + 0.78 + 0.35); // dash cycle
  advance(g3, 0.7 + 0.7 + 0.78 + 0.35); // leap cycle
  assert.ok(h3.energy > 0, 'energy remaining before 5th action');
  g3.camera.position.set(0, 1.7, 5); // back away outside 3m
  advance(g3, 0.15);
  assert.equal(h3.action, 'rifle-windup', 'at distance >= 3m, 5th action selects rifle');
  advance(g3, 0.85);
  assert.equal(h3.action, 'rifle');
  assert.equal(h3.energy, 0, 'energy exhausted to 0 by rifle spend');
  advance(g3, 2.4 + 0.1);
  assert.equal(h3.action, 'stunned', 'Hans finishes rifle spray before entering stun');
});

test('leap slash catches a backpedaling player along the attack vector, but sideways dodge evades it', (t) => {
  assert.equal(HANS.clawRange, 3.5);

  const dt = 0.05;
  // Scenario 1: Player walks backward along the attack vector (+Z).
  // Hans leaps with follow-through and 3.5m claw range, successfully catching backpedaling players across all ranges (6m to 14m).
  for (const dist of [6, 8, 10, 12, 14]) {
    const g1 = fixture(t);
    const h1 = g1.hans, e1 = g1.enemies[0];
    e1.root.position.set(0, 0, -dist);
    g1.camera.position.set(0, 1.7, 0);
    h1.action = 'approach';
    h1.timer = 0;
    h1.sequence = 3;
    h1.chooseNextAction(dist);
    assert.equal(h1.action, 'leap-windup');
    assert.equal(h1.clawHit, false);

    for (let elapsed = 0; elapsed < 1.45; elapsed += dt) {
      g1.camera.position.z += 3.7 * dt;
      h1.update(dt);
    }
    assert.equal(h1.clawHit, true, `leap slash must connect against purely backpedaling player at distance ${dist}m`);
    assert.equal(g1.state.health, 70, `Phase 1 claw deals 30 damage at distance ${dist}m (100 - 30 = 70)`);
  }

  // Scenario 2: Player dodges sideways (+X) at standard walking speed (3.7 m/s).
  // Because Hans aims along the windup stance vector, the player steps off the leap line and evades.
  for (const dist of [6, 8, 10, 12, 14]) {
    const g2 = fixture(t);
    const h2 = g2.hans, e2 = g2.enemies[0];
    e2.root.position.set(0, 0, -dist);
    g2.camera.position.set(0, 1.7, 0);
    h2.action = 'approach';
    h2.timer = 0;
    h2.sequence = 3;
    h2.chooseNextAction(dist);
    assert.equal(h2.action, 'leap-windup');
    assert.equal(h2.clawHit, false);

    for (let elapsed = 0; elapsed < 1.45; elapsed += dt) {
      g2.camera.position.x += 3.7 * dt;
      h2.update(dt);
    }
    assert.equal(h2.clawHit, false, `sideways dodge must successfully evade the leap trajectory at distance ${dist}m`);
    assert.equal(g2.state.health, 100, `player taking sideways evasion takes zero damage at distance ${dist}m`);
  }

  // Scenario 3: Stationary player is hit across all ranges (6m to 14m)
  for (const dist of [6, 8, 10, 12, 14]) {
    const g3 = fixture(t);
    const h3 = g3.hans, e3 = g3.enemies[0];
    e3.root.position.set(0, 0, -dist);
    g3.camera.position.set(0, 1.7, 0);
    h3.action = 'approach';
    h3.timer = 0;
    h3.sequence = 3;
    h3.chooseNextAction(dist);

    for (let elapsed = 0; elapsed < 1.45; elapsed += dt) {
      h3.update(dt);
    }
    assert.equal(h3.clawHit, true, `stationary player must be hit at distance ${dist}m`);
  }
});

test('chooseNextAction triggers leap when within 25m range and prioritizes close melee under 3m', (t) => {
  const g = fixture(t);
  const h = g.hans, e = g.enemies[0];

  // 1. At close range (< 3m), leap slash is prioritized regardless of sequence
  for (let seq = 0; seq < 4; seq++) {
    h.sequence = seq;
    e.root.position.set(0, 0, -2.5);
    g.camera.position.set(0, 1.7, 0);
    h.chooseNextAction(2.5);
    assert.equal(h.action, 'leap-windup', `close range sequence ${seq} should trigger leap-windup`);
  }

  // 2. On rotation slot 3 (next === 3), leap triggers across medium and long distance up to 25m
  for (const dist of [13, 14, 15, 16, 20, 25]) {
    h.sequence = 3;
    e.root.position.set(0, 0, -dist);
    g.camera.position.set(0, 1.7, 0);
    h.chooseNextAction(dist);
    assert.equal(h.action, 'leap-windup', `${dist}m distance should trigger leap-windup on slot 3`);
  }

  // 3. At extreme distance (> 25m), rotation slot 3 falls back to dash-windup to close gap
  h.sequence = 3;
  e.root.position.set(0, 0, -26);
  g.camera.position.set(0, 1.7, 0);
  h.chooseNextAction(26);
  assert.equal(h.action, 'dash-windup', '26m distance should fallback to dash-windup');
});

test('Super Leap (超大跳躍) executes across long ranges (15m to 25m), reaches high parabolic altitude, catches backpedalers, and allows sideways evasion', (t) => {
  assert.equal(HANS.leapRange, 25);
  const dt = 0.05;

  // 1. Catches backpedaling players (S key at 3.7 m/s) across long distances [15, 16, 18, 20, 22, 25]m
  for (const dist of [15, 16, 18, 20, 22, 25]) {
    const g1 = fixture(t);
    const h1 = g1.hans, e1 = g1.enemies[0];
    e1.root.position.set(0, 0, -dist);
    g1.camera.position.set(0, 1.7, 0);
    h1.action = 'approach';
    h1.timer = 0;
    h1.sequence = 3;
    h1.chooseNextAction(dist);
    assert.equal(h1.action, 'leap-windup');
    assert.equal(h1.clawHit, false);

    let peakHeight = 0;
    for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
      g1.camera.position.z += 3.7 * dt;
      h1.update(dt);
      if (h1.action === 'leap') {
        peakHeight = Math.max(peakHeight, e1.root.position.y);
      }
    }
    assert.equal(h1.clawHit, true, `Super Leap must connect against backpedaling player at distance ${dist}m`);
    assert.equal(g1.state.health, 70, `Phase 1 claw deals 30 damage at distance ${dist}m (100 - 30 = 70)`);
    // Verify high parabolic altitude: long-distance leaps jump significantly higher than standard 1.1m
    assert.ok(peakHeight >= 2.0, `Peak leap height at ${dist}m was ${peakHeight}, expected >= 2.0m`);
    if (dist === 25) {
      assert.ok(peakHeight >= 3.3, `Peak leap height at 25m was ${peakHeight}, expected >= 3.3m`);
      assert.ok(h1.leapVelocity >= 30, `Leap velocity at 25m was ${h1.leapVelocity}, expected >= 30m/s`);
    }
  }

  // 2. Sideways dodge (A/D key at 3.7 m/s) successfully evades Super Leap
  for (const dist of [15, 16, 18, 20, 22, 25]) {
    const g2 = fixture(t);
    const h2 = g2.hans, e2 = g2.enemies[0];
    e2.root.position.set(0, 0, -dist);
    g2.camera.position.set(0, 1.7, 0);
    h2.action = 'approach';
    h2.timer = 0;
    h2.sequence = 3;
    h2.chooseNextAction(dist);
    assert.equal(h2.action, 'leap-windup');
    assert.equal(h2.clawHit, false);

    for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
      g2.camera.position.x += 3.7 * dt;
      h2.update(dt);
    }
    assert.equal(h2.clawHit, false, `sideways dodge must successfully evade Super Leap at distance ${dist}m`);
    assert.equal(g2.state.health, 100, `player taking sideways evasion takes zero damage at distance ${dist}m`);
  }

  // 3. Stationary player is hit across all long distances [15, 16, 18, 20, 22, 25]m
  for (const dist of [15, 16, 18, 20, 22, 25]) {
    const g3 = fixture(t);
    const h3 = g3.hans, e3 = g3.enemies[0];
    e3.root.position.set(0, 0, -dist);
    g3.camera.position.set(0, 1.7, 0);
    h3.action = 'approach';
    h3.timer = 0;
    h3.sequence = 3;
    h3.chooseNextAction(dist);

    for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
      h3.update(dt);
    }
    assert.equal(h3.clawHit, true, `stationary player must be hit by Super Leap at distance ${dist}m`);
    assert.equal(g3.state.health, 70);
  }

  // 4. Solid obstacle blocks Super Leap
  const g4 = fixture(t);
  const h4 = g4.hans, e4 = g4.enemies[0];
  e4.root.position.set(0, 0, -25);
  g4.camera.position.set(0, 1.7, 0);
  wall(g4, -10);
  h4.action = 'approach';
  h4.timer = 0;
  h4.sequence = 3;
  h4.chooseNextAction(25);
  assert.equal(h4.action, 'leap-windup');

  for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
    h4.update(dt);
  }
  assert.equal(h4.clawHit, false, 'Super Leap cannot hit player through solid cover');
  assert.equal(g4.state.health, 100);
  assert.ok(e4.root.position.z < -9.5, 'Hans stops at the wall and cannot cross it');

  // 5. Backpedaling player jumping with Space key (vertical velocity) is caught at long range
  const g5 = fixture(t);
  const h5 = g5.hans, e5 = g5.enemies[0];
  e5.root.position.set(0, 0, -25);
  g5.camera.position.set(0, 1.7, 0);
  g5.vertical = 0;
  h5.action = 'approach';
  h5.timer = 0;
  h5.sequence = 3;
  h5.chooseNextAction(25);
  for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
    g5.camera.position.z += 3.7 * dt;
    if (elapsed >= 0.7 && g5.feet <= 0.01) g5.vertical = 5.3;
    if (g5.vertical !== 0) {
      g5.vertical -= 14 * dt;
      g5.feet = Math.max(0, g5.feet + g5.vertical * dt);
      if (g5.feet === 0) g5.vertical = 0;
    }
    h5.update(dt);
  }
  assert.equal(h5.clawHit, true, 'Super Leap must catch jumping backpedaling player at 25m');
  assert.equal(g5.state.health, 70);

  // 6. Sprinting backward (Shift+S at 6.2 m/s) at maximum 25m boundary vs normal walking backpedal (3.7 m/s)
  const g6 = fixture(t);
  const h6 = g6.hans, e6 = g6.enemies[0];
  e6.root.position.set(0, 0, -25);
  g6.camera.position.set(0, 1.7, 0);
  h6.action = 'approach';
  h6.timer = 0;
  h6.sequence = 3;
  h6.chooseNextAction(25);
  for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
    g6.camera.position.z += 6.2 * dt; // sprint speed
    h6.update(dt);
  }
  // Sprinting backward allows escaping reach at the extreme boundary (25m), whereas S key (3.7 m/s) cannot escape
  assert.equal(h6.clawHit, false, 'full backward sprint (6.2 m/s) escapes claw reach at extreme 25m boundary');
  assert.equal(g6.state.health, 100);

  // 7. leapHeight returns cleanly to 1.1 on recover and stun
  const g7 = fixture(t);
  const h7 = g7.hans, e7 = g7.enemies[0];
  e7.root.position.set(0, 0, -25);
  g7.camera.position.set(0, 1.7, 0);
  h7.action = 'approach';
  h7.timer = 0;
  h7.sequence = 3;
  h7.chooseNextAction(25);
  for (let elapsed = 0; elapsed < 1.7; elapsed += dt) {
    h7.update(dt);
  }
  assert.equal(h7.leapHeight, 1.1, 'leapHeight resets to default 1.1 after recovering');
  h7.action = 'approach';
  h7.energy = 0;
  h7.update(0.01);
  assert.equal(h7.action, 'stunned');
  assert.equal(h7.leapHeight, 1.1, 'leapHeight resets to default 1.1 on stun');
});

test('leap slash respects hasCoverBetween and scales damage across phases 1, 2, and 3', (t) => {
  const g = fixture(t);
  const h = g.hans, e = g.enemies[0];

  // 1. Cover occlusion with hasCoverBetween
  wall(g, -2);
  e.root.position.set(0, 0, -3.5);
  g.camera.position.set(0, 1.7, 0);
  assert.equal(h.canSeePlayer(), false, 'canSeePlayer must return false when wall is between');

  // Leaping towards cover stops and does not penetrate
  h.action = 'leap';
  h.timer = h.motionDuration = 0.5;
  h.direction.set(0, 0, 1);
  advance(g, 0.5);
  assert.equal(g.state.health, 100, 'leap cannot hit through solid cover');

  // 2. Phase scaling damage: Phase 1 = 30, Phase 2 = 34, Phase 3 = 38
  const gPhases = fixture(t);
  const hP = gPhases.hans, eP = gPhases.enemies[0];

  // Phase 1: 100% HP -> 30 damage
  eP.root.position.set(0, 0, -2);
  gPhases.camera.position.set(0, 1.7, 0);
  hP.action = 'leap';
  hP.timer = hP.motionDuration = 0.3;
  hP.direction.set(0, 0, 1);
  hP.clawHit = false;
  advance(gPhases, 0.3);
  assert.equal(gPhases.state.health, 70, 'Phase 1 claw deals 30 damage');

  // Phase 2: 50% HP -> 34 damage (70 - 34 = 36)
  eP.hp = HANS.hp * 0.5;
  assert.equal(hP.phase, 2);
  eP.root.position.set(0, 0, -2);
  hP.action = 'leap';
  hP.timer = hP.motionDuration = 0.3;
  hP.direction.set(0, 0, 1);
  hP.clawHit = false;
  advance(gPhases, 0.3);
  assert.equal(gPhases.state.health, 36, 'Phase 2 claw deals 34 damage');

  // Phase 3: 20% HP -> 38 damage (36 - 38 = -2 -> 0)
  eP.hp = HANS.hp * 0.2;
  assert.equal(hP.phase, 3);
  gPhases.state.health = 100;
  eP.root.position.set(0, 0, -2);
  hP.action = 'leap';
  hP.timer = hP.motionDuration = 0.3;
  hP.direction.set(0, 0, 1);
  hP.clawHit = false;
  advance(gPhases, 0.3);
  assert.equal(gPhases.state.health, 62, 'Phase 3 claw deals 38 damage (100 - 38 = 62)');
});


import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';

function fixture(t) {
  const g = Object.create(Game.prototype);
  const graphics = new Graphics();
  Object.assign(g, {
    graphics, scene: new T.Scene(), camera: new T.PerspectiveCamera(),
    katana: new T.Group(), ray: new T.Raycaster(),
    state: { mode: 'playing', wave: 2, health: 100, armor: 0, cash: 1000,
      owned: [true, true, false], katana: false, level: 0, kills: 0, remaining: 3 },
    ammo: [15, 30, 10], reserve: [90, 240, 60], weaponIndex: 1,
    cooldown: 0, reloadTime: 0, meleeTime: 0, sniperBoltTime: 0,
    yaw: 0, feet: 0, difficulty: 1, difficultyMode: 'normal', pending: 1,
    navTime: 1, nav: new Int16Array(61 * 61), keys: new Set(), obstacles: [],
    walls: [], enemies: [], corpses: [], particles: [], enemyProjectiles: [],
    thrownGrenades: [],
    emit() {}, sound() {}, hurtSound() {}, meleeSound() {}, burst() {}, message() {}, buildGun() {},
    contactShadow(x, z) {
      const shadow = new T.Mesh(graphics.box, graphics.material(new T.MeshBasicMaterial()));
      shadow.position.set(x, 0, z);
      g.scene.add(shadow);
      return shadow;
    },
  });
  g.camera.position.set(0, 1.7, 0);
  g.scene.add(g.camera);
  t.after(() => graphics.dispose());
  return g;
}
function spawnAt(g, kind, x, z) {
  g.chooseEnemyKind = () => kind;
  g.spawn();
  const e = g.enemies.at(-1);
  e.root.position.set(x, 0, z);
  g.scene.updateMatrixWorld(true);
  return e;
}
function projectile(g, kind = 'bile') {
  const mesh = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  mesh.position.set(0, 1, -4);
  g.scene.add(mesh);
  g.enemyProjectiles.push({ mesh, velocity: new T.Vector3(0, 0, kind === 'cannon' ? 60 : 20), life: 2, damage: 10, kind });
}

test('katana purchase permanently upgrades V without changing gun slots, and its sweep respects walls', (t) => {
  const g = fixture(t);
  const near = spawnAt(g, 0, 0, -2);
  const far = spawnAt(g, 5, 0, -4);
  const hits = [];
  g.damageEnemy = (enemy, damage) => hits.push({ enemy, damage });
  g.handleKeyDown({ code: 'KeyV' });
  assert.deepEqual(hits.map((h) => h.damage), [42]);
  assert.equal(hits[0].enemy, near);
  g.state.mode = 'shop';
  g.state.cash = 3000;
  g.buy('katana');
  assert.equal(g.state.katana, true);
  assert.equal(g.state.cash, 2000);
  assert.equal(g.weaponIndex, 1);
  assert.deepEqual(g.state.owned, [true, true, false]);
  assert.ok(g.katana.getObjectByName('blade'));
  g.state.cash = 2500;
  g.buy('katana');
  assert.equal(g.state.cash, 2500, 'cannot buy the permanent upgrade twice');
  g.equipWeapon(0);
  assert.equal(g.state.katana, true);
  g.state.mode = 'playing';
  g.handleKeyDown({ code: 'Digit4' });
  assert.equal(g.weaponIndex, 0, 'katana is not a fourth weapon slot');
  hits.length = 0;
  g.meleeTime = 0;
  g.handleKeyDown({ code: 'KeyV' });
  assert.deepEqual(hits.map((h) => h.damage), [110, 110]);
  assert.equal(hits[1].enemy, far);
  assert.deepEqual(g.ammo, [15, 30, 10]);
  g.handleKeyDown({ code: 'KeyV' });
  assert.equal(hits.length, 2, 'repeated V presses respect swing cooldown');
  const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  wall.position.set(0, 1, -3);
  wall.scale.set(2, 3, 0.2);
  g.scene.add(wall);
  g.walls = [wall];
  g.meleeTime = 0;
  hits.length = 0;
  g.melee();
  assert.deepEqual(hits.map((h) => h.enemy), [near]);

  // Katana reach is 4.2m: hits enemy at distance 4.1m, misses enemy at distance 4.3m
  g.walls = [];
  const at41 = spawnAt(g, 0, 0, -4.1);
  at41.root.position.set(0, 1.7, -4.1);
  const at43 = spawnAt(g, 0, 0, -4.3);
  at43.root.position.set(0, 1.7, -4.3);
  hits.length = 0;
  g.meleeTime = 0;
  g.melee();
  assert.ok(hits.some((h) => h.enemy === at41), 'katana reaches enemy within 4.2m (4.1m)');
  assert.ok(!hits.some((h) => h.enemy === at43), 'katana cannot reach enemy beyond 4.2m (4.3m)');
});

test('new enemies enter the wave roster while Freshpound appears in wave 5 and twice in wave 6', (t) => {
  const g = fixture(t);
  g.state.wave = 1;
  g.pending = 7;
  assert.equal(g.chooseEnemyKind(), 5); // Crawler
  g.state.wave = 2;
  g.pending = 11;
  assert.equal(g.chooseEnemyKind(), 4); // Bloat
  // Wave 5: 1 Freshpound at wave opening
  g.state.wave = 5;
  g.pending = 21; // order 0
  assert.equal(g.chooseEnemyKind(), 3); // Freshpound
  // Wave 6: exactly 2 Freshpounds (opening and midpoint) on both normal and hard
  for (const hard of [false, true]) {
    g.difficultyMode = hard ? 'hard' : 'normal';
    const total = 24 * (hard ? 2 : 1);
    g.state.wave = 6;
    // Opening Freshpound (order 0)
    g.pending = total;
    assert.equal(g.chooseEnemyKind(), 3);
    // Midpoint Freshpound (order total / 2)
    g.pending = total - Math.floor(total / 2);
    assert.equal(g.chooseEnemyKind(), 3);
    // Verify count across all orders in Wave 6
    let freshpoundCount = 0;
    for (let p = total; p > 0; p--) {
      g.pending = p;
      if (g.chooseEnemyKind() === 3) freshpoundCount++;
    }
    assert.equal(freshpoundCount, 2, `Wave 6 (${g.difficultyMode}) must spawn exactly 2 Freshpounds`);
  }
  // Verify count across all orders in Wave 5
  g.difficultyMode = 'normal';
  g.state.wave = 5;
  let wave5Freshpounds = 0;
  for (let p = 21; p > 0; p--) {
    g.pending = p;
    if (g.chooseEnemyKind() === 3) wave5Freshpounds++;
  }
  assert.equal(wave5Freshpounds, 1, 'Wave 5 must spawn exactly 1 Freshpound');
  const crawler = spawnAt(g, 5, 0, -4);
  g.updateEnemies(0.1);
  assert.ok(crawler.root.position.z > -4);
  assert.equal(crawler.legs.length, 0);
});

test('Bloat telegraphs and locks aim before firing, allowing a sideways dodge', (t) => {
  const g = fixture(t);
  const e = spawnAt(g, 4, 0, -8);
  e.rangedCooldown = 0;
  g.updateRangedEnemy(e, 0.01, 8);
  assert.ok(e.rangedWindup > 0);
  assert.equal(g.enemyProjectiles.length, 0);
  g.camera.position.x = 3;
  g.updateRangedEnemy(e, 0.4, 8);
  assert.equal(g.enemyProjectiles.length, 0);
  g.updateRangedEnemy(e, 0.4, 8);
  assert.equal(g.enemyProjectiles.length, 3);
  assert.ok(g.enemyProjectiles.every((p) => Math.abs(p.velocity.length() - 20) < 1e-8));
  assert.ok(g.enemyProjectiles.every((p) => Math.abs(p.velocity.x / p.velocity.length()) < 0.05));
  g.updateEnemyProjectiles(1);
  assert.equal(g.state.health, 100);
  g.updateEnemyProjectiles(2);
  assert.equal(g.enemyProjectiles.length, 0);
  const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  wall.position.set(0, 1.5, -6);
  wall.scale.set(8, 4, 0.2);
  g.scene.add(wall);
  g.scene.updateMatrixWorld(true);
  g.walls = [wall];
  e.rangedCooldown = 0;
  assert.equal(g.updateRangedEnemy(e, 0.01, 8), false);
  assert.equal(e.rangedWindup, 0, 'Bloat must move around cover before starting a new attack');
});

for (const kind of ['bile', 'cannon']) test(`${kind} uses swept collisions, stops at cover, pauses, and is removed at wave end`, (t) => {
  const g = fixture(t);
  const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  wall.position.set(0, 1, -2);
  wall.scale.set(2, 3, 0.2);
  g.scene.add(wall);
  g.walls = [wall];
  projectile(g, kind);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.health, 100);
  assert.equal(g.enemyProjectiles.length, 0);
  g.scene.remove(wall);
  g.walls = [];
  projectile(g, kind);
  g.state.mode = 'paused';
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.enemyProjectiles[0].mesh.position.z, -4);
  g.state.mode = 'playing';
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.health, 90, 'a fast projectile cannot skip through the player');
  const e = spawnAt(g, kind === 'cannon' ? 6 : 4, 0, -8);
  for (let i = 0; i < 30; i++) {
    e.rangedAim = g.camera.position.clone();
    if (kind === 'cannon') g.fireCannon(e);
    else g.spitBile(e);
  }
  assert.equal(g.enemyProjectiles.length, 24);
  const meshes = g.enemyProjectiles.map((p) => p.mesh);
  g.finish('cleared');
  assert.equal(g.enemyProjectiles.length, 0);
  assert.ok(meshes.every((mesh) => mesh.parent === null));
});

test('Husk charges its cannon, fires a fast locked shot, respects cover and cannot fire after death', (t) => {
  const g = fixture(t);
  const e = spawnAt(g, 6, 0, -12);
  e.rangedCooldown = 0;
  g.updateEnemies(0.01);
  assert.ok(e.cannonCharge.visible);
  assert.equal(g.enemyProjectiles.length, 0);
  const target = e.rangedAim.clone();
  const position = e.root.position.clone();
  g.camera.position.x = 3;
  g.updateEnemies(0.45);
  assert.equal(g.enemyProjectiles.length, 0);
  assert.equal(e.root.position.z, position.z, 'Husk holds its firing position');
  g.updateEnemies(0.45);
  assert.equal(e.cannonCharge.visible, false);
  assert.equal(g.enemyProjectiles.length, 1);
  const shot = g.enemyProjectiles[0];
  assert.equal(shot.kind, 'cannon');
  assert.equal(shot.damage, 28);
  assert.ok(Math.abs(shot.velocity.length() - 60) < 1e-8);
  assert.ok(shot.velocity.clone().normalize().distanceTo(target.sub(shot.mesh.position).normalize()) < 1e-8);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.health, 100, 'moving sideways during the charge dodges the shot');
  g.updateEnemies(0.1);
  assert.equal(e.rangedWindup, 0, 'the cannon cannot immediately fire again');
  g.clearEnemyProjectiles();
  g.camera.position.x = 0;
  e.rangedAim = g.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
  g.fireCannon(e);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.health, 72, 'an undodged cannon shot deals direct damage');
  const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
  wall.position.set(0, 1.5, -6);
  wall.scale.set(8, 4, 0.2);
  g.scene.add(wall);
  g.scene.updateMatrixWorld(true);
  g.walls = [wall];
  e.rangedCooldown = 0;
  assert.equal(g.updateRangedEnemy(e, 0.01, 12), false);
  e.dead = true;
  e.rangedAim = g.camera.position.clone();
  g.fireCannon(e);
  assert.equal(g.enemyProjectiles.length, 0);

  // Husk range boundary: minimum 4m (at 3.5m false, at 4.5m true)
  g.walls = [];
  const aliveHusk = spawnAt(g, 6, 0, -4.5);
  aliveHusk.rangedCooldown = 0;
  assert.equal(g.updateRangedEnemy(aliveHusk, 0.01, 3.5), false, 'Husk does not shoot below 4m');
  assert.equal(g.updateRangedEnemy(aliveHusk, 0.01, 4.5), true, 'Husk shoots at 4m and above');

  // Bloat range boundary: minimum 3m (at 2.5m false, at 3.5m true)
  const aliveBloat = spawnAt(g, 4, 0, -3.5);
  aliveBloat.rangedCooldown = 0;
  assert.equal(g.updateRangedEnemy(aliveBloat, 0.01, 2.5), false, 'Bloat does not shoot below 3m');
  assert.equal(g.updateRangedEnemy(aliveBloat, 0.01, 3.5), true, 'Bloat shoots at 3m and above');
});

test('Scrake chainsaws and Freshpound drills keep their reach and damage, respect cover and animate attacks', (t) => {
  for (const kind of [2, 3]) {
    const g = fixture(t);
    const reach = kind === 2 ? 4.2 : 3.0;
    const e = spawnAt(g, kind, 0, -(reach - 0.1));
    assert.equal(e.damage, kind === 2 ? 30 : 42);
    e.attack = 0;
    const sounds = [];
    g.sound = (...args) => sounds.push(args);
    g.updateEnemies(0.01);
    assert.ok(e.meleeSwing > 0);
    assert.equal(g.state.health, 100 - e.damage);
    assert.equal(sounds.length, 1);
    const armAngle = e.arms[1].rotation.x;
    g.updateEnemies(0.15);
    assert.notEqual(e.arms[1].rotation.x, armAngle);
    assert.equal(g.state.health, 100 - e.damage);
    assert.equal(sounds.length, 1);
    if (kind === 2) {
      assert.equal(e.sawChain.children.filter((phase) => phase.visible).length, 1);
      assert.ok(e.arms[1].rotation.x < -2, 'Scrake visibly raises the saw overhead');
      const raisedSide = e.arms[1].rotation.z;
      g.updateEnemies(0.3);
      assert.ok(e.arms[1].rotation.z < raisedSide, 'the saw sweeps across the body');
      assert.ok(e.torso.rotation.y < 0, 'the torso follows the sweeping motion');
      g.updateEnemies(0.3);
      assert.equal(e.meleeSwing, 0);
      assert.equal(Math.abs(e.torso.rotation.y), 0, 'the stance resets after the swing');
      assert.equal(g.state.health, 100 - e.damage, 'the animation does not add extra hits');
    }
    else {
      assert.equal(e.chainsaw, undefined);
      assert.notEqual(e.drillBit.rotation.y, 0);
    }
    e.attack = 0;
    e.root.position.z = -(reach + 0.1);
    g.updateEnemies(0.01);
    assert.equal(g.state.health, 100 - e.damage, 'outside the extended reach');
    e.root.position.z = -(reach - 0.1);
    const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
    wall.position.set(0, 1.5, -1);
    wall.scale.set(4, 4, 0.2);
    g.scene.add(wall);
    g.scene.updateMatrixWorld(true);
    g.walls = [wall];
    g.updateEnemies(0.01);
    assert.equal(g.state.health, 100 - e.damage, 'melee weapons cannot hit through cover');
  }
});

test('Gorefast uses its blade during melee without repeatedly damaging the player during a swing', (t) => {
  const g = fixture(t), e = spawnAt(g, 1, 0, -1);
  e.attack = 0;
  g.updateEnemies(0.01);
  assert.equal(g.state.health, 90);
  assert.ok(e.meleeSwing > 0);
  const angle = e.arms[1].rotation.x;
  g.updateEnemies(0.15);
  assert.notEqual(e.arms[1].rotation.x, angle);
  assert.equal(g.state.health, 90);
});

test('Freshpound warns, pauses its rage timer, charges fast in a locked direction and can rage again', (t) => {
  const g = fixture(t), e = spawnAt(g, 3, 0, -14);
  const other = spawnAt(g, 3, 12, -14);
  assert.equal(e.rageTime, 10);
  e.rageTime = 0.01;
  g.updateEnemies(0.01);
  assert.equal(e.ragePhase, 'windup');
  assert.equal(e.root.position.z, -14);
  assert.equal(e.rageIndicator.visible, true);
  assert.equal(other.rageIndicator.visible, false);
  g.updateEnemies(0.5);
  g.state.mode = 'paused';
  const time = e.rageTime, rotation = e.drillBit.rotation.y;
  g.updateEnemies(0.5);
  assert.equal(e.rageTime, time);
  assert.equal(e.drillBit.rotation.y, rotation);
  g.state.mode = 'playing';
  g.updateEnemies(0.5);
  assert.equal(e.ragePhase, 'charging');
  g.camera.position.x = 4;
  g.updateEnemies(0.1);
  assert.ok(Math.abs(e.root.position.z + 14 - e.speed * 0.1 * 10) < 1e-8);
  assert.equal(e.root.position.x, 0, 'the charge does not home in after a sideways dodge');
  for (let i = 0; i < 65 && e.ragePhase === 'charging'; i++) g.updateEnemies(0.05);
  assert.equal(e.ragePhase, 'calm');
  assert.equal(e.rageTime, 10);
  assert.equal(e.rageIndicator.visible, false);
  assert.equal(g.state.health, 100);
  e.rageTime = 0.01;
  g.updateEnemies(0.01);
  assert.equal(e.ragePhase, 'windup');
  e.dead = true;
  const position = e.root.position.clone();
  g.updateEnemies(0.5);
  assert.deepEqual(e.root.position.toArray(), position.toArray(), 'dead enemies cannot continue charging');
});

test('Freshpound charge stops at cover or deals one drill hit on contact', (t) => {
  for (const cover of [true, false]) {
    const g = fixture(t), e = spawnAt(g, 3, 0, -4);
    e.ragePhase = 'charging';
    e.rageTime = 3;
    e.chargeDirection.set(0, 0, 1);
    if (cover) {
      const wall = new T.Mesh(g.graphics.box, g.graphics.material(new T.MeshBasicMaterial()));
      wall.position.set(0, 1.5, -2.5);
      wall.scale.set(8, 4, 0.2);
      g.scene.add(wall);
      g.scene.updateMatrixWorld(true);
      g.walls = [wall];
      g.obstacles = [new T.Box3().setFromObject(wall)];
    }
    for (let i = 0; i < 20 && e.ragePhase === 'charging'; i++) g.updateEnemies(0.05);
    assert.equal(e.ragePhase, 'calm');
    assert.equal(g.state.health, cover ? 100 : 58);
    if (cover) assert.ok(e.root.position.z < -3.1, 'a fast charge cannot skip a thin wall');
    else {
      assert.ok(e.meleeSwing > 0);
      g.updateEnemies(0.1);
      assert.equal(g.state.health, 58, 'contact ends the charge and respects melee cooldown');
    }
  }
});

test('Freshpound charges through other enemies by knocking them aside and reaches player even while jumping', (t) => {
  const g = fixture(t);
  const fp = spawnAt(g, 3, 0, -6);
  const clot = spawnAt(g, 0, 0, -3);
  fp.ragePhase = 'charging';
  fp.rageTime = 3;
  fp.chargeDirection.set(0, 0, 1);
  g.feet = 1.2;

  g.updateEnemies(0.1);
  assert.ok(Math.hypot(clot.root.position.x, clot.root.position.z - (-3)) > 0.3, 'clot must be knocked aside');
  assert.equal(fp.ragePhase, 'charging', 'Freshpound must not stop upon hitting another enemy');

  for (let i = 0; i < 20 && fp.ragePhase === 'charging'; i++) g.updateEnemies(0.05);
  assert.equal(fp.ragePhase, 'calm', 'charge must stop when hitting the player');
  assert.equal(g.state.health, 58, 'hits player even while jumping');
});

test('enemy melee and projectile attacks are 100% absorbed by body armor until depleted', (t) => {
  const g = fixture(t);
  g.state.armor = 50;
  g.state.health = 100;

  // Gorefast melee attack (10 damage): absorbs 10, health remains 100
  const gorefast = spawnAt(g, 1, 0, -1);
  gorefast.attack = 0;
  g.updateEnemies(0.01);
  assert.equal(g.state.armor, 40, 'armor absorbs 100% of the 10 melee damage');
  assert.equal(g.state.health, 100, 'health is untouched when armor is available');

  // Freshpound drill attack (42 damage) with 40 armor: 40 absorbed, 2 penetrates
  g.enemies = [];
  const fp = spawnAt(g, 3, 0, -2);
  fp.attack = 0;
  g.updateEnemies(0.01);
  assert.equal(g.state.armor, 0, 'armor is depleted');
  assert.equal(g.state.health, 98, 'remaining 2 damage reduces health');

  // Husk cannon projectile (28 damage) with 20 armor: 20 absorbed, 8 penetrates
  g.state.armor = 20;
  g.state.health = 98;
  g.clearEnemyProjectiles();
  g.camera.position.x = 0;
  const husk = spawnAt(g, 6, 0, -6);
  husk.rangedAim = g.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
  g.fireCannon(husk);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.armor, 0, 'armor is depleted by projectile');
  assert.equal(g.state.health, 90, 'remaining 8 damage reduces health');

  // Lethal boundary test: 1 armor point and 27 health against Husk cannon (28 damage) -> survives with 0 HP (lethal)
  g.state.armor = 1;
  g.state.health = 27;
  g.clearEnemyProjectiles();
  husk.rangedAim = g.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
  g.fireCannon(husk);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 0);
  assert.equal(g.state.mode, 'dead');

  // Survival boundary test: 1 armor point and 28 health against Husk cannon (28 damage) -> survives with 1 HP
  g.state.mode = 'playing';
  g.state.armor = 1;
  g.state.health = 28;
  g.clearEnemyProjectiles();
  husk.rangedAim = g.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
  g.fireCannon(husk);
  g.updateEnemyProjectiles(0.5);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 1);
  assert.equal(g.state.mode, 'playing');
});


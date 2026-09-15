import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game, GRENADE } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';

function fixture(t) {
  const graphics = new Graphics();
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    graphics, scene: new T.Scene(), camera: new T.PerspectiveCamera(76, 1, 0.06, 150),
    ray: new T.Raycaster(), walls: [], enemies: [], thrownGrenades: [], rockets: [], enemyProjectiles: [],
    difficultyMode: 'normal',
    state: { mode: 'playing', grenades: 3, maxGrenades: 3, wave: 1, cash: 0, health: 100,
      armor: 100, maxArmor: 100,
      owned: [true, true, true, true], katana: false },
    grenadeTime: 0, grenadeThrowTime: 0, meleeTime: 0, reloadTime: 0,
    cooldown: 0, sniperBoltTime: 0, weaponIndex: 2, aiming: true, pitch: 0, yaw: 0,
    ammo: [15, 30, 10, 1], reserve: [45, 120, 30, 10], keys: new Set(),
    hits: [], blasts: [], sound() {}, emit() {}, message() {}, explosionSound() {},
    damageEnemy(enemy, amount) { this.hits.push({ enemy, amount }); },
    burst(point) { this.blasts.push(point.clone()); },
  });
  g.camera.position.set(0, 1.7, 0);
  g.scene.add(g.camera);
  t.after(() => graphics.dispose());
  return g;
}

function wall(g, z, height = 10) {
  const mesh = new T.Mesh(g.graphics.box, g.graphics.surface('concrete', 0x888888));
  mesh.position.set(0, height / 2, z);
  mesh.scale.set(8, height, 0.04);
  g.walls.push(mesh);
  g.scene.add(mesh);
  g.scene.updateMatrixWorld(true);
}

test('G visibly winds up, releases one grenade, and restores gun actions after the throw', (t) => {
  const g = fixture(t);
  assert.equal(g.isScoped(), true);
  g.handleKeyDown({ code: 'KeyG' });
  assert.equal(g.state.grenades, 2);
  assert.equal(g.grenadeHand.visible, true);
  assert.equal(g.heldGrenade.visible, true);
  assert.equal(g.isScoped(), false);
  assert.equal(g.thrownGrenades.length, 0);
  assert.equal(g.blasts.length, 0, 'pressing G must not explode or damage anything');
  const handStart = g.grenadeHand.position.clone();
  g.shoot();
  g.melee();
  g.equipWeapon(0);
  g.grenade();
  assert.equal(g.state.grenades, 2);
  assert.equal(g.ammo[2], 10);
  assert.equal(g.weaponIndex, 2);
  assert.equal(g.meleeTime, 0);
  g.updateGrenades(0.12);
  assert.ok(g.grenadeHand.position.distanceTo(handStart) > 0.05);
  assert.equal(g.thrownGrenades.length, 0);
  g.updateGrenades(0.12);
  const p = g.thrownGrenades[0];
  assert.ok(p.mesh.parent === g.scene && p.mesh.children.length > 0);
  assert.equal(g.heldGrenade.visible, false);
  assert.ok(p.velocity.y > 0 && p.velocity.z < 0);
  const releasePosition = p.mesh.position.clone();
  g.updateGrenades(0.4);
  assert.equal(g.thrownGrenades.length, 1);
  assert.ok(p.mesh.position.z < releasePosition.z - 3);
  assert.ok(p.velocity.y < 0, 'gravity bends the trajectory downward');
  assert.equal(g.grenadeHand.visible, false);
  assert.equal(g.isScoped(), true, 'held right click resumes the scope');
  assert.equal(g.blasts.length, 0);
});

test('grenade bounces off thin cover and the floor, then explodes at its actual position', (t) => {
  const g = fixture(t);
  wall(g, -2);
  g.grenade();
  g.updateGrenades(0.55);
  const p = g.thrownGrenades[0];
  assert.ok(p.velocity.z > 0, 'wall reverses the throw');
  assert.ok(p.mesh.position.z > -1.82, 'thin cover cannot be skipped');
  let bounced = false;
  for (let i = 0; i < 38; i++) {
    const vy = p.velocity.y;
    g.updateGrenades(1 / 60);
    if (vy < 0 && p.velocity.y > 0) bounced = true;
    assert.ok(p.mesh.position.y >= 0.18);
  }
  assert.equal(bounced, true);
  assert.equal(g.blasts.length, 0);
  g.updateGrenades(0.3);
  assert.equal(g.thrownGrenades.length, 0);
  assert.equal(p.mesh.parent, null);
  assert.equal(g.blasts.length, 1);
  assert.ok(g.blasts[0].distanceTo(p.mesh.position) < 1e-8);
  g.updateGrenades(2);
  assert.equal(g.blasts.length, 1, 'a grenade detonates only once');
});

test('release beside a wall keeps the grenade on the player side of cover', (t) => {
  const g = fixture(t);
  wall(g, -0.5);
  g.grenade();
  g.updateGrenades(0.36);
  const p = g.thrownGrenades[0];
  assert.ok(p.mesh.position.z > -0.32);
  assert.ok(p.velocity.z > 0);
});

test('pause freezes both windup and the airborne fuse; leaving combat removes both', (t) => {
  const g = fixture(t);
  g.grenade();
  g.updateGrenades(0.12);
  const throwTime = g.grenadeThrowTime;
  g.state.mode = 'paused';
  g.updateGrenades(5);
  assert.equal(g.grenadeThrowTime, throwTime);
  assert.equal(g.thrownGrenades.length, 0);
  g.state.mode = 'playing';
  g.updateGrenades(0.12);
  const p = g.thrownGrenades[0];
  const position = p.mesh.position.clone(), fuse = p.fuse;
  g.state.mode = 'paused';
  g.updateGrenades(5);
  assert.deepEqual(p.mesh.position, position);
  assert.equal(p.fuse, fuse);
  g.finish('cleared');
  assert.equal(g.thrownGrenades.length, 0);
  assert.equal(p.mesh.parent, null);
  assert.equal(g.grenadeHand.visible, false);
  assert.equal(g.grenadeThrowTime, 0);
  g.state.mode = 'playing';
  g.updateGrenades(5);
  assert.equal(g.blasts.length, 0);
  g.state.mode = 'shop';
  g.grenade();
  assert.equal(g.state.grenades, 2, 'G outside combat cannot consume stock');
});

test('delayed explosion preserves distance falloff and cover occlusion', (t) => {
  const g = fixture(t);
  wall(g, -2);
  const enemy = () => ({ root: new T.Group(), dead: false });
  const near = enemy(), covered = enemy(), far = enemy();
  near.root.position.z = -1;
  covered.root.position.z = -3;
  far.root.position.x = 8;
  g.enemies.push(near, covered, far);
  g.explodeGrenade(new T.Vector3(0, 1, 0));
  assert.equal(g.hits.length, 1);
  assert.equal(g.hits[0].enemy, near);
  assert.ok(Math.abs(g.hits[0].amount - 300 * (1 - 1 / 9)) < 1e-8);
});

test('grenade self-damage applies within 7m with distance falloff, respects armor absorption, and stops at cover', (t) => {
  const g = fixture(t);
  g.camera.position.set(0, 1.7, 0);

  // 1. Direct hit at player position (distance = 0): maximum 75 self-damage, fully absorbed by 100 armor
  g.state.armor = 100;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, 0));
  assert.equal(g.state.armor, 25, '100 armor absorbs all 75 self-damage');
  assert.equal(g.state.health, 100, 'health untouched when armor absorbs full damage');

  // 2. Partial armor absorption: 20 armor absorbs 20, remaining 55 damages health
  g.state.armor = 20;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, 0));
  assert.equal(g.state.armor, 0, 'armor depleted to 0');
  assert.equal(g.state.health, 45, 'remaining 55 damage hits HP (100 - 55 = 45)');

  // 3. Zero armor: full 75 damage reduces health
  g.state.armor = 0;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, 0));
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 25, '75 damage dealt directly to health');

  // 4. Distance falloff: at 3.5m, damage is Math.round(75 * (1 - 3.5 / 7)) = 38
  g.state.armor = 100;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, -3.5));
  assert.equal(g.state.armor, 62, '38 damage absorbed at 3.5m distance');
  assert.equal(g.state.health, 100);

  // 5. Outside 7m radius (e.g. 7.5m): zero damage
  g.state.armor = 100;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, -7.5));
  assert.equal(g.state.armor, 100, 'no damage beyond 7m radius');
  assert.equal(g.state.health, 100);

  // 6. Occlusion by wall: blast at (0, 1.7, -3), wall at z = -1.5 between camera and blast
  wall(g, -1.5);
  g.state.armor = 100;
  g.state.health = 100;
  g.explodeGrenade(new T.Vector3(0, 1.7, -3));
  assert.equal(g.state.armor, 100, 'cover blocks blast wave completely');
  assert.equal(g.state.health, 100);

  // 7. Lethal self-damage kills player (0 armor, 30 HP, 75 damage -> health 0, mode 'dead')
  g.walls = [];
  g.state.mode = 'playing';
  g.state.armor = 0;
  g.state.health = 30;
  g.explodeGrenade(new T.Vector3(0, 1.7, 0));
  assert.equal(g.state.health, 0);
  assert.equal(g.state.mode, 'dead', 'lethal grenade self-damage triggers death');
});

test('grenade fuse is configured to 1.0s and explodes 1.0s after release', (t) => {
  assert.equal(GRENADE.fuse, 1.0);
  const g = fixture(t);
  g.grenade();
  // Release occurs around 0.20s; advance 0.23s to complete release
  g.updateGrenades(0.23);
  assert.equal(g.thrownGrenades.length, 1);
  const p = g.thrownGrenades[0];
  // Since release occurred at ~0.20s, roughly 0.03s of fuse elapsed
  assert.ok(p.fuse > 0.95 && p.fuse < 1.0);
  assert.equal(g.blasts.length, 0);

  // Advance by remaining fuse - 0.05s (still airborne, not exploded)
  const remaining = p.fuse;
  g.updateGrenades(remaining - 0.05);
  assert.equal(g.thrownGrenades.length, 1);
  assert.equal(g.blasts.length, 0);

  // Advance past fuse expiration (grenade explodes)
  g.updateGrenades(0.1);
  assert.equal(g.thrownGrenades.length, 0);
  assert.equal(g.blasts.length, 1);
});

test('grenade 1.0s fuse detonates consistently across 30, 60, and 144 FPS frame steps', (t) => {
  for (const fps of [30, 60, 144]) {
    const g = fixture(t);
    g.grenade();
    const dt = 1 / fps;
    let totalTime = 0;

    // Advance until released
    while (g.thrownGrenades.length === 0) {
      g.updateGrenades(dt);
      totalTime += dt;
    }

    const releaseTime = totalTime;
    // Step until explosion
    while (g.blasts.length === 0) {
      g.updateGrenades(dt);
      totalTime += dt;
    }

    const airborneDuration = totalTime - releaseTime;
    // Airborne duration must be within 1 frame delta of the 1.0s fuse
    assert.ok(
      Math.abs(airborneDuration - 1.0) <= dt + 1e-4,
      `At ${fps} FPS, airborne duration ${airborneDuration} deviated beyond frame step ${dt}`,
    );
  }
});

test('grenade capacity is 3 in both difficulties, restricting throws when empty', (t) => {
  const g = fixture(t);
  assert.equal(g.getMaxGrenades(), 3);
  assert.equal(g.state.grenades, 3);

  // Normal mode: throw all 3 grenades
  g.grenade();
  assert.equal(g.state.grenades, 2);
  g.grenadeTime = 0; g.grenadeThrowTime = 0;
  g.grenade();
  assert.equal(g.state.grenades, 1);
  g.grenadeTime = 0; g.grenadeThrowTime = 0;
  g.grenade();
  assert.equal(g.state.grenades, 0);
  g.grenadeTime = 0; g.grenadeThrowTime = 0;

  // Cannot throw when 0
  g.grenade();
  assert.equal(g.state.grenades, 0);

  // Switch to Hard mode
  g.difficultyMode = 'hard';
  assert.equal(g.getMaxGrenades(), 3);

  // Shop resupply caps at 3 in Hard mode
  g.state.mode = 'shop';
  g.state.cash = 1000;
  for (let i = 0; i < 7; i++) {
    g.buy('grenade');
  }
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.cash, 850); // 3 * 50 spent

  // In Hard mode, can throw 3 grenades
  g.state.mode = 'playing';
  for (let i = 3; i > 0; i--) {
    assert.equal(g.state.grenades, i);
    g.grenade();
    assert.equal(g.state.grenades, i - 1);
    g.grenadeTime = 0;
    g.grenadeThrowTime = 0;
  }
  assert.equal(g.state.grenades, 0);
  g.grenade();
  assert.equal(g.state.grenades, 0);
});

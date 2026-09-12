import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game, RPG } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';
import { WeaponRecoil } from '../lib/recoil.ts';
import { registerGameTools } from '../lib/game-tools.ts';

function fixture(t) {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    graphics: new Graphics(), scene: new T.Scene(), camera: new T.PerspectiveCamera(76, 1, 0.06, 150),
    ray: new T.Raycaster(), gun: new T.Group(), katana: new T.Group(), flash: new T.Group(),
    flashLight: new T.PointLight(), keys: new Set(),
    state: { mode: 'shop', wave: 1, health: 100, armor: 100, cash: 10000, kills: 0, remaining: 10,
      owned: [true, false, false, false], katana: false, g18c: false, pouch: false, level: 0,
      grenades: 3, medicalKits: 3, healCooldown: 0 },
    ammo: [12, 30, 5, 1], reserve: [48, 120, 18, 7], weaponIndex: 0,
    viewRecoil: new WeaponRecoil(), recoil: 0, pitch: 0, yaw: 0,
    cooldown: 0, reloadTime: 0, sniperBoltTime: 0, meleeTime: 0, grenadeThrowTime: 0,
    aiming: false, difficultyMode: 'normal', difficulty: 1,
    rockets: [], enemies: [], corpses: [], particles: [], walls: [], obstacles: [],
    thrownGrenades: [], enemyProjectiles: [], blasts: [], shots: [],
    burst(point, color) { if (color === 0xffa347) this.blasts.push(point.clone()); },
    explosionSound() {}, gunshot(index) { this.shots.push(index); }, sound() {}, hurtSound() {},
    reloadStart() {}, reloadComplete() {}, initAudio() {}, lock() {}, waveAlertSound() {},
    headshots: 0, headshotSound() { this.headshots++; },
    messages: [], message(msg) { this.messages.push(msg); },
    emit() {},
  });
  g.camera.position.set(0, 1, 0);
  g.scene.add(g.camera);
  t.after(() => { g.clearRockets(); g.graphics.dispose(); });
  return g;
}
function enemy(g, x, z, hp = 10000, hitZone = 'torso') {
  const root = new T.Group();
  root.position.set(x, 0, z);
  const part = new T.Mesh(g.graphics.box, g.graphics.surface('skin', 0x777777));
  part.position.y = 1;
  part.scale.set(0.5, 1, 0.1);
  root.add(part);
  g.scene.add(root);
  const e = { root, parts: [part], dead: false, hp, kind: 0, shadow: new T.Group() };
  part.userData.enemy = e;
  if (hitZone) part.userData.hitZone = hitZone;
  g.enemies.push(e);
  return e;
}
function wall(g, z) {
  const mesh = new T.Mesh(g.graphics.box, g.graphics.surface('concrete', 0x888888));
  mesh.position.set(0, 2, z);
  mesh.scale.set(20, 4, 0.01);
  g.scene.add(mesh);
  g.walls.push(mesh);
}
function equip(g) {
  g.buy('rpg');
  g.state.mode = 'playing';
}

test('RPG purchase costs 4000 once, requires the shop, equips model 5 and enables Digit4', (t) => {
  const g = fixture(t);
  g.state.mode = 'playing';
  g.handleKeyDown({ code: 'Digit4' });
  assert.equal(g.weaponIndex, 0);
  g.buy('rpg');
  assert.equal(g.state.cash, 10000);
  g.state.mode = 'shop';
  g.state.cash = 3999;
  g.buy('rpg');
  assert.equal(g.state.cash, 3999);
  assert.equal(g.state.owned[3], false);
  g.state.cash = 10000;
  g.buy('rpg');
  assert.equal(g.state.cash, 6000);
  assert.equal(g.state.owned[3], true);
  assert.equal(g.weaponIndex, 3);
  assert.ok(g.gun.getObjectByName('rpg-launcher'));
  assert.equal(g.gun.getObjectByName('blade'), undefined);
  assert.equal(g.gun.getObjectByName('scope'), undefined);
  assert.equal(g.gunBoltHand, undefined);
  g.buy('rpg');
  assert.equal(g.state.cash, 6000);
  g.state.mode = 'playing';
  g.equipWeapon(0);
  g.handleKeyDown({ code: 'Digit4' });
  assert.equal(g.weaponIndex, 3);
  assert.equal(g.ammo[3], 1);
  assert.equal(g.reserve[3], 7);
  g.aiming = true;
  assert.equal(g.isScoped(), false);
  assert.equal(g.isCyclingBolt(), false);
});

test('one shot launches one rocket along pre-recoil aim; a 2.4 second reload consumes one reserve', (t) => {
  const g = fixture(t);
  equip(g);
  g.shoot();
  assert.equal(g.ammo[3], 0);
  assert.equal(g.cooldown, 0.9);
  assert.equal(g.reserve[3], 7);
  assert.equal(g.sniperBoltTime, 0);
  assert.equal(g.rockets.length, 1);
  assert.deepEqual(g.shots, [3]);
  assert.equal(g.rockets[0].velocity.length(), 60);
  assert.equal(g.rockets[0].velocity.y, 0);
  assert.ok(g.pitch > 0);
  const kicked = [g.pitch, g.yaw];
  g.viewRecoil.update(5);
  assert.deepEqual([g.pitch, g.yaw], kicked, 'aim does not recover automatically');
  assert.equal(g.reloadTime, 2.4, 'RPG automatically starts reloading immediately upon firing');
  g.shoot();
  assert.equal(g.rockets.length, 1, 'cooldown and reload block a second launch');
  g.reload();
  assert.equal(g.reloadTime, 2.4);
  g.updateReload(2.39);
  assert.equal(g.ammo[3], 0);
  g.state.mode = 'paused';
  g.updateReload(3);
  assert.equal(g.ammo[3], 0);
  g.state.mode = 'playing';
  g.updateReload(0.02);
  assert.equal(g.ammo[3], 1);
  assert.equal(g.reserve[3], 6);
  g.updateReload(4);
  assert.equal(g.reserve[3], 6, 'reload completes once');
  assert.equal(g.rockets.length, 1, 'reload does not automatically fire another rocket');
});

test('swept rockets hit thin walls before enemies and explode exactly once, including muzzle-adjacent cover', (t) => {
  for (const z of [-0.02, -5]) {
    const g = fixture(t);
    wall(g, z);
    const covered = enemy(g, 0, z - 1);
    equip(g);
    g.shoot();
    const mesh = g.rockets[0].mesh;
    g.updateRockets(0.2); // Twelve metres in a single step.
    assert.equal(g.blasts.length, 1);
    assert.ok(Math.abs(g.blasts[0].z - (z + 0.015)) < 0.001);
    assert.equal(g.rockets.length, 0);
    assert.equal(mesh.parent, null);
    assert.equal(covered.hp, 10000, 'wall blocks damage on its far side');
    g.updateRockets(3);
    assert.equal(g.blasts.length, 1);
  }
});

test('enemy impacts at 30, 60 and 144 FPS cause only blast damage and stop the projectile', (t) => {
  for (const fps of [30, 60, 144]) {
    const g = fixture(t);
    const hit = enemy(g, 0, -5, 10000, 'torso');
    const beyondBlast = enemy(g, 0, -14, 10000, 'torso');
    equip(g);
    g.state.level = 2;
    g.shoot();
    assert.equal(hit.hp, 10000, 'launch itself must not apply hitscan damage');
    for (let i = 0; i < fps; i++) g.updateRockets(1 / fps);
    assert.equal(g.blasts.length, 1);
    const d = hit.root.position.clone().add(new T.Vector3(0, 1, 0)).distanceTo(g.blasts[0]);
    assert.ok(Math.abs(hit.hp - (10000 - 600 * (1 - d / 9))) < 1e-6);
    assert.equal(beyondBlast.hp, 10000, 'rocket cannot penetrate the target');
    assert.equal(g.rockets.length, 0);
  }
});

test('direct rocket impact to enemy head applies 3.0x headshot damage, sound and message while nearby enemies take normal blast damage', (t) => {
  const g = fixture(t);
  const headTarget = enemy(g, 0, -5, 10000, 'head');
  const nearbyBlastTarget = enemy(g, 2, -5, 10000, 'head');
  equip(g);
  g.shoot();
  g.updateRockets(0.1);
  assert.equal(g.blasts.length, 1);
  const dHead = headTarget.root.position.clone().add(new T.Vector3(0, 1, 0)).distanceTo(g.blasts[0]);
  const expectedHeadDamage = 600 * (1 - dHead / 9) * 3.0;
  assert.ok(Math.abs((10000 - headTarget.hp) - expectedHeadDamage) < 1e-6);
  const dNear = nearbyBlastTarget.root.position.clone().add(new T.Vector3(0, 1, 0)).distanceTo(g.blasts[0]);
  const expectedNearDamage = 600 * (1 - dNear / 9);
  assert.ok(Math.abs((10000 - nearbyBlastTarget.hp) - expectedNearDamage) < 1e-6);
  assert.equal(g.headshots, 1, 'headshot sound must be played');
  assert.ok(g.messages.includes('HEADSHOT'), 'HEADSHOT message must be shown');
  assert.equal(g.rockets.length, 0);
});

test('RPG shares grenade range, falloff and cover while doubling enemy damage', (t) => {
  for (const covered of [false, true]) {
    const g = fixture(t);
    const center = enemy(g, 0, 0), near = enemy(g, 0, -3), edge = enemy(g, 7, 0);
    if (covered) wall(g, -1.5);
    const targets = [center, near, edge];
    const point = new T.Vector3(0, 1, 0);
    g.explodeGrenade(point);
    const grenadeDamage = targets.map((e) => 10000 - e.hp);
    targets.forEach((e) => { e.hp = 10000; });
    g.explode(point, RPG.damage);
    targets.forEach((e, i) => assert.ok(Math.abs((10000 - e.hp) - grenadeDamage[i] * 2) < 1e-6));
    assert.equal(10000 - center.hp, 600);
    assert.equal(10000 - near.hp, covered ? 0 : 400);
    assert.equal(edge.hp, 10000, 'range excludes distance 7 and beyond');
  }
});

test('RPG self-damage matches grenades including falloff, armor, cover and lethal cleanup', (t) => {
  for (const [distance, armor, cover] of [[0, 0, false], [0, 20, false], [3.5, 100, false], [7, 100, false], [3, 100, true]]) {
    const g = fixture(t);
    if (cover) wall(g, -1.5);
    const point = new T.Vector3(0, 1, -Number(distance));
    g.state.armor = armor;
    g.explodeGrenade(point);
    const grenadeVitals = [g.state.health, g.state.armor];
    g.state.health = 100;
    g.state.armor = armor;
    g.explode(point, RPG.damage);
    assert.deepEqual([g.state.health, g.state.armor], grenadeVitals);
  }
  const g = fixture(t);
  equip(g);
  g.state.health = 10;
  g.state.armor = 0;
  wall(g, -0.2);
  g.launchRocket();
  g.launchRocket();
  g.updateRockets(0.1);
  assert.equal(g.state.mode, 'dead');
  assert.equal(g.rockets.length, 0);
  assert.equal(g.blasts.length, 1, 'death clears remaining rockets without secondary explosions');
});

test('rockets move straight, pause, expire at 120m and explode on the ground', (t) => {
  const g = fixture(t);
  equip(g);
  g.shoot();
  const rocket = g.rockets[0];
  g.updateRockets(0.5);
  assert.deepEqual(rocket.mesh.position.toArray(), [0, 1, -30]);
  g.state.mode = 'paused';
  g.updateRockets(10);
  assert.equal(rocket.life, 1.5);
  assert.equal(g.blasts.length, 0);
  g.state.mode = 'playing';
  g.updateRockets(5);
  assert.equal(g.blasts.length, 1);
  assert.deepEqual(g.blasts[0].toArray(), [0, 1, -120]);
  assert.equal(g.rockets.length, 0);
  g.camera.rotation.x = -Math.PI / 4;
  g.launchRocket();
  g.updateRockets(0.2);
  assert.equal(g.blasts.length, 2);
  assert.ok(Math.abs(g.blasts[1].y) < 0.02);
});

test('leaving combat removes rockets and retry, title and boss debug reset the fourth slot', (t) => {
  const g = fixture(t);
  for (const mode of ['cleared', 'shop', 'won', 'dead']) {
    g.state.mode = 'playing';
    g.launchRocket();
    const mesh = g.rockets[0].mesh;
    g.finish(mode);
    assert.equal(g.rockets.length, 0);
    assert.equal(mesh.parent, null);
  }
  for (const reset of [() => g.start('normal'), () => g.start('hard'), () => g.toMenu(), () => g.start('normal', { bossDebug: true })]) {
    g.state.owned[3] = true;
    g.ammo[3] = 0;
    g.reserve[3] = 2;
    g.launchRocket();
    const mesh = g.rockets[0].mesh;
    reset();
    assert.equal(mesh.parent, null);
    assert.equal(g.rockets.length, 0);
    assert.deepEqual(g.state.owned, [true, false, false, false]);
    assert.deepEqual(g.ammo, [12, 30, 5, 1]);
    assert.deepEqual(g.reserve, [48, 120, 18, 7]);
  }
  assert.equal(g.blasts.length, 0);
});

test('purchase tool accepts RPG and both resupply and Ammo Pouch include rockets', (t) => {
  const g = fixture(t), tools = new Map();
  const cleanup = registerGameTools(g, { registerTool(tool) { tools.set(tool.name, tool); } });
  t.after(cleanup);
  const buy = tools.get('purchase_survival_supply');
  assert.ok(buy.inputSchema.properties.item.enum.includes('rpg'));
  g.buy('pouch');
  assert.deepEqual(buy.execute({ item: 'rpg' }), { purchased: 'rpg', credits: 5000 });
  assert.equal(g.weaponIndex, 3);
  assert.equal(g.reserve[3], 11);
  assert.throws(() => buy.execute({ item: 'rpg' }), /already full \/ owned/);
  g.ammo[3] = 0;
  g.reserve[3] = 0;
  assert.equal(g.isAmmoFull(), false);
  buy.execute({ item: 'ammo' });
  assert.equal(g.ammo[3], 1);
  assert.equal(g.reserve[3], 11);
  assert.equal(g.isAmmoFull(), true);
  const other = fixture(t);
  other.buy('rpg');
  other.ammo[3] = 0;
  other.reserve[3] = 0;
  other.buy('pouch');
  assert.equal(other.ammo[3], 1);
  assert.equal(other.reserve[3], 11);
});

test('direct rocket headshot is not blocked by low cover obstructing torso center', (t) => {
  const g = fixture(t);
  // Enemy with head at y = 1.6, torso center at y = 1.0
  const root = new T.Group();
  root.position.set(0, 0, -5);
  const headPart = new T.Mesh(g.graphics.box, g.graphics.surface('skin', 0x777777));
  headPart.position.set(0, 1.6, 0);
  headPart.scale.set(0.4, 0.4, 0.4);
  headPart.userData.hitZone = 'head';
  const torsoPart = new T.Mesh(g.graphics.box, g.graphics.surface('skin', 0x777777));
  torsoPart.position.set(0, 1.0, 0);
  torsoPart.scale.set(0.6, 0.8, 0.4);
  root.add(headPart, torsoPart);
  g.scene.add(root);
  const e = { root, parts: [headPart, torsoPart], dead: false, hp: 10000, kind: 0, shadow: new T.Group() };
  headPart.userData.enemy = e;
  torsoPart.userData.enemy = e;
  g.enemies.push(e);

  // Half-cover wall covering the torso (y from 0 to 1.3 at z = -4.8)
  const coverWall = new T.Mesh(g.graphics.box, g.graphics.surface('concrete', 0x888888));
  coverWall.position.set(0, 0.65, -4.8);
  coverWall.scale.set(10, 1.3, 0.1);
  g.scene.add(coverWall);
  g.walls.push(coverWall);

  equip(g);
  g.camera.position.set(0, 1.6, 0); // Aim directly at the head above the half wall
  g.shoot();
  g.updateRockets(0.1);

  assert.equal(g.headshots, 1, 'headshot sound must trigger');
  assert.ok(g.messages.includes('HEADSHOT'), 'HEADSHOT banner displayed');
  assert.ok(e.hp < 10000, 'enemy behind half cover must still take direct headshot damage');
});

test('direct rocket impact penetrates protruding arm to register headshot within 0.65m offset', (t) => {
  const g = fixture(t);
  const root = new T.Group();
  root.position.set(0, 0, -5);
  // Arm outstretched 0.5m in front of head
  const arm = new T.Mesh(g.graphics.box, g.graphics.surface('skin', 0x777777));
  arm.position.set(0, 1.5, 0.5);
  arm.scale.set(0.3, 0.3, 0.3);
  const head = new T.Mesh(g.graphics.box, g.graphics.surface('skin', 0x777777));
  head.position.set(0, 1.5, 0);
  head.scale.set(0.4, 0.4, 0.4);
  head.userData.hitZone = 'head';
  root.add(arm, head);
  g.scene.add(root);
  const e = { root, parts: [arm, head], dead: false, hp: 10000, kind: 0, shadow: new T.Group() };
  arm.userData.enemy = e;
  head.userData.enemy = e;
  g.enemies.push(e);

  equip(g);
  g.camera.position.set(0, 1.5, 0);
  g.shoot();
  g.updateRockets(0.1);

  assert.equal(g.headshots, 1, 'headshot sound triggered through outstretched arm');
  assert.ok(g.messages.includes('HEADSHOT'));
  assert.ok(e.hp < 10000);
});

test('RPG explosion applies Hans stunned vulnerability multiplier exactly once', (t) => {
  const g = fixture(t);
  const hansEnemy = enemy(g, 0, -5, 10000, 'torso');
  hansEnemy.kind = 7; // HANS kind
  let multiplierCalled = 0;
  g.hans = {
    damageMultiplier() {
      multiplierCalled++;
      return 1.75;
    },
  };

  const point = new T.Vector3(0, 1, -5);
  g.explode(point, RPG.damage, null);

  // Expected damage: 600 * (1 - 0/9) * 1.75 = 1050
  const damageTaken = 10000 - hansEnemy.hp;
  assert.ok(Math.abs(damageTaken - (600 * 1.75)) < 1e-4, `Expected 1050 damage, got ${damageTaken}`);
  assert.equal(multiplierCalled, 1, 'damageMultiplier should be evaluated exactly once');
});

test('switching back to an empty RPG automatically begins reloading when reserve rockets exist', (t) => {
  const g = fixture(t);
  equip(g);
  g.shoot();
  assert.equal(g.ammo[3], 0);
  assert.equal(g.reserve[3], 7);
  assert.ok(g.reloadTime > 0);

  // Switch to pistol (weapon 0) mid-reload
  g.equipWeapon(0);
  assert.equal(g.weaponIndex, 0);
  assert.equal(g.reloadTime, 0);

  // Switch back to empty RPG (weapon 3)
  g.equipWeapon(3);
  assert.equal(g.weaponIndex, 3);
  assert.equal(g.ammo[3], 0);
  assert.ok(g.reloadTime > 0, 'equipping empty RPG must auto-start reload');
  assert.equal(g.reloadTime, 2.4);
});

test('RPG iron sight has compact front post and toneMapped: false green aiming dot centered for ADS', () => {
  const graphics = new Graphics();
  const launcher = graphics.createWeapon(5);
  const dot = launcher.getObjectByName('rpg-sight-dot');
  assert.ok(dot, 'launcher must have rpg-sight-dot');
  assert.equal(dot.position.x, 0, 'dot must be centered horizontally on x=0');
  assert.equal(dot.position.y, 0.120, 'dot must be centered at y=0.120 matching ADS offset');
  assert.equal(dot.material.toneMapped, false, 'dot material must have toneMapped: false for high visibility');
  assert.equal(dot.material.color.getHex(), 0x55ff55, 'dot must be bright green');
  graphics.dispose();
});


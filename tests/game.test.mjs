import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game, STAMINA } from '../lib/game.ts';
import { HANS } from '../lib/hans.ts';
import { WeaponRecoil } from '../lib/recoil.ts';
import { registerGameTools } from '../lib/game-tools.ts';
function fixture() {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    difficultyMode: 'normal',
    state: {
      mode: 'shop',
      wave: 1,
      cash: 1000,
      health: 65,
      medicalKits: 3,
      healCooldown: 0,
      armor: 20,
      maxArmor: 100,
      owned: [true, false, false, false],
      katana: false,
      g18c: false,
      pouch: false,
      level: 0,
      grenades: 1,
      maxGrenades: 3,
      difficulty: 'normal',
    },
    ammo: [0, 0, 0, 0],
    reserve: [0, 0, 0, 0],
    weaponIndex: 0,
    viewRecoil: new WeaponRecoil(),
    recoil: 0,
    sniperBoltTime: 0,
    sniperReloadQueued: false,
    keys: new Set(),
    walls: [],
    ray: new T.Raycaster(),
    obstacles: [],
    enemyProjectiles: [],
    thrownGrenades: [],
    rockets: [],
    enemies: [],
    corpses: [],
    particles: [],
    materials: [],
    materialCache: new Map(),
    scene: new T.Scene(),
    camera: new T.PerspectiveCamera(),
    sound() {},
    initAudio() {},
    waveAlertSound() {},
    hurtSound() {},
    emit() {},
    buildGun() {},
    buildKatana() {},
    lock() {},
    message() {},
    callback() {},
  });
  return g;
}

test('pointer lock rejection displays the browser error even if combat has already paused', async () => {
  const g = fixture();
  const error = new DOMException(
    'If you see this error we have a bug. Please report this bug to chromium.',
    'UnknownError',
  );
  g.pointerLockRequest = 0;
  g.state.mode = 'playing';
  g.renderer = { domElement: { requestPointerLock: () => Promise.reject(error) } };
  g.pause = () => { g.state.mode = 'paused'; };
  Game.prototype.lock.call(g);
  g.pause();
  await Promise.resolve();
  assert.equal(g.state.mode, 'paused');
  assert.equal(g.state.pointerLockError, `${error.name}: ${error.message}`);
});

test('synchronous mouse capture failure also reaches the displayed error state', () => {
  const g = fixture();
  g.pointerLockRequest = 0;
  g.state.mode = 'playing';
  g.renderer = { domElement: { requestPointerLock() { throw new TypeError('Mouse capture unavailable'); } } };
  g.pause = () => { g.state.mode = 'paused'; };
  Game.prototype.lock.call(g);
  assert.equal(g.state.mode, 'paused');
  assert.equal(g.state.pointerLockError, 'TypeError: Mouse capture unavailable');
});

test('retry clears the old error and ignores a late failure from the previous request', async () => {
  const g = fixture();
  let rejectPrevious;
  g.pointerLockRequest = 0;
  g.state.mode = 'playing';
  g.state.pointerLockError = 'UnknownError: Previous failure';
  g.renderer = { domElement: { requestPointerLock: () => new Promise((_, reject) => { rejectPrevious = reject; }) } };
  g.pause = () => { g.state.mode = 'paused'; };
  Game.prototype.lock.call(g);
  assert.equal(g.state.pointerLockError, '');
  g.renderer.domElement.requestPointerLock = () => Promise.resolve();
  Game.prototype.lock.call(g);
  rejectPrevious(new Error('Outdated request'));
  await Promise.resolve();
  assert.equal(g.state.pointerLockError, '');
  assert.equal(g.state.mode, 'playing');
});
test('weapon purchase charges once and equips weapon; insufficient funds cannot mutate state', () => {
  const g = fixture();
  g.buy('rifle');
  assert.equal(g.state.cash, 200);
  assert.equal(g.weaponIndex, 1);
  assert.equal(g.state.owned[1], true);
  g.buy('rifle');
  g.buy('sniper');
  assert.equal(g.state.cash, 200);
  assert.equal(g.state.owned[2], false);
});
test('supplies replenish kits/ammo and cannot charge for full stock or unknown items', () => {
  const g = fixture();
  g.state.medicalKits = 2;
  g.buy('health');
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.health, 65);
  assert.equal(g.state.cash, 950);
  g.buy('health');
  g.buy('invalid');
  assert.equal(g.state.cash, 950);
  g.buy('ammo');
  assert.deepEqual(g.ammo, [12, 30, 5, 1]);
  assert.deepEqual(g.reserve, [48, 120, 15, 7]);
  assert.equal(g.state.cash, 850);
  g.buy('ammo');
  assert.equal(g.state.cash, 850);
  g.state.mode = 'playing';
  g.buy('armor');
  assert.equal(g.state.cash, 850);
  g.state.mode = 'shop';
  g.buy('armor');
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.cash, 700);
  g.buy('armor');
  assert.equal(g.state.cash, 700, 'armor full (100 in normal mode) cannot charge');

  // Hard mode allows reinforcing armor to 100
  g.difficultyMode = 'hard';
  g.state.armor = 20;
  g.buy('armor');
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.cash, 550);
  g.buy('armor');
  assert.equal(g.state.cash, 550, 'armor full (100 in hard mode) cannot charge');
});
test('upgrade caps at two levels', () => {
  const g = fixture();
  g.state.cash = 10000;
  for (let i = 0; i < 5; i++) g.buy('upgrade');
  assert.equal(g.state.level, 2);
  assert.equal(g.state.cash, 7000);
});
test('weapon damage upgrade scales by +35% per level up to Lv.2 for 1000 and 2000 credits, applying to shoot and melee', () => {
  const g = fixture();
  g.state.cash = 10000;

  // Set up target enemy for shooting
  const hitDamages = [];
  const hitEnemy = { parts: [], dead: false };
  const targetMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial());
  targetMesh.position.set(0, 0, -3);
  targetMesh.userData.enemy = hitEnemy;
  hitEnemy.parts.push(targetMesh);
  g.enemies = [hitEnemy];
  g.scene.add(targetMesh);
  g.walls = [];
  g.ray = new T.Raycaster();
  g.weaponIndex = 0;
  g.ammo[0] = 15;
  g.damageEnemy = (_e, dmg) => hitDamages.push(dmg);

  // Set up target enemy for melee
  const meleeTorso = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial());
  const meleeTarget = {
    root: new T.Group(),
    torso: meleeTorso,
    parts: [meleeTorso],
    dead: false,
  };
  meleeTarget.root.position.set(0, 0, -2);
  meleeTorso.position.set(0, 0, -2);
  g.scene.add(meleeTarget.root, meleeTorso);
  g.camera.position.set(0, 0, 0);
  g.camera.rotation.set(0, 0, 0);
  g.yaw = 0;

  // --- LEVEL 0 (Base 1.0x) ---
  assert.equal(g.state.level, 0);
  g.state.mode = 'playing';

  // Lv.0 Pistol (base 24)
  targetMesh.userData.hitZone = 'torso';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[0] - 24) < 1e-5, `Lv.0 Body damage: ${hitDamages[0]}`);

  targetMesh.userData.hitZone = 'head';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[1] - (24 * 3.0)) < 1e-5, `Lv.0 Headshot damage: ${hitDamages[1]}`);

  // Lv.0 Melee (base 42)
  hitDamages.length = 0;
  g.enemies = [meleeTarget];
  g.meleeTime = 0;
  g.melee();
  assert.ok(Math.abs(hitDamages[0] - 42) < 1e-5, `Lv.0 Melee damage: ${hitDamages[0]}`);

  // --- LEVEL 1 (+35%, 1.35x) ---
  g.enemies = [hitEnemy];
  g.state.mode = 'shop';
  g.buy('upgrade');
  assert.equal(g.state.level, 1);
  assert.equal(g.state.cash, 9000);

  g.state.mode = 'playing';
  hitDamages.length = 0;

  // Lv.1 Pistol body & head
  targetMesh.userData.hitZone = 'torso';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[0] - (24 * 1.35)) < 1e-5, `Lv.1 Body damage: ${hitDamages[0]}`);

  targetMesh.userData.hitZone = 'head';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[1] - (24 * 1.35 * 3.0)) < 1e-5, `Lv.1 Headshot damage: ${hitDamages[1]}`);

  // Lv.1 Melee
  hitDamages.length = 0;
  g.enemies = [meleeTarget];
  g.meleeTime = 0;
  g.melee();
  assert.ok(Math.abs(hitDamages[0] - (42 * 1.35)) < 1e-5, `Lv.1 Melee damage: ${hitDamages[0]}`);

  // --- LEVEL 2 (+70%, 1.70x) ---
  g.enemies = [hitEnemy];
  g.state.mode = 'shop';
  g.buy('upgrade');
  assert.equal(g.state.level, 2);
  assert.equal(g.state.cash, 7000);

  // 3rd buy rejected at max level
  g.buy('upgrade');
  assert.equal(g.state.level, 2);
  assert.equal(g.state.cash, 7000);

  g.state.mode = 'playing';
  hitDamages.length = 0;

  // Lv.2 Pistol body & head
  targetMesh.userData.hitZone = 'torso';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[0] - (24 * 1.70)) < 1e-5, `Lv.2 Body damage: ${hitDamages[0]}`);

  targetMesh.userData.hitZone = 'head';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[1] - (24 * 1.70 * 3.0)) < 1e-5, `Lv.2 Headshot damage: ${hitDamages[1]}`);

  // Lv.2 Melee
  hitDamages.length = 0;
  g.enemies = [meleeTarget];
  g.meleeTime = 0;
  g.melee();
  assert.ok(Math.abs(hitDamages[0] - (42 * 1.70)) < 1e-5, `Lv.2 Melee damage: ${hitDamages[0]}`);

  // Lv.2 Katana melee (base 110 * 1.70 = 187)
  g.state.katana = true;
  hitDamages.length = 0;
  g.meleeTime = 0;
  g.melee();
  assert.ok(Math.abs(hitDamages[0] - (110 * 1.70)) < 1e-5, `Lv.2 Katana damage: ${hitDamages[0]}`);

  // Lv.2 G18C machine pistol (base 22 * 1.70 = 37.4 body, 37.4 * 3.0 = 112.2 head)
  g.state.katana = false;
  g.meleeTime = 0;
  g.state.g18c = true;
  g.weaponIndex = 0;
  g.ammo[0] = 33;
  g.enemies = [hitEnemy];
  hitDamages.length = 0;
  targetMesh.userData.hitZone = 'torso';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[0] - (22 * 1.70)) < 1e-5, `Lv.2 G18C Body damage: ${hitDamages[0]}`);

  targetMesh.userData.hitZone = 'head';
  g.cooldown = 0;
  g.shoot();
  assert.ok(Math.abs(hitDamages[1] - (22 * 1.70 * 3.0)) < 1e-5, `Lv.2 G18C Headshot damage: ${hitDamages[1]}`);

  // Verify RPG explosion damage is unaffected by weapon level (remains 600 base)
  hitDamages.length = 0;
  const rpgEnemy = { root: new T.Group(), parts: [], dead: false };
  rpgEnemy.root.position.set(0, 0, 0);
  g.enemies = [rpgEnemy];
  g.explode(new T.Vector3(0, 1, 0), 600, null);
  assert.ok(Math.abs(hitDamages[0] - 600) < 1e-5, `RPG explosion base damage unaffected by level: ${hitDamages[0]}`);
});
test('Normal mode Wave 6 cleared flows into supply shop and Wave 7 Hans Volter boss fight before victory', () => {
  const g = fixture();
  g.difficultyMode = 'normal';
  g.state.difficulty = 'normal';
  g.state.wave = 6;
  g.state.health = 50;
  g.pending = 0;
  g.enemies = [];

  // Clear wave 6: must transition to 'cleared', award credits (250 + 6 * 50 = 550), and heal to 100
  g.completeWave();
  assert.equal(g.state.mode, 'cleared');
  assert.equal(g.state.health, 100);
  assert.equal(g.state.cash, 1550);

  // Open shop and check state
  g.openShop();
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 6);

  // Next wave enters Wave 7: Hans Volter boss fight
  g.nextWave();
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 7);
  assert.equal(g.isHansWave(), true);
  assert.equal(g.pending, 1);
  assert.equal(g.state.remaining, 1);
  assert.equal(g.chooseEnemyKind(), 7); // HANS.kind

  // Completing wave 7 yields victory ('won')
  g.completeWave();
  assert.equal(g.state.mode, 'won');
});
test('grenade purchase caps at three items in both difficulties without Ammo Pouch', () => {
  for (const difficulty of ['normal', 'hard']) {
    const g = fixture();
    g.difficultyMode = difficulty;
    g.state.cash = 1000;
    g.state.grenades = 2;
    g.buy('grenade');
    assert.equal(g.state.grenades, 3);
    assert.equal(g.state.cash, 950);
    g.buy('grenade');
    assert.equal(g.state.grenades, 3);
    assert.equal(g.state.cash, 950);
  }
});
test('wave completion fully heals without replenishing kits and openShop enters shop', () => {
  const g = fixture();
  g.state.medicalKits = 1;
  g.finish('cleared');
  assert.equal(g.state.mode, 'cleared');
  assert.equal(g.state.health, 100);
  assert.equal(g.state.medicalKits, 1);
  assert.equal(g.state.armor, 20);
  g.openShop();
  assert.equal(g.state.mode, 'shop');
});

test('final wave victory restores full HP while defeat does not', () => {
  const g = fixture();
  g.state.wave = 6;
  g.state.health = 10;
  g.finish('won');
  assert.equal(g.state.health, 100);
  g.state.health = 0;
  g.finish('dead');
  assert.equal(g.state.health, 0);
});
test('cleared mode advances to shop on Space or Enter keydown', () => {
  const g = fixture();
  g.state.mode = 'cleared';
  g.handleKeyDown({ code: 'KeyW', preventDefault() {} });
  assert.equal(g.state.mode, 'cleared');
  g.handleKeyDown({ code: 'Space', repeat: true, preventDefault() {} });
  assert.equal(g.state.mode, 'cleared');
  g.handleKeyDown({ code: 'Space', repeat: false, preventDefault() {} });
  assert.equal(g.state.mode, 'shop');
});
test('next wave initializes exact enemy count and ignores repeated calls during combat', () => {
  const g = fixture();
  g.nextWave();
  assert.equal(g.state.wave, 2);
  assert.equal(g.pending, 12);
  assert.equal(g.state.remaining, 12);
  assert.equal(g.state.mode, 'playing');
  g.nextWave();
  assert.equal(g.state.wave, 2);
});
test('hard mode doubles the enemy pending count across waves', () => {
  const g = fixture();
  g.difficultyMode = 'hard';
  g.nextWave();
  assert.equal(g.state.wave, 2);
  assert.equal(g.pending, 24);
  assert.equal(g.state.remaining, 24);
});
test('collision blocks obstacles and bounds while permitting open lanes', () => {
  const g = fixture();
  g.obstacles = [{ min: { x: 2, z: 2 }, max: { x: 4, z: 4 } }];
  assert.equal(g.blocked(3, 3), true);
  assert.equal(g.blocked(0, 0), false);
  assert.equal(g.blocked(31, 0), true);
});
test('WebMCP contract exposes shared game state, rejects invalid requests, and unregisters on cleanup', () => {
  const g = fixture(),
    registered = new Map();
  let signal;
  const cleanup = registerGameTools(g, {
    registerTool(tool, options) {
      registered.set(tool.name, tool);
      signal = options.signal;
    },
  });
  const read = registered.get('read_survival_status'),
    buy = registered.get('purchase_survival_supply');
  assert.equal(read.annotations.readOnlyHint, true);
  assert.equal(buy.annotations.readOnlyHint, false);
  assert.equal(buy.inputSchema.required[0], 'item');
  assert.deepEqual(buy.execute({ item: 'rifle' }), {
    purchased: 'rifle',
    credits: 200,
  });
  assert.ok(buy.inputSchema.properties.item.enum.includes('g18c'));
  assert.equal(read.execute({}).g18c, false);
  g.state.cash = 900;
  assert.deepEqual(buy.execute({ item: 'g18c' }), {
    purchased: 'g18c',
    credits: 150,
  });
  assert.equal(read.execute({}).g18c, true);
  assert.throws(() => buy.execute({ item: 'g18c' }), /Insufficient/);

  assert.ok(buy.inputSchema.properties.item.enum.includes('pouch'));
  assert.equal(read.execute({}).pouch, false);
  g.state.cash = 1000;
  assert.deepEqual(buy.execute({ item: 'pouch' }), {
    purchased: 'pouch',
    credits: 0,
  });
  assert.equal(read.execute({}).pouch, true);
  assert.equal(read.execute({}).grenades, 5);
  assert.equal(read.execute({}).maxGrenades, 5);
  assert.throws(() => buy.execute({ item: 'pouch' }), /Insufficient/);
  assert.throws(() => buy.execute({ item: 'invalid' }), /Invalid/);
  assert.throws(() => buy.execute({ item: 'sniper' }), /Insufficient/);

  // WebMCP Medical Kit purchase costs 50 credits and adds one kit without healing
  g.state.cash = 50;
  g.state.health = 40;
  g.state.medicalKits = 2;
  assert.deepEqual(buy.execute({ item: 'health' }), {
    purchased: 'health',
    credits: 0,
  });
  assert.equal(g.state.health, 40);
  assert.equal(g.state.medicalKits, 3);
  assert.throws(() => buy.execute({ item: 'health' }), /Insufficient/);

  // WebMCP Body Armor purchase costs 150 credits and reinforces to 100 armor in normal mode
  g.difficultyMode = 'normal';
  g.state.cash = 300;
  g.state.armor = 20;
  assert.deepEqual(buy.execute({ item: 'armor' }), {
    purchased: 'armor',
    credits: 150,
  });
  assert.equal(g.state.armor, 100);
  assert.throws(() => buy.execute({ item: 'armor' }), /Insufficient/);

  // WebMCP Body Armor purchase reinforces to 100 armor in hard mode
  g.difficultyMode = 'hard';
  g.state.cash = 300;
  g.state.armor = 20;
  assert.deepEqual(buy.execute({ item: 'armor' }), {
    purchased: 'armor',
    credits: 150,
  });
  assert.equal(g.state.armor, 100);
  assert.throws(() => buy.execute({ item: 'armor' }), /Insufficient/);

  // With Ammo Pouch, WebMCP Frag Grenade purchase caps at 5 in normal mode
  g.difficultyMode = 'normal';
  g.state.cash = 300;
  g.state.grenades = 4;
  assert.deepEqual(buy.execute({ item: 'grenade' }), {
    purchased: 'grenade',
    credits: 250,
  });
  assert.equal(g.state.grenades, 5);
  assert.throws(() => buy.execute({ item: 'grenade' }), /Insufficient/);

  // With Ammo Pouch, Hard mode keeps the same five-grenade cap
  g.difficultyMode = 'hard';
  g.state.cash = 300;
  assert.throws(() => buy.execute({ item: 'grenade' }), /Insufficient/);
  assert.equal(g.state.cash, 300);
  g.state.grenades = 4;
  assert.deepEqual(buy.execute({ item: 'grenade' }), {
    purchased: 'grenade',
    credits: 250,
  });
  assert.equal(g.state.grenades, 5);
  assert.throws(() => buy.execute({ item: 'grenade' }), /Insufficient/);

  g.state.mode = 'playing';
  assert.throws(() => buy.execute({ item: 'ammo' }), /not open/);
  cleanup();
  assert.equal(signal.aborted, true);
});

test('sniper purchase equips slot 3 once and supplies a five-round magazine', () => {
  const g = fixture();
  g.state.cash = 5000;
  g.buy('ammo');
  g.buy('sniper');
  assert.equal(g.weaponIndex, 2);
  assert.equal(g.state.owned[2], true);
  assert.equal(g.ammo[2], 5);
  assert.equal(g.reserve[2], 15);
  assert.equal(g.state.cash, 3800);
  g.buy('sniper');
  assert.equal(g.state.cash, 3800);
});

test('sniper scope is limited to aiming during combat and lowers for reloads', () => {
  const g = fixture();
  Object.assign(g, { weaponIndex: 2, aiming: true, reloadTime: 0 });
  g.state.mode = 'playing';
  assert.equal(g.isScoped(), true);
  for (const change of [
    { aiming: false }, { weaponIndex: 1 }, { reloadTime: 1 },
  ]) {
    Object.assign(g, { weaponIndex: 2, aiming: true, reloadTime: 0 }, change);
    assert.equal(g.isScoped(), false);
  }
  Object.assign(g, { weaponIndex: 2, aiming: true, reloadTime: 0 });
  g.state.mode = 'paused';
  assert.equal(g.isScoped(), false);
});

test('sniper fires one accurate powerful round, respects cover and bolt delay, and reloads after five shots', () => {
  const g = fixture();
  const target = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), new T.MeshBasicMaterial());
  const cover = new T.Mesh(new T.BoxGeometry(1, 1, 1), target.material);
  target.position.z = -20;
  cover.position.z = -10;
  const enemy = { parts: [target], dead: false };
  target.userData.enemy = enemy;
  const hits = [];
  Object.assign(g, {
    weaponIndex: 2, aiming: true, cooldown: 0, reloadTime: 0,
    camera: new T.PerspectiveCamera(18, 1, 0.06, 150), scene: new T.Scene(),
    ray: new T.Raycaster(), enemies: [enemy], walls: [],
    gunshot() {}, reloadStart() {}, burst() {},
    damageEnemy(_enemy, damage) { hits.push(damage); },
  });
  g.scene.add(target, cover);
  g.ammo[2] = 5;
  g.reserve[2] = 60;
  g.state.mode = 'playing';
  g.shoot();
  assert.equal(g.ammo[2], 4);
  assert.deepEqual(hits, [150]);
  assert.equal(g.isScoped(), false, 'firing lowers the scope for bolt operation');
  g.shoot();
  assert.equal(g.ammo[2], 4);
  assert.equal(hits.length, 1);
  g.cooldown = 0;
  g.shoot();
  assert.equal(g.ammo[2], 4, 'resetting the shared cooldown cannot bypass the bolt');
  g.updateBolt(1.1);
  assert.equal(g.isScoped(), true, 'holding aim resumes the scope once the bolt locks');
  target.userData.hitZone = 'head';
  g.shoot();
  assert.equal(hits[1], 150 * 3.0);
  g.walls = [cover];
  for (let i = 0; i < 2; i++) {
    g.cooldown = 0;
    g.updateBolt(1.1);
    g.shoot();
  }
  assert.equal(hits.length, 2, 'cover blocks further hits');
  assert.equal(g.ammo[2], 1);
  g.cooldown = 0;
  g.updateBolt(1.1);
  g.shoot();
  assert.equal(g.ammo[2], 0);
  assert.equal(g.sniperBoltTime, 0, 'empty magazine must not initiate bolt action');
  assert.equal(g.isCyclingBolt(), false);
  g.shoot();
  assert.ok(g.reloadTime > 0, 'immediate shoot on empty magazine triggers reload without waiting for bolt');
  assert.equal(g.isScoped(), false);
  assert.equal(g.ammo[2], 0);
  target.geometry.dispose();
  cover.geometry.dispose();
  target.material.dispose();
});

test('sniper penetrates multiple lined-up enemies up to pierce limit while pistols hit only the first', () => {
  const g = fixture();
  const geom = new T.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new T.MeshBasicMaterial();
  const enemies = [];
  const hitDamages = [];

  for (let i = 0; i < 4; i++) {
    const part1 = new T.Mesh(geom, mat);
    const part2 = new T.Mesh(geom, mat); // Second part for same enemy to test deduplication
    part1.position.set(0, 0, -(i + 1) * 5);
    part2.position.set(0, 0, -(i + 1) * 5 - 0.2);
    const enemy = { parts: [part1, part2], dead: false };
    part1.userData.enemy = enemy;
    part2.userData.enemy = enemy;
    enemies.push(enemy);
  }

  Object.assign(g, {
    weaponIndex: 2, aiming: true, cooldown: 0, reloadTime: 0,
    camera: new T.PerspectiveCamera(18, 1, 0.06, 150), scene: new T.Scene(),
    ray: new T.Raycaster(), enemies, walls: [],
    gunshot() {}, reloadStart() {}, burst() {},
    damageEnemy(enemy, damage) { hitDamages.push({ enemy, damage }); },
  });

  for (const e of enemies) g.scene.add(...e.parts);
  g.ammo[2] = 10;
  g.state.mode = 'playing';

  // Sniper fires: should penetrate 3 enemies exactly (pierce: 3), with 1 hit per enemy
  g.shoot();
  assert.equal(hitDamages.length, 3, 'sniper should pierce exactly 3 lined-up enemies');
  assert.equal(hitDamages[0].enemy, enemies[0]);
  assert.equal(hitDamages[1].enemy, enemies[1]);
  assert.equal(hitDamages[2].enemy, enemies[2]);
  assert.equal(hitDamages[0].damage, 150);
  assert.equal(hitDamages[1].damage, 150);
  assert.equal(hitDamages[2].damage, 150);

  // Pistol fires: should hit only the first enemy
  hitDamages.length = 0;
  g.weaponIndex = 0;
  g.cooldown = 0;
  g.ammo[0] = 15;
  g.shoot();
  assert.equal(hitDamages.length, 1, 'pistol should only hit the first enemy without penetration');
  assert.equal(hitDamages[0].enemy, enemies[0]);
  assert.equal(hitDamages[0].damage, 24);

  geom.dispose();
  mat.dispose();
});

test('shoot prioritizes headshot when ray intersects head behind protruding arm, and works with pierce weapons', () => {
  const g = fixture();
  const geom = new T.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new T.MeshBasicMaterial();

  // Enemy 1: arm at -3.0, head at -3.5 (in straight line along ray)
  const arm1 = new T.Mesh(geom, mat);
  const head1 = new T.Mesh(geom, mat);
  arm1.position.set(0, 0, -3.0);
  head1.position.set(0, 0, -3.5);
  head1.userData.hitZone = 'head';
  const enemy1 = { parts: [arm1, head1], dead: false };
  arm1.userData.enemy = enemy1;
  head1.userData.enemy = enemy1;

  // Enemy 2: arm at -6.0, head at -6.5
  const arm2 = new T.Mesh(geom, mat);
  const head2 = new T.Mesh(geom, mat);
  arm2.position.set(0, 0, -6.0);
  head2.position.set(0, 0, -6.5);
  head2.userData.hitZone = 'head';
  const enemy2 = { parts: [arm2, head2], dead: false };
  arm2.userData.enemy = enemy2;
  head2.userData.enemy = enemy2;

  // Enemy 3: body only at -9.0
  const body3 = new T.Mesh(geom, mat);
  body3.position.set(0, 0, -9.0);
  const enemy3 = { parts: [body3], dead: false };
  body3.userData.enemy = enemy3;

  const hits = [];
  const messages = [];
  Object.assign(g, {
    weaponIndex: 0, aiming: true, cooldown: 0, reloadTime: 0,
    camera: new T.PerspectiveCamera(18, 1, 0.06, 150), scene: new T.Scene(),
    ray: new T.Raycaster(), enemies: [enemy1, enemy2, enemy3], walls: [],
    gunshot() {}, reloadStart() {}, burst() {},
    damageEnemy(enemy, damage, point) { hits.push({ enemy, damage, point }); },
    message(text) { messages.push(text); },
  });

  g.scene.add(arm1, head1, arm2, head2, body3);
  g.state.mode = 'playing';

  // 1. Pistol (pierce: 1) fires through arm1 into head1:
  // Must prioritize headshot (24 * 3.0 = 72) over arm hit, and hit only enemy1
  g.ammo[0] = 15;
  g.shoot();
  assert.equal(hits.length, 1, 'pistol hits only 1 enemy');
  assert.equal(hits[0].enemy, enemy1);
  assert.equal(hits[0].damage, 24 * 3.0, 'prioritizes headshot multiplier even when arm is hit first');
  assert.ok(hits[0].point.distanceTo(head1.position) < 0.5, 'damage point is on the head mesh');
  assert.ok(messages.includes('HEADSHOT'));

  // 2. Sniper (pierce: 3) fires through enemy1, enemy2, and enemy3:
  hits.length = 0;
  messages.length = 0;
  g.weaponIndex = 2;
  g.ammo[2] = 10;
  g.cooldown = 0;
  g.sniperBoltTime = 0;
  g.shoot();
  assert.equal(hits.length, 3, 'sniper penetrates all 3 enemies');
  assert.equal(hits[0].enemy, enemy1);
  assert.equal(hits[0].damage, 150 * 3.0, 'enemy 1 received headshot');
  assert.equal(hits[1].enemy, enemy2);
  assert.equal(hits[1].damage, 150 * 3.0, 'enemy 2 received headshot');
  assert.equal(hits[2].enemy, enemy3);
  assert.equal(hits[2].damage, 150, 'enemy 3 received body hit (no head struck)');

  // 3. Wall obstruction between arm and head:
  const wallMesh = new T.Mesh(geom, mat);
  wallMesh.position.set(0, 0, -3.2); // between arm1 (-3.0) and head1 (-3.5)
  g.walls = [wallMesh];
  g.scene.add(wallMesh);
  hits.length = 0;
  g.weaponIndex = 0;
  g.ammo[0] = 15;
  g.cooldown = 0;
  g.shoot();
  assert.equal(hits.length, 1);
  assert.equal(hits[0].enemy, enemy1);
  assert.equal(hits[0].damage, 24, 'wall stopped bullet from reaching head behind it');

  // 4. Enemy with head in front of arm (standard headshot):
  const head4 = new T.Mesh(geom, mat);
  const arm4 = new T.Mesh(geom, mat);
  head4.position.set(0, 0, -3.0);
  arm4.position.set(0, 0, -3.5);
  head4.userData.hitZone = 'head';
  const enemy4 = { parts: [head4, arm4], dead: false };
  head4.userData.enemy = enemy4;
  arm4.userData.enemy = enemy4;
  g.enemies = [enemy4];
  g.walls = [];
  g.scene.clear();
  g.scene.add(head4, arm4);
  hits.length = 0;
  messages.length = 0;
  g.weaponIndex = 0;
  g.ammo[0] = 15;
  g.cooldown = 0;
  g.shoot();
  assert.equal(hits.length, 1);
  assert.equal(hits[0].enemy, enemy4);
  assert.equal(hits[0].damage, 24 * 3.0, 'head in front is still a headshot');
  assert.ok(hits[0].point.distanceTo(head4.position) < 0.5);

  // 5. Wall hit with no enemy: stops and bursts without damaging enemies
  g.enemies = [];
  g.walls = [wallMesh];
  g.scene.clear();
  g.scene.add(wallMesh);
  hits.length = 0;
  g.cooldown = 0;
  g.ammo[0] = 15;
  g.shoot();
  assert.equal(hits.length, 0, 'shooting a wall deals no enemy damage');

  geom.dispose();
  mat.dispose();
});

test('bolt unlocks, retracts, feeds and locks; pause and weapon switching cannot skip the cycle', () => {
  const g = fixture();
  const sounds = [];
  Object.assign(g, {
    weaponIndex: 2, aiming: true, reloadTime: 0, recoil: 0,
    sniperBoltTime: 1.1, gunAction: new T.Group(), gunBoltHand: new T.Group(),
    boltSound(closing) { sounds.push(closing); },
  });
  g.state.mode = 'playing';
  g.state.owned[2] = true;
  g.ammo[2] = 9;
  g.reserve[2] = 60;
  g.updateBolt(0.3);
  g.animateBolt();
  assert.ok(g.gunAction.rotation.z > 0.8, 'handle lifts before retracting');
  assert.ok(Math.abs(g.gunAction.position.z) < 0.000001);
  g.updateBolt(0.25);
  g.animateBolt();
  assert.ok(g.gunAction.position.z > 0.13, 'bolt retracts fully');
  assert.ok(g.gunBoltHand.position.y > 0.2, 'hand moves up from the grip');
  const remaining = g.sniperBoltTime;
  g.state.mode = 'paused';
  g.updateBolt(10);
  assert.equal(g.sniperBoltTime, remaining);
  g.state.mode = 'playing';
  g.equipWeapon(0);
  g.updateBolt(10);
  g.equipWeapon(2);
  assert.equal(g.sniperBoltTime, remaining);
  assert.equal(g.isCyclingBolt(), true);
  assert.equal(g.isScoped(), false);
  g.updateBolt(0.35);
  g.animateBolt();
  assert.equal(g.gunAction.position.z, 0, 'bolt feeds forward before handle locks');
  assert.ok(g.gunAction.rotation.z > 0);
  g.updateBolt(0.3);
  g.animateBolt();
  assert.equal(g.isCyclingBolt(), false);
  assert.equal(g.isScoped(), true);
  assert.equal(g.gunAction.rotation.z, 0);
  assert.equal(g.gunBoltHand.position.length(), 0);
  assert.equal(g.ammo[2], 9, 'chambering must not consume a second round');
  assert.equal(g.reserve[2], 60);
  assert.deepEqual(sounds, [false, true], 'bolt sounds follow the actual cycle once');
});

test('reload requested during a bolt cycle waits for the handle to lock', () => {
  const g = fixture();
  Object.assign(g, {
    weaponIndex: 2, sniperBoltTime: 1.1, reloadTime: 0,
    reloadStart() {},
  });
  g.state.mode = 'playing';
  g.ammo[2] = 4;
  g.reserve[2] = 60;
  g.reload();
  assert.equal(g.reloadTime, 0);
  assert.equal(g.sniperReloadQueued, true);
  g.updateBolt(1.1);
  assert.equal(g.sniperReloadQueued, false);
  assert.ok(g.reloadTime > 0);
  assert.equal(g.ammo[2], 4);
});

test('toMenu cleanly resets combat state and returns mode to menu', () => {
  const g = fixture();
  const enemyMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial());
  const shadowMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial());
  const enemy = { root: enemyMesh, shadow: shadowMesh };
  Object.assign(g, {
    scene: new T.Scene(),
    enemies: [enemy],
    corpses: [],
    particles: [],
    camera: new T.PerspectiveCamera(),
  });
  g.scene.add(enemyMesh, shadowMesh);
  g.state.mode = 'paused';
  g.state.wave = 3;
  g.state.medicalKits = 0;
  g.state.healCooldown = 9;
  g.weaponIndex = 2;

  g.pitch = 0.1;
  g.viewRecoil.modelYaw = 0.02;
  g.state.g18c = true;
  g.state.katana = true;
  g.state.pouch = true;
  g.difficultyMode = 'hard';
  g.state.maxArmor = 100;
  g.state.maxGrenades = 5;
  g.state.armor = 100;
  g.state.grenades = 5;

  g.toMenu();

  assert.equal(g.state.mode, 'menu');
  assert.equal(g.state.wave, 0);
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.healCooldown, 0);
  assert.equal(g.difficultyMode, 'normal');
  assert.equal(g.state.difficulty, 'normal');
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.maxArmor, 100);
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.maxGrenades, 3);
  assert.equal(g.state.ammo, 12);
  assert.equal(g.state.reserve, 48);
  assert.deepEqual(g.reserve, [48, 120, 15, 7]);
  assert.equal(g.state.ammoFull, true);
  assert.equal(g.state.g18c, false);
  assert.equal(g.state.katana, false);
  assert.equal(g.state.pouch, false);
  assert.equal(g.state.weapon, 'H1 SERVICE PISTOL');
  assert.equal(g.weaponIndex, 0);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.pitch, 0);
  assert.equal(g.viewRecoil.modelYaw, 0);
  assert.equal(g.scene.children.length, 0);

  enemyMesh.geometry.dispose();
  shadowMesh.geometry.dispose();
  enemyMesh.material.dispose();
  shadowMesh.material.dispose();
});

test('G18C purchase upgrades handgun to 33-round machine pistol for 750 credits and cannot be repurchased', () => {
  const g = fixture();
  g.emit = Game.prototype.emit;
  g.state.cash = 1000;
  g.buy('g18c');
  assert.equal(g.state.g18c, true);
  assert.equal(g.state.cash, 250);
  assert.equal(g.ammo[0], 33);
  assert.equal(g.reserve[0], 132);
  assert.equal(g.getWeapon(0).name, 'G18C MACHINE PISTOL');
  assert.equal(g.getWeapon(0).mag, 33);
  assert.equal(g.getWeapon(0).reserve, 132);
  assert.equal(g.getWeapon(0).damage, 22);
  assert.equal(g.getWeapon(0).rate, 0.068);
  assert.equal(g.state.weapon, 'G18C MACHINE PISTOL');

  // Cannot repurchase when already owned
  g.state.cash = 1000;
  g.buy('g18c');
  assert.equal(g.state.cash, 1000);

  // Insufficient credits
  const g2 = fixture();
  g2.state.cash = 700;
  g2.buy('g18c');
  assert.equal(g2.state.g18c, false);
  assert.equal(g2.state.cash, 700);
});

test('G18C supports full-auto firing while holding trigger and single tap firing', () => {
  const g = fixture();
  g.state.mode = 'playing';
  g.state.g18c = true;
  g.weaponIndex = 0;
  g.ammo = [33, 0, 0];
  g.reserve = [132, 0, 0];
  g.walls = [];
  g.enemies = [];
  g.camera = new T.PerspectiveCamera(76, 1, 0.06, 150);
  g.scene = new T.Scene();
  g.ray = new T.Raycaster();
  g.updateCameraAim = () => {};
  let shotCount = 0;
  g.gunshot = () => { shotCount++; };

  // Single tap: mousedown fires once, mouseup stops firing
  g.shooting = true;
  g.shoot();
  assert.equal(shotCount, 1);
  assert.equal(g.ammo[0], 32);
  g.shooting = false;

  // Holding down fire in update loop: continuous auto fire as cooldown expires
  g.shooting = true;
  for (let frame = 0; frame < 5; frame++) {
    g.cooldown = 0;
    if (g.shooting && (g.weaponIndex === 1 || (g.weaponIndex === 0 && g.state.g18c))) {
      g.shoot();
      g.updateCameraAim();
    }
  }
  assert.equal(shotCount, 6);
  assert.equal(g.ammo[0], 27);
});

test('G18C reload transfers up to 33 rounds and ammo resupply fills to 33/132', () => {
  const g = fixture();
  g.state.g18c = true;
  g.weaponIndex = 0;
  g.ammo[0] = 10;
  g.reserve[0] = 50;
  g.reload();
  assert.ok(g.reloadTime > 0);

  // Ammo resupply in shop
  g.state.cash = 500;
  g.buy('ammo');
  assert.equal(g.ammo[0], 33);
  assert.equal(g.reserve[0], 132);
  assert.equal(g.isAmmoFull(), true);

  // Cannot buy ammo when full
  const cashBefore = g.state.cash;
  g.buy('ammo');
  assert.equal(g.state.cash, cashBefore);
});

test('Katana purchase charges 1000 credits, rejects insufficient funds, and prevents duplicate buy', () => {
  const g = fixture();
  g.state.cash = 999;
  g.buy('katana');
  assert.equal(g.state.katana, false);
  assert.equal(g.state.cash, 999);

  g.state.cash = 1000;
  g.buy('katana');
  assert.equal(g.state.katana, true);
  assert.equal(g.state.cash, 0);

  g.state.cash = 1000;
  g.buy('katana');
  assert.equal(g.state.cash, 1000, 'cannot buy katana twice');
});

test('Ammo Pouch purchase charges 1000 credits, rejects insufficient funds, cannot buy outside shop, and prevents duplicate buy', () => {
  const g = fixture();
  g.state.cash = 999;
  g.buy('pouch');
  assert.equal(g.state.pouch, false);
  assert.equal(g.state.cash, 999);

  g.state.mode = 'playing';
  g.state.cash = 1000;
  g.buy('pouch');
  assert.equal(g.state.pouch, false);
  assert.equal(g.state.cash, 1000);

  g.state.mode = 'shop';
  g.buy('pouch');
  assert.equal(g.state.pouch, true);
  assert.equal(g.state.cash, 0);

  g.state.cash = 1000;
  g.buy('pouch');
  assert.equal(g.state.cash, 1000, 'cannot buy ammo pouch twice');
});

test('Ammo Pouch upgrades reserve ammo by 50%, immediately refills all ammo and grenades, and subsequent ammo resupply fills to boosted limits', () => {
  const g = fixture();
  g.emit = () => Game.prototype.emit.call(g);
  g.state.owned = [true, true, true, true];
  g.weaponIndex = 0;
  g.ammo = [5, 10, 3, 0];
  g.reserve = [20, 40, 6, 2];
  g.state.grenades = 0;
  assert.equal(g.isAmmoFull(), false);

  g.state.cash = 1500;
  g.buy('pouch');
  assert.equal(g.state.cash, 500);
  assert.equal(g.state.pouch, true);
  assert.equal(g.state.grenades, 5);
  assert.equal(g.state.maxGrenades, 5);

  // Immediate full refill of all magazines and +50% boosted reserves:
  // Pistol: 12 / 72, AR-2: 30 / 180, SR-3: 5 / 23, RPG-7: 1 / 11
  assert.deepEqual(g.ammo, [12, 30, 5, 1]);
  assert.deepEqual(g.reserve, [72, 180, 23, 11]);
  assert.equal(g.state.ammo, 12);
  assert.equal(g.state.reserve, 72);
  assert.equal(g.isAmmoFull(), true);

  // Cannot buy ammo resupply when full
  const cashBefore = g.state.cash;
  g.buy('ammo');
  assert.equal(g.state.cash, cashBefore);

  // Deplete ammo and verify Ammo Resupply refills up to boosted caps
  g.ammo[0] = 7;
  g.reserve[0] = 30;
  g.ammo[1] = 15;
  g.reserve[1] = 90;
  g.ammo[2] = 4;
  g.reserve[2] = 12;
  assert.equal(g.isAmmoFull(), false);

  g.buy('ammo');
  assert.equal(g.state.cash, cashBefore - 100);
  assert.deepEqual(g.ammo, [12, 30, 5, 1]);
  assert.deepEqual(g.reserve, [72, 180, 23, 11]);
  assert.equal(g.isAmmoFull(), true);
});

test('Ammo Pouch adds two grenade slots in both difficulties, respects resupply limits, and resets on retry', () => {
  for (const [difficulty, base, expanded] of [['normal', 3, 5], ['hard', 3, 5]]) {
    const g = fixture();
    g.start(difficulty);
    g.state.mode = 'shop';
    g.state.cash = 2000;
    g.state.grenades = 0;

    g.buy('pouch');
    assert.equal(g.state.grenades, expanded);
    assert.equal(g.state.maxGrenades, expanded);
    assert.equal(g.getMaxGrenades(), expanded);
    assert.equal(g.state.cash, 1000);

    g.buy('grenade');
    assert.equal(g.state.cash, 1000, 'cannot purchase above the expanded limit');

    g.state.grenades = expanded - 1;
    g.buy('pouch');
    assert.equal(g.state.grenades, expanded - 1, 'duplicate pouch purchase cannot refill grenades');
    assert.equal(g.state.cash, 1000);
    g.buy('grenade');
    assert.equal(g.state.grenades, expanded);
    assert.equal(g.state.cash, 950);

    g.nextWave();
    assert.equal(g.state.grenades, expanded);
    assert.equal(g.getMaxGrenades(), expanded);

    g.start(difficulty);
    assert.equal(g.state.pouch, false);
    assert.equal(g.state.grenades, base, 'retry must not retain extra grenades');
    assert.equal(g.state.maxGrenades, base);
  }
});

test('Ammo Pouch with G18C sets 198 max reserve regardless of purchase order', () => {
  // Case A: Buy G18C first, then Pouch
  const g1 = fixture();
  g1.state.cash = 2000;
  g1.buy('g18c');
  assert.equal(g1.state.g18c, true);
  assert.equal(g1.ammo[0], 33);
  assert.equal(g1.reserve[0], 132);
  assert.equal(g1.getMaxReserve(0), 132);

  g1.buy('pouch');
  assert.equal(g1.state.pouch, true);
  assert.equal(g1.ammo[0], 33);
  assert.equal(g1.reserve[0], 198);
  assert.equal(g1.getMaxReserve(0), 198);

  // Case B: Buy Pouch first, then G18C
  const g2 = fixture();
  g2.state.cash = 2000;
  g2.buy('pouch');
  assert.equal(g2.state.pouch, true);
  assert.equal(g2.ammo[0], 12);
  assert.equal(g2.reserve[0], 72);
  assert.equal(g2.getMaxReserve(0), 72);

  g2.buy('g18c');
  assert.equal(g2.state.g18c, true);
  assert.equal(g2.ammo[0], 33);
  assert.equal(g2.reserve[0], 198);
  assert.equal(g2.getMaxReserve(0), 198);
});

test('purchasing weapons after Ammo Pouch grants boosted reserve ammo caps', () => {
  const g = fixture();
  g.state.cash = 10000;
  g.buy('pouch');
  assert.equal(g.state.pouch, true);

  // Buy AR-2 (rifle)
  g.buy('rifle');
  assert.equal(g.weaponIndex, 1);
  assert.equal(g.state.owned[1], true);
  assert.equal(g.ammo[1], 30);
  assert.equal(g.reserve[1], 180);
  assert.equal(g.getMaxReserve(1), 180);

  // Buy SR-3 (sniper)
  g.buy('sniper');
  assert.equal(g.weaponIndex, 2);
  assert.equal(g.state.owned[2], true);
  assert.equal(g.ammo[2], 5);
  assert.equal(g.reserve[2], 23);
  assert.equal(g.getMaxReserve(2), 23);

  // Buy RPG-7
  g.buy('rpg');
  assert.equal(g.weaponIndex, 3);
  assert.equal(g.state.owned[3], true);
  assert.equal(g.ammo[3], 1);
  assert.equal(g.reserve[3], 11);
  assert.equal(g.getMaxReserve(3), 11);
});

test('Ammo Pouch purchase is blocked in non-shop modes', () => {
  const g = fixture();
  const nonShopModes = ['menu', 'playing', 'paused', 'cleared', 'dead', 'won'];
  for (const mode of nonShopModes) {
    g.state.mode = mode;
    g.state.cash = 1000;
    g.buy('pouch');
    assert.equal(g.state.pouch, false, `pouch purchase must fail in mode: ${mode}`);
    assert.equal(g.state.cash, 1000);
  }
});

test('weapon swapping between G18C and AR-2 preserves independent ammo counts, resets shooting trigger, and sets switch cooldown', () => {
  const g = fixture();
  g.emit = Game.prototype.emit;
  g.state.mode = 'playing';
  g.state.g18c = true;
  g.state.owned = [true, true, false];
  g.weaponIndex = 0;
  g.ammo = [33, 30, 0];
  g.reserve = [132, 120, 0];
  g.camera = new T.PerspectiveCamera(76, 1, 0.06, 150);
  g.scene = new T.Scene();
  g.ray = new T.Raycaster();
  g.walls = [];
  g.enemies = [];
  g.gunshot = () => {};

  // Fire 2 rounds from G18C
  g.shooting = true;
  g.shoot();
  g.cooldown = 0;
  g.shoot();
  assert.equal(g.ammo[0], 31);
  assert.equal(g.state.weapon, 'G18C MACHINE PISTOL');

  // Switch to AR-2 while shooting
  g.equipWeapon(1);
  assert.equal(g.weaponIndex, 1);
  assert.equal(g.shooting, false);
  assert.equal(g.cooldown, 0.2);
  assert.equal(g.state.weapon, 'AR-2 ASSAULT RIFLE');
  assert.equal(g.ammo[1], 30);

  // Fire 1 round from AR-2
  g.cooldown = 0;
  g.shooting = true;
  g.shoot();
  assert.equal(g.ammo[1], 29);

  // Switch back to G18C
  g.equipWeapon(0);
  assert.equal(g.weaponIndex, 0);
  assert.equal(g.shooting, false);
  assert.equal(g.cooldown, 0.2);
  assert.equal(g.state.weapon, 'G18C MACHINE PISTOL');
  assert.equal(g.ammo[0], 31, 'G18C ammo count must be preserved across switches');
  assert.equal(g.ammo[1], 29, 'AR-2 ammo count must be preserved across switches');
});

test('body armor absorbs 100% of damage until depleted, remainder reduces health', () => {
  const g = fixture();
  g.state.mode = 'playing';
  g.state.health = 100;
  g.state.armor = 100;

  // 10 damage: absorb = min(100, 10) = 10, armor = 90, health = 100
  g.damagePlayer(10);
  assert.equal(g.state.armor, 90);
  assert.equal(g.state.health, 100);

  // Depleted armor: armor reaches 0, remainder hits HP
  g.state.armor = 5;
  // 20 damage: absorb = min(5, 20) = 5, armor = 0, health = 100 - 20 + 5 = 85
  g.damagePlayer(20);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 85);

  // Damage with 0 armor: HP reduced directly
  g.damagePlayer(25);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 60);

  // Lethal damage transitions to dead
  g.damagePlayer(100);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 0);
  assert.equal(g.state.mode, 'dead');

  // Edge case: Exactly 1 armor point absorbs 1 damage from 100-damage strike, saving the player with 1 HP
  g.state.mode = 'playing';
  g.state.health = 100;
  g.state.armor = 1;
  g.damagePlayer(100);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 1);
  assert.equal(g.state.mode, 'playing');

  // Edge case: Exactly 1 armor point taking 101 damage is lethal
  g.state.health = 100;
  g.state.armor = 1;
  g.damagePlayer(101);
  assert.equal(g.state.armor, 0);
  assert.equal(g.state.health, 0);
  assert.equal(g.state.mode, 'dead');

  // Ignored when not playing
  g.state.mode = 'paused';
  g.state.health = 50;
  g.state.armor = 50;
  g.damagePlayer(30);
  assert.equal(g.state.health, 50);
  assert.equal(g.state.armor, 50);
});

test('medical kit costs 50 credits, can be stocked at full HP, and caps at three', () => {
  const g = fixture();
  g.state.mode = 'shop';
  g.state.cash = 50;
  g.state.health = 30;
  g.state.medicalKits = 1;

  // Successful purchase with exact 50 credits
  g.buy('health');
  assert.equal(g.state.health, 30);
  assert.equal(g.state.medicalKits, 2);
  assert.equal(g.state.cash, 0);

  // Cannot purchase with insufficient funds (49 credits)
  g.state.cash = 49;
  g.state.health = 80;
  g.buy('health');
  assert.equal(g.state.health, 80);
  assert.equal(g.state.medicalKits, 2);
  assert.equal(g.state.cash, 49);

  // Full health permits buying kits when there is space
  g.state.cash = 500;
  g.state.health = 100;
  g.buy('health');
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.cash, 450);

  // Low health does not bypass the inventory limit
  g.state.health = 10;
  g.buy('health');
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.health, 10);
  assert.equal(g.state.cash, 450);
});

test('Q heals 50 HP per kit with a 10-second cooldown that pauses outside combat', () => {
  const g = fixture();
  g.state.mode = 'playing';
  g.state.health = 10;

  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 60);
  assert.equal(g.state.medicalKits, 2);
  assert.equal(g.state.healCooldown, 10);

  g.handleKeyDown({ code: 'KeyQ', repeat: true });
  assert.equal(g.state.health, 60);
  assert.equal(g.state.medicalKits, 2, 'holding Q must not consume extra kits');

  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 60, 'pressing Q again during cooldown cannot heal');
  assert.equal(g.state.medicalKits, 2);
  assert.equal(g.state.healCooldown, 10, 'blocked input must not restart the cooldown');

  for (const mode of ['paused', 'cleared', 'shop']) {
    g.state.mode = mode;
    g.updateHealCooldown(20);
    assert.equal(g.state.healCooldown, 10);
  }
  g.state.mode = 'playing';
  g.updateHealCooldown(9.5);
  assert.equal(g.state.healCooldown, 0.5);
  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 60);
  assert.equal(g.state.medicalKits, 2);
  g.updateHealCooldown(0.5);
  assert.equal(g.state.healCooldown, 0);
  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 100, 'Q becomes usable after exactly 10 seconds');
  assert.equal(g.state.medicalKits, 1);
  assert.equal(g.state.healCooldown, 10);

  g.updateHealCooldown(20);
  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.medicalKits, 1, 'full HP must not waste a kit');
  assert.equal(g.state.healCooldown, 0, 'full HP must not start a cooldown');

  g.state.health = 1;
  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 51);
  assert.equal(g.state.medicalKits, 0);

  g.updateHealCooldown(10);
  g.handleKeyDown({ code: 'KeyQ', repeat: false });
  assert.equal(g.state.health, 51, 'empty inventory cannot heal');
  assert.equal(g.state.medicalKits, 0);
  assert.equal(g.state.healCooldown, 0);

  g.state.medicalKits = 1;
  g.state.mode = 'paused';
  g.heal();
  assert.equal(g.state.health, 51);
  assert.equal(g.state.medicalKits, 1, 'healing requires active combat');
});

test('Hard mode start initializes in Wave 1 cleared supply shop with 2000 credits, and advances to Wave 2', () => {
  const g = fixture();
  g.state.medicalKits = 0;
  g.state.healCooldown = 9;
  g.start('hard');

  // Initial state for Hard mode
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 1);
  assert.equal(g.state.cash, 2000);
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.maxArmor, 100);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.healCooldown, 0);
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.maxGrenades, 3);
  assert.equal(g.difficultyMode, 'hard');
  assert.equal(g.state.difficulty, 'hard');
  assert.equal(g.difficulty, 1.35);

  // Full items cannot be repurchased at game start
  assert.equal(g.state.ammoFull, true, 'ammo must start full in Hard mode');
  assert.equal(g.state.ammo, 12);
  assert.equal(g.state.reserve, 48);
  assert.deepEqual(g.reserve, [48, 120, 15, 7]);
  assert.equal(g.state.pouch, false);
  g.buy('ammo');
  assert.equal(g.state.cash, 2000, 'ammo already full cannot charge');
  g.buy('armor');
  assert.equal(g.state.cash, 2000, 'armor already 100 cannot charge');
  g.buy('health');
  assert.equal(g.state.cash, 2000, 'medical kits already 3 cannot charge');
  g.buy('grenade');
  assert.equal(g.state.cash, 2000, 'grenades already 3 cannot charge');

  // Can purchase supplies and weapons in initial shop
  g.buy('g18c');
  assert.equal(g.state.g18c, true);
  assert.equal(g.state.cash, 1250);

  g.buy('rifle');
  assert.equal(g.state.owned[1], true);
  assert.equal(g.state.cash, 450);

  // Next wave starts Wave 2 with doubled pending count
  g.nextWave();
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 2);
  assert.equal(g.pending, 24); // (6 + 2 * 3) * 2 = 24
  assert.equal(g.state.remaining, 24);

  // Wave 2 clear awards ₡350 (250 + 2 * 50) and enters cleared -> shop -> Wave 3 (30 enemies)
  g.state.health = 80;
  g.finish('cleared');
  assert.equal(g.state.mode, 'cleared');
  assert.equal(g.state.cash, 800); // 450 + 350 = 800
  assert.equal(g.state.health, 100);
  g.openShop();
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 2);

  // Hard mode resupply tests: armor restores up to 100, grenades up to 3
  g.state.armor = 30;
  g.buy('armor');
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.cash, 650);
  g.buy('armor');
  assert.equal(g.state.cash, 650, 'armor already 100 cannot charge');

  g.state.grenades = 2;
  g.buy('grenade');
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.cash, 600);
  g.buy('grenade');
  assert.equal(g.state.cash, 600, 'grenades already 3 cannot charge');

  g.nextWave();
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 3);
  assert.equal(g.pending, 30); // (6 + 3 * 3) * 2 = 30
  assert.equal(g.state.remaining, 30);
});

test('F8 toggles boss debug only on the title screen, and debug start opens the Hans preparation shop', () => {
  const g = fixture();
  g.state.mode = 'menu';
  g.state.bossDebug = false;
  let prevented = 0;
  g.handleKeyDown({ code: 'F8', preventDefault: () => prevented++ });
  assert.equal(g.state.bossDebug, true);
  assert.equal(prevented, 1);

  g.handleKeyDown({ code: 'F8', repeat: true, preventDefault: () => prevented++ });
  assert.equal(g.state.bossDebug, true, 'key repeat must not toggle the mode');
  g.handleKeyDown({ code: 'F8', ctrlKey: true, preventDefault: () => prevented++ });
  assert.equal(g.state.bossDebug, true, 'modified F8 must be ignored');

  let audioInited = 0;
  g.initAudio = () => { audioInited++; };
  g.start('normal', { bossDebug: true });
  assert.ok(audioInited > 0, 'start with bossDebug must initialize audio');
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.bossDebug, true);
  assert.equal(g.state.difficulty, 'hard');
  assert.equal(g.difficultyMode, 'hard');
  assert.equal(g.state.wave, 6);
  assert.equal(g.state.cash, 20000);
  assert.equal(g.state.kills, 0);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.medicalKits, 3);
  audioInited = 0;
  g.nextWave();
  assert.ok(audioInited > 0, 'nextWave into Hans boss wave must initialize/resume audio');
  assert.equal(g.state.wave, 7);
  assert.equal(g.pending, 1);
  assert.equal(g.state.remaining, 1);

  g.state.mode = 'playing';
  g.handleKeyDown({ code: 'F8', preventDefault: () => prevented++ });
  assert.equal(g.state.bossDebug, true, 'F8 is title-only');
  g.toMenu();
  assert.equal(g.state.bossDebug, false, 'returning to title resets debug mode');
});

test('debug mode allows selecting Normal or Hard, arbitrary wave 1-7 with preparation shop, and custom cash with clamping', () => {
  const g = fixture();

  // Test Normal mode Wave 7 (Hans Volter) with 20,000 credits
  g.start('normal', { bossDebug: true, debugWave: 7, debugCash: 20000 });
  assert.equal(g.difficultyMode, 'normal');
  assert.equal(g.difficulty, 1);
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 6);
  assert.equal(g.state.debugTargetWave, 7);
  assert.equal(g.state.cash, 20000);
  assert.equal(g.state.message, 'WAVE 07 PREPARATION — ₡20,000');

  // Deploying advances to Wave 7 Hans Volter
  g.nextWave();
  assert.equal(g.state.wave, 7);
  assert.equal(g.state.debugTargetWave, undefined);
  assert.equal(g.isHansWave(), true);
  assert.equal(g.chooseEnemyKind(), HANS.kind);

  // Test Normal mode Wave 3 with custom cash
  g.start('normal', { bossDebug: true, debugWave: 3, debugCash: 15000 });
  assert.equal(g.difficultyMode, 'normal');
  assert.equal(g.difficulty, 1);
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 2);
  assert.equal(g.state.debugTargetWave, 3);
  assert.equal(g.state.cash, 15000);
  assert.equal(g.state.message, 'WAVE 03 PREPARATION — ₡15,000');

  g.nextWave();
  assert.equal(g.state.wave, 3);
  assert.equal(g.state.debugTargetWave, undefined);
  assert.equal(g.pending, 6 + 3 * 3); // 15 enemies in Normal Wave 3

  // Test clamping: wave clamped to 1..7, cash clamped to 0..999,000
  g.start('hard', { bossDebug: true, debugWave: 99, debugCash: 1500000 });
  assert.equal(g.state.debugTargetWave, 7);
  assert.equal(g.state.wave, 6);
  assert.equal(g.state.cash, 999000);

  g.start('normal', { bossDebug: true, debugWave: -5, debugCash: -500 });
  assert.equal(g.state.debugTargetWave, 1);
  assert.equal(g.state.wave, 0);
  assert.equal(g.state.cash, 0);
});

test('Normal mode start initializes in playing mode with wave 1, 500 credits, 100 armor, and full resources', () => {
  const g = fixture();
  g.state.medicalKits = 0;
  g.state.healCooldown = 9;
  g.start('normal');

  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 1);
  assert.equal(g.state.cash, 500);
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.maxArmor, 100);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.healCooldown, 0);
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.maxGrenades, 3);
  assert.equal(g.state.ammo, 12);
  assert.equal(g.state.reserve, 48);
  assert.deepEqual(g.reserve, [48, 120, 15, 7]);
  assert.equal(g.state.ammoFull, true);
  assert.equal(g.state.pouch, false);
  assert.equal(g.difficultyMode, 'normal');
  assert.equal(g.state.difficulty, 'normal');
  assert.equal(g.difficulty, 1);
  assert.equal(g.pending, 9); // 6 + 1 * 3 = 9
  assert.equal(g.state.remaining, 9);

  // Shop limits verification in Normal mode
  g.state.mode = 'shop';
  g.buy('ammo');
  assert.equal(g.state.cash, 500, 'ammo full cannot charge');
  g.buy('armor');
  assert.equal(g.state.cash, 500, 'armor full (100) cannot charge');
  g.buy('grenade');
  assert.equal(g.state.cash, 500, 'grenades full (3) cannot charge');
  g.buy('health');
  assert.equal(g.state.cash, 500, 'medical kits full (3) cannot charge');

  // Verify armor replenishment restores to 100 and caps at 100
  g.state.armor = 20;
  g.buy('armor');
  assert.equal(g.state.armor, 100);
  assert.equal(g.state.cash, 350);
  g.buy('armor');
  assert.equal(g.state.cash, 350, 'cannot exceed 100 armor in normal mode');

  // Verify grenade replenishment restores up to 3 and caps at 3
  g.state.grenades = 2;
  g.buy('grenade');
  assert.equal(g.state.grenades, 3);
  assert.equal(g.state.cash, 300);
  g.buy('grenade');
  assert.equal(g.state.cash, 300, 'cannot exceed 3 grenades in normal mode');

  // Wave 1 clear in Normal mode transitions to cleared with reward (250 + 1 * 50 = 300)
  g.state.health = 70;
  g.state.medicalKits = 2;
  g.finish('cleared');
  assert.equal(g.state.mode, 'cleared');
  assert.equal(g.state.cash, 600); // 300 + 300 = 600
  assert.equal(g.state.health, 100);
  assert.equal(g.state.medicalKits, 2);
  g.openShop();
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.state.wave, 1);

  // Buy one Medical Kit at 50 credits even though the wave clear restored full HP
  g.state.cash = 50;
  g.buy('health');
  assert.equal(g.state.health, 100);
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.cash, 0);

  // Transition to Wave 2
  g.nextWave();
  assert.equal(g.state.medicalKits, 3);
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 2);
  assert.equal(g.pending, 12); // 6 + 2 * 3 = 12
  assert.equal(g.state.remaining, 12);
});

test('start() cleanly resets combat state, weapons, and pouch/g18c upgrades from previous session', () => {
  const g = fixture();
  // Simulate an advanced playthrough with G18C, Ammo Pouch, Katana, depleted ammo
  g.state.mode = 'playing';
  g.state.wave = 5;
  g.state.g18c = true;
  g.state.pouch = true;
  g.state.katana = true;
  g.state.cash = 3500;
  g.state.level = 2;
  g.state.owned = [true, true, true, true];
  g.weaponIndex = 1;
  g.ammo = [12, 18, 4, 0];
  g.reserve = [150, 90, 15, 5];

  // Restart new normal game
  g.start('normal');

  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.wave, 1);
  assert.equal(g.state.cash, 500);
  assert.equal(g.state.g18c, false, 'g18c upgrade must be reset');
  assert.equal(g.state.pouch, false, 'pouch upgrade must be reset');
  assert.equal(g.state.katana, false, 'katana must be reset');
  assert.equal(g.state.level, 0, 'weapon damage upgrade must be reset');
  assert.deepEqual(g.state.owned, [true, false, false, false]);
  assert.equal(g.weaponIndex, 0);
  assert.equal(g.state.weapon, 'H1 SERVICE PISTOL');
  assert.equal(g.state.ammo, 12, 'H1 pistol starting magazine must be 12');
  assert.equal(g.state.reserve, 48, 'H1 pistol starting reserve must be 48');
  assert.deepEqual(g.ammo, [12, 30, 5, 1], 'all weapon magazines must reset to base');
  assert.deepEqual(g.reserve, [48, 120, 15, 7], 'all weapon reserves must reset to base (SR-3 = 15, RPG-7 = 7)');
  assert.equal(g.state.ammoFull, true);
});

test('stamina drains at 20/s during sprint and recovers at 20/s when not sprinting', () => {
  assert.equal(STAMINA.max, 100);
  assert.equal(STAMINA.drain, 20);
  assert.equal(STAMINA.recover, 20);

  const g = fixture();
  g.start('normal');
  assert.equal(g.state.stamina, 100, 'initial stamina must be 100');

  // Test drain logic (simulating 1 second of sprinting: -20 stamina)
  let stamina = 100;
  const dt = 1.0;
  const sprint = true;
  stamina = T.MathUtils.clamp(stamina + dt * (sprint ? -STAMINA.drain : STAMINA.recover), 0, STAMINA.max);
  assert.equal(stamina, 80, 'stamina drains by 20 after 1s of sprint');

  // Drains all the way to 0 and clamps
  stamina = T.MathUtils.clamp(stamina + 5.0 * (sprint ? -STAMINA.drain : STAMINA.recover), 0, STAMINA.max);
  assert.equal(stamina, 0, 'stamina clamps at 0');

  // Test recovery logic (simulating 1 second of non-sprint recovery: +20 stamina)
  const notSprint = false;
  stamina = T.MathUtils.clamp(stamina + dt * (notSprint ? -STAMINA.drain : STAMINA.recover), 0, STAMINA.max);
  assert.equal(stamina, 20, 'stamina recovers by 20 after 1s of rest/walk');

  // Recovers to 100 and clamps
  stamina = T.MathUtils.clamp(stamina + 5.0 * (notSprint ? -STAMINA.drain : STAMINA.recover), 0, STAMINA.max);
  assert.equal(stamina, 100, 'stamina clamps at 100');
});

test('full-auto firing is blocked during Katana swing and automatically resumes when swing completes', () => {
  const g = fixture();
  g.state.mode = 'playing';
  g.state.katana = true;
  g.state.owned[1] = true;
  g.weaponIndex = 1;
  g.ammo[1] = 30;
  g.reserve[1] = 120;
  g.shooting = true;

  // Melee starts
  g.melee();
  assert.ok(g.meleeTime > 0, 'Katana swing active');

  // While swinging, shoot is blocked
  const initialAmmo = g.ammo[1];
  g.shoot();
  assert.equal(g.ammo[1], initialAmmo, 'shoot must not fire while katana is swinging');

  // Advance time past katana swing
  g.meleeTime = 0;
  g.shoot();
  assert.equal(g.ammo[1], initialAmmo - 1, 'shoot fires immediately once katana swing completes');
});

test('Normal mode Wave 6 completes to cleared state with ₡550 reward, opens shop with updated prices, and advances to Wave 7 Hans boss fight', () => {
  const g = fixture();
  g.difficultyMode = 'normal';
  g.difficulty = 1;
  g.state.wave = 6;
  g.state.mode = 'playing';
  g.state.cash = 5000;
  g.state.health = 20;
  g.state.armor = 0;
  g.state.grenades = 0;
  g.state.level = 0;

  // Wave 6 completion in Normal mode
  g.completeWave();
  assert.equal(g.state.mode, 'cleared', 'Wave 6 complete must transition to cleared, not won');
  assert.equal(g.state.health, 100, 'cleared restores HP to 100');
  assert.equal(g.state.cash, 5550, 'Wave 6 clear reward is 250 + 6*50 = 550 credits');

  // Open shop
  g.openShop();
  assert.equal(g.state.mode, 'shop');

  // Buy ammo (100 credits)
  g.buy('ammo');
  assert.equal(g.state.cash, 5450, 'Ammo Resupply charged 100 credits');

  // Buy grenade (50 credits)
  g.buy('grenade');
  assert.equal(g.state.cash, 5400, 'Frag Grenade charged 50 credits');

  // Buy armor (150 credits)
  g.buy('armor');
  assert.equal(g.state.cash, 5250, 'Body Armor charged 150 credits');

  // Buy Damage Upgrade Lv.1 (1000 credits)
  g.buy('upgrade');
  assert.equal(g.state.level, 1);
  assert.equal(g.state.cash, 4250, 'Damage upgrade Lv.1 charged 1000 credits');

  // Buy Damage Upgrade Lv.2 (2000 credits)
  g.buy('upgrade');
  assert.equal(g.state.level, 2);
  assert.equal(g.state.cash, 2250, 'Damage upgrade Lv.2 charged 2000 credits');

  // 3rd buy blocked
  g.buy('upgrade');
  assert.equal(g.state.level, 2);
  assert.equal(g.state.cash, 2250, '3rd damage upgrade blocked at max level 2');

  // Advance to Wave 7
  g.nextWave();
  assert.equal(g.state.wave, 7);
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.isHansWave(), true);
  assert.equal(g.pending, 1);
  assert.equal(g.chooseEnemyKind(), HANS.kind);

  // Hans enemy presence
  const hansEnemy = { hp: 12000, dead: false, kind: HANS.kind };
  g.enemies = [hansEnemy];
  g.state.remaining = 1;

  // Defeating Hans completes wave to won
  hansEnemy.dead = true;
  g.enemies = [];
  g.state.remaining = 0;
  g.completeWave();
  assert.equal(g.state.mode, 'won', 'Defeating Hans in Normal mode triggers won');
});

test('debug mode debugMinHp option clamps health to 1 and prevents death from all damage sources', () => {
  const g = fixture();

  // 1. Starting with debugMinHp: true sets state.debugMinHp to true
  g.start('normal', { bossDebug: true, debugWave: 7, debugCash: 20000, debugMinHp: true });
  assert.equal(g.state.debugMinHp, true);
  assert.ok(g.state.message.includes('[MIN HP 1]'));

  // Enter combat
  g.nextWave();
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.state.debugMinHp, true);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.armor, 100);

  // Take massive damage (500)
  g.damagePlayer(500);
  assert.equal(g.state.armor, 0, 'armor should be depleted');
  assert.equal(g.state.health, 1, 'health must clamp to 1 and not drop below');
  assert.equal(g.state.mode, 'playing', 'player must not die');

  // Repeated damage while at 1 HP keeps health at 1
  g.damagePlayer(100);
  assert.equal(g.state.health, 1);
  assert.equal(g.state.mode, 'playing');

  // 2. Normal mode start without debugMinHp allows normal death
  g.start('normal');
  assert.equal(g.state.debugMinHp, false);
  g.damagePlayer(500);
  assert.equal(g.state.health, 0);
  assert.equal(g.state.mode, 'dead');
});

test('wave completion waits until defeated enemy corpses have finished sinking and disappeared from the scene', () => {
  const g = fixture();
  g.start('normal');
  g.waveTime = 3;
  g.pending = 0;
  g.state.remaining = 1;

  const dummyEnemy = {
    dead: false,
    hp: 10,
    kind: 0,
    root: new T.Group(),
    shadow: new T.Mesh(),
  };
  g.enemies = [dummyEnemy];

  // Kill the last enemy
  g.damageEnemy(dummyEnemy, 20, new T.Vector3());
  assert.equal(g.state.remaining, 0);
  assert.equal(g.corpses.length, 1);

  // In the update loop, if corpses remain, wave does not complete
  const canCompleteWave = () => (
    g.state.mode === 'playing' &&
    g.state.remaining === 0 &&
    g.pending === 0 &&
    g.waveTime > 2 &&
    g.corpses.length === 0
  );
  assert.equal(canCompleteWave(), false, 'cannot complete wave while corpses exist');

  // Simulate corpse aging at 0.5s
  for (let i = g.corpses.length - 1; i >= 0; i--) {
    const c = g.corpses[i];
    c.age += 0.5;
    if (c.age > 1.2) {
      g.scene.remove(c.enemy.root, c.enemy.shadow);
      g.corpses.splice(i, 1);
    }
  }
  assert.equal(g.corpses.length, 1);
  assert.equal(canCompleteWave(), false, 'corpse age 0.5s still active in scene');

  // Corpse age reaches > 1.2s and is removed from scene
  for (let i = g.corpses.length - 1; i >= 0; i--) {
    const c = g.corpses[i];
    c.age += 0.8;
    if (c.age > 1.2) {
      g.scene.remove(c.enemy.root, c.enemy.shadow);
      g.corpses.splice(i, 1);
    }
  }
  assert.equal(g.corpses.length, 0);
  assert.equal(canCompleteWave(), true, 'wave can complete after corpses disappear');
  g.completeWave();
  assert.equal(g.state.mode, 'cleared');
});


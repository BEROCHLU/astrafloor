import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';
import { SIREN, replaceSirenSlots } from '../lib/siren.ts';

function fixture(t, difficulty = 'normal', wave = 4) {
  const g = Object.create(Game.prototype), graphics = new Graphics();
  Object.assign(g, {
    graphics, scene: new T.Scene(), camera: new T.PerspectiveCamera(), ray: new T.Raycaster(),
    state: { mode: 'playing', wave, health: 100, armor: 100, kills: 0, cash: 0, remaining: 5 },
    difficultyMode: difficulty, difficulty: difficulty === 'hard' ? 1.35 : 1,
    pending: (6 + wave * 3) * (difficulty === 'hard' ? 2 : 1),
    navTime: 100, nav: new Int16Array(61 * 61), feet: 0, keys: new Set(),
    walls: [], obstacles: [], enemies: [], corpses: [], particles: [], enemyProjectiles: [],
    thrownGrenades: [], rockets: [], renderer: { domElement: {} },
    emit() {}, sound() {}, hurtSound() {}, burst() {}, lock() {}, initAudio() {},
    contactShadow(x, z) {
      const mesh = new T.Mesh(graphics.plane, graphics.material(new T.MeshBasicMaterial()));
      mesh.position.set(x, 0, z); g.scene.add(mesh); return mesh;
    },
  });
  g.camera.position.set(0, 1.7, 0); g.scene.add(g.camera);
  t.after(() => { g.clearEnemyProjectiles(); graphics.dispose(); });
  return g;
}
function spawn(g, z = -3) {
  const choose = g.chooseEnemyKind;
  g.chooseEnemyKind = () => SIREN.kind;
  g.spawn(); g.chooseEnemyKind = choose;
  const e = g.enemies.at(-1); e.root.position.set(0, 0, z);
  g.scene.updateMatrixWorld(true); return e;
}
function advance(g, seconds, fps = 60) {
  for (let elapsed = 0; elapsed < seconds - 1e-9;) {
    const dt = Math.min(1 / fps, seconds - elapsed); g.updateEnemies(dt); elapsed += dt;
  }
}
function cover(g) {
  const wall = new T.Mesh(g.graphics.box, new T.MeshBasicMaterial());
  wall.position.set(0, 1.5, -1.5); wall.scale.set(8, 3, 0.1);
  g.scene.add(wall); g.scene.updateMatrixWorld(true);
  g.walls.push(wall); g.obstacles.push(new T.Box3().setFromObject(wall));
  wall.material.dispose(); return wall;
}

test('Siren deals exactly 30/40.5 HP with standard difficulty scaling per full scream at 30/60/144 FPS, bypassing armor without wave damage scaling', (t) => {
  for (const difficulty of ['normal', 'hard']) for (const fps of [30, 60, 144]) for (const wave of [4, 6]) {
    const g = fixture(t, difficulty, wave), e = spawn(g);
    advance(g, SIREN.windup + SIREN.duration, fps);
    assert.ok(Math.abs(g.state.health - (difficulty === 'hard' ? 59.5 : 70)) < 1e-7);
    assert.equal(g.state.armor, 100);
    assert.equal(e.siren.action, 'cooldown');
    assert.equal(e.siren.effect.parent, null);
    assert.equal(g.enemyProjectiles.length, 0);
    assert.equal(e.root.position.z, -3);
  }
});

test('windup and cooldown do not damage, and even point-blank Sirens never melee', (t) => {
  const g = fixture(t), e = spawn(g, -0.7);
  advance(g, SIREN.windup - 0.01); assert.equal(g.state.health, 100);
  assert.equal(e.siren.effect.parent, null);
  g.enemyMelee(e); assert.equal(g.state.health, 100);
  advance(g, 0.01); assert.equal(e.siren.effect.parent, g.scene);
  advance(g, 1.5); assert.ok(Math.abs(g.state.health - 70) < 1e-7);
  advance(g, 2.9); assert.ok(Math.abs(g.state.health - 70) < 1e-7);
  advance(g, 0.1 + SIREN.windup - 0.01); assert.ok(Math.abs(g.state.health - 70) < 1e-7);
});

test('leaving, entering, height and thin cover gate scream exposure, including during a committed scream', (t) => {
  assert.equal(SIREN.radius, 8.7);
  const g = fixture(t), e = spawn(g);
  advance(g, SIREN.windup + 0.5); assert.ok(Math.abs(g.state.health - 90) < 1e-7);
  g.camera.position.z = 7; advance(g, 0.25); assert.ok(Math.abs(g.state.health - 90) < 1e-7);
  g.camera.position.z = 0; advance(g, 0.25); assert.ok(Math.abs(g.state.health - 85) < 1e-7);
  cover(g); advance(g, 0.5); assert.ok(Math.abs(g.state.health - 85) < 1e-7);
  assert.equal(e.siren.effect.parent, null);
  const sheltered = fixture(t), b = spawn(sheltered); cover(sheltered);
  b.siren.update(1, 3); assert.equal(b.siren.action, 'approach');
  sheltered.walls = []; b.siren.update(1, 3); assert.equal(b.siren.action, 'approach', 'obstacle boxes also block sound damage');
  const high = fixture(t), c = spawn(high); high.camera.position.y = 3.5;
  c.siren.update(2.3, 3); assert.equal(high.state.health, 100);
  c.siren.update(2.3, SIREN.radius + 0.01); assert.equal(c.siren.action, 'approach');
});

test('partial exposure contributes only its duration rather than an entire damage tick', (t) => {
  const g = fixture(t), e = spawn(g);
  e.siren.update(SIREN.windup, 3); e.siren.update(0.125, 3); e.siren.update(0.125, SIREN.radius + 0.1);
  assert.ok(Math.abs(g.state.health - 97.5) < 1e-7);
});

test('overlapping Sirens add damage and keep animations independent', (t) => {
  const g = fixture(t, 'hard'), a = spawn(g, -2), b = spawn(g, -3);
  advance(g, SIREN.windup + SIREN.duration); assert.ok(Math.abs(g.state.health - 19) < 1e-7); assert.equal(g.state.armor, 100);
  g.state.health = 100;
  a.siren.update(3.9, 2); a.siren.pose(true);
  assert.equal(a.sirenThroat.visible, true); assert.equal(b.sirenThroat.visible, false);
});

test('pause stops the voice, freezes timing and resumes the remaining scream once', (t) => {
  const g = fixture(t), e = spawn(g), voices = [];
  g.sirenScreamSound = (duration) => { const voice = { duration, stopped: false }; voices.push(voice); return () => { voice.stopped = true; }; };
  const previous = globalThis.document;
  globalThis.document = { pointerLockElement: null };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  advance(g, SIREN.windup + 0.5); g.pause();
  const timer = e.siren.timer, hp = g.state.health;
  g.updateEnemies(10); assert.equal(e.siren.timer, timer); assert.equal(g.state.health, hp);
  assert.equal(voices[0].stopped, true);
  g.resume(); advance(g, 1);
  assert.equal(voices.length, 2); assert.ok(Math.abs(voices[1].duration - 1) < 1e-7);
  assert.ok(Math.abs(g.state.health - 70) < 1e-7); assert.equal(voices[1].stopped, true);
});

test('Siren death and lethal player damage clear effects immediately; debug minimum HP remains effective', (t) => {
  const g = fixture(t), e = spawn(g); advance(g, 1);
  g.damageEnemy(e, 9999, e.root.position);
  assert.equal(e.siren.effect.parent, null); assert.equal(e.sirenThroat.visible, false);
  const hp = g.state.health; advance(g, 3); assert.equal(g.state.health, hp);
  assert.equal(g.state.cash, SIREN.reward);
  const lethal = fixture(t), a = spawn(lethal), b = spawn(lethal, -2);
  lethal.state.health = 1; advance(lethal, 1.1);
  assert.equal(lethal.state.mode, 'dead'); assert.equal(lethal.state.armor, 100);
  assert.equal(a.siren.effect.parent, null); assert.equal(b.siren.effect.parent, null);
  const debug = fixture(t); spawn(debug); debug.state.health = 1; debug.state.debugMinHp = true;
  advance(debug, 2.3); assert.equal(debug.state.health, 1); assert.equal(debug.state.mode, 'playing');
});

test('rosters meet exact quotas even with no random Bloat/Husk, preserving bosses, Crawler and totals', (t) => {
  for (const mode of ['normal', 'hard']) for (let wave = 1; wave <= 7; wave++) {
    const g = fixture(t, mode, wave), total = wave === 7 ? 1 : g.pending;
    const random = t.mock.method(Math, 'random', () => 0.99);
    const roster = [];
    for (let i = 0; i < total; i++) { g.pending = total - i; roster.push(g.chooseEnemyKind()); }
    random.mock.restore();
    const count = wave >= 4 && wave <= 6 ? SIREN.counts[mode][wave - 4] : 0;
    assert.equal(roster.filter(k => k === 8).length, count, `${mode} wave ${wave}`);
    assert.equal(roster.length, total);
    if (wave < 7) assert.equal(roster[2], 5);
    assert.equal(roster.filter(k => k === 3).length, wave === 5 ? 1 : wave === 6 ? 2 : 0);
    if (wave === 7) assert.deepEqual(roster, [7]);
  }
  const base = [0, 4, 5, 6, 2, 0, 1, 0, 4, 6];
  // 2 Sirens: 1 Bloat + 1 Husk
  const res2 = replaceSirenSlots(base, 4, 'normal');
  assert.equal(res2.filter((k) => k === 8).length, 2);
  assert.equal(res2.filter((k) => k === 4).length, 1);
  assert.equal(res2.filter((k) => k === 6).length, 1);
  assert.equal(res2.filter((k) => k === 2).length, 1);
  assert.equal(res2.filter((k) => k === 0 || k === 1 || k === 5).length, 5);

  // 3 Sirens: 1 Bloat + 1 Husk + 1 Scrake
  const res3 = replaceSirenSlots(base, 5, 'normal');
  assert.equal(res3.filter((k) => k === 8).length, 3);
  assert.equal(res3.filter((k) => k === 4).length, 1);
  assert.equal(res3.filter((k) => k === 6).length, 1);
  assert.equal(res3.filter((k) => k === 2).length, 0);
  assert.equal(res3.filter((k) => k === 0 || k === 1 || k === 5).length, 5);

  // 4 Sirens: 1 Bloat + 1 Husk + 1 Scrake + 1 Other
  const res4 = replaceSirenSlots(base, 6, 'normal');
  assert.equal(res4.filter((k) => k === 8).length, 4);
  assert.equal(res4.filter((k) => k === 4).length, 1);
  assert.equal(res4.filter((k) => k === 6).length, 1);
  assert.equal(res4.filter((k) => k === 2).length, 0);
  assert.equal(res4.filter((k) => k === 0 || k === 1 || k === 5).length, 4);

  // Fallback test: when Scrake is missing, falls back to Other while protecting Freshpound
  const fallbackBase = [3, 4, 5, 6, 0, 0, 0, 0];
  const fbRes = replaceSirenSlots(fallbackBase, 6, 'hard'); // count = 4
  assert.equal(fbRes.filter((k) => k === 8).length, 4);
  assert.equal(fbRes.filter((k) => k === 3).length, 1, 'Freshpound is protected');
  assert.equal(fbRes.filter((k) => k === 4).length, 0);
  assert.equal(fbRes.filter((k) => k === 6).length, 0);
  assert.equal(fbRes.filter((k) => k === 0 || k === 5).length, 3);
  assert.deepEqual(fallbackBase, [3, 4, 5, 6, 0, 0, 0, 0], 'base is not mutated');
});

test('clearing a wave cancels attacks and discards its spawn plan before a retry', (t) => {
  const g = fixture(t); g.chooseEnemyKind(); const plan = g.enemySpawnPlan;
  const e = spawn(g); advance(g, 0.9); g.clearEnemyProjectiles();
  assert.equal(e.siren.effect.parent, null); assert.equal(g.enemySpawnPlan, undefined);
  g.chooseEnemyKind(); assert.notEqual(g.enemySpawnPlan, plan);
});

test('Siren has a headshot target and shares bounded model and Hans-style effect resources', (t) => {
  const g = fixture(t), a = spawn(g), b = g.graphics.createEnemy(8);
  a.root.updateMatrixWorld(true);
  const target = a.neck.localToWorld(new T.Vector3(0, 0.16, 0));
  const ray = new T.Raycaster(target.clone().add(new T.Vector3(0, 0, 4)), new T.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects(a.parts)[0]?.object.userData.hitZone, 'head');
  assert.notEqual(a.sirenJaw, b.sirenJaw); assert.notEqual(a.sirenThroat, b.sirenThroat);
  const red = a.siren.effect, green = g.graphics.createAreaEffect(SIREN.radius, 0x8ab83c, 0xc1ee54);
  assert.equal(red.children.length, 2);
  red.children.forEach((mesh, i) => {
    assert.deepEqual(mesh.geometry.parameters, green.children[i].geometry.parameters);
    assert.deepEqual(mesh.scale.toArray(), green.children[i].scale.toArray());
    assert.equal(mesh.material.opacity, green.children[i].material.opacity);
    assert.equal(mesh.userData.noHit, true);
  });
  assert.equal(red.children[0].material.color.getHex(), 0xff3030);
  assert.equal(red.children[1].material.color.getHex(), 0xff6060);
  let draws = 0, triangles = 0;
  b.root.traverse(o => { if (o instanceof T.Mesh) { draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  assert.ok(draws <= 28, `${draws} draws`); assert.ok(triangles <= 6000, `${triangles} triangles`);
  const resources = () => [g.graphics.geometries.size, g.graphics.materials.size, g.graphics.enemyMaterials.materials.size, g.graphics.textures.size];
  const before = resources();
  for (let i = 0; i < 30; i++) {
    g.graphics.createEnemy(8); const clone = g.graphics.createAreaEffect(SIREN.radius, 0xff3030, 0xff6060);
    assert.equal(clone.children[0].material, red.children[0].material);
    assert.equal(clone.children[1].geometry, red.children[1].geometry);
  }
  assert.deepEqual(resources(), before);
});

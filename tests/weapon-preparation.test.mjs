import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Graphics } from '../lib/graphics.ts';
import { Game } from '../lib/game.ts';

function fixture(failure) {
  const graphics = new Graphics(), scene = new T.Scene(), camera = new T.PerspectiveCamera();
  const gun = new T.Group();
  gun.visible = false;
  camera.add(gun);
  scene.add(camera);
  const previousTarget = new T.WebGLRenderTarget(8, 8);
  let target = previousTarget, compiled = 0, rendered = 0, released = 0;
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: true },
    getRenderTarget: () => target,
    getActiveCubeFace: () => 2,
    getActiveMipmapLevel: () => 1,
    setRenderTarget(next, face, level) {
      target = next;
      if (next && next !== previousTarget) next.addEventListener('dispose', () => released++);
      if (next === previousTarget) {
        assert.equal(face, 2);
        assert.equal(level, 1);
      }
    },
    compile(weapons, view, world) {
      compiled++;
      assert.equal(view, camera);
      assert.equal(world, scene);
      assert.equal(target, null, 'precompile the screen shader variants');
      assert.equal(gun.visible, true, 'include the gameplay muzzle light');
      assert.equal(weapons.children.length, 6);
      if (failure === 'compile') throw new Error('compile failed');
    },
    render(world, view) {
      rendered++;
      assert.equal(world, scene);
      assert.equal(view, camera);
      assert.equal(target.width, 32);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      assert.equal(renderer.shadowMap.needsUpdate, false);
      const weapons = camera.getObjectByName('Weapon preparation');
      assert.ok(weapons);
      weapons.traverse((object) => {
        assert.equal(object.visible, true);
        assert.equal(object.frustumCulled, false);
      });
      if (failure === 'render') throw new Error('render failed');
    },
  };
  const game = Object.assign(Object.create(Game.prototype), { graphics, scene, camera, gun, renderer, disposed: false });
  const stats = () => ({ target, compiled, rendered, released });
  const cleanup = () => { graphics.dispose(); previousTarget.dispose(); };
  return { game, graphics, camera, gun, renderer, previousTarget, stats, cleanup };
}

test('weapon preparation runs once, restores rendering state, and makes first equips reuse templates', async () => {
  const f = fixture();
  try {
    const pending = f.game.prepareResources();
    assert.equal(f.game.prepareResources(), pending);
    await pending;
    assert.deepEqual(f.stats(), { target: f.previousTarget, compiled: 1, rendered: 1, released: 1 });
    assert.deepEqual(f.renderer.shadowMap, { autoUpdate: true, needsUpdate: true });
    assert.deepEqual(f.camera.children, [f.gun]);
    assert.equal(f.gun.visible, false);
    assert.equal(f.graphics.weapons.size, 6);
    const counts = [f.graphics.geometries.size, f.graphics.materials.size, f.graphics.textures.size];
    f.graphics.weaponTemplate = () => { throw new Error('template generated during equip'); };
    for (let i = 0; i < 6; i++) {
      const first = f.graphics.createWeapon(i), second = f.graphics.createWeapon(i);
      const part = i === 3 ? 'blade' : 'action';
      assert.notEqual(first.getObjectByName(part), second.getObjectByName(part));
      first.getObjectByName(part).position.y = 0.5;
      assert.notEqual(second.getObjectByName(part).position.y, 0.5);
    }
    assert.equal(f.graphics.createWeapon(5).getObjectByName('rocket-exhaust').visible, false);
    assert.deepEqual([f.graphics.geometries.size, f.graphics.materials.size, f.graphics.textures.size], counts);
    await f.game.prepareResources();
    assert.equal(f.stats().rendered, 1);
  } finally { f.cleanup(); }
});

test('H1 and G18C share the same finish and grain without allocating duplicate textures', () => {
  const graphics = new Graphics();
  try {
    const pistol = graphics.createWeapon(0), finish = graphics.pistolMaterials;
    const textures = graphics.textures.size;
    const g18c = graphics.createWeapon(4);
    assert.equal(graphics.pistolMaterials, finish);
    assert.equal(graphics.textures.size, textures);
    for (const model of [pistol, g18c]) {
      const materials = new Set();
      model.traverse((object) => { if (object.isMesh) materials.add(object.material); });
      for (const material of Object.values(finish)) assert.ok(materials.has(material));
    }
    assert.equal(finish.frame.roughnessMap, finish.grip.roughnessMap);
  } finally { graphics.dispose(); }
});

test('preparation errors restore state and remain rejected instead of silently enabling start', async () => {
  for (const failure of ['compile', 'render']) {
    const f = fixture(failure);
    try {
      const pending = f.game.prepareResources();
      await assert.rejects(pending, new RegExp(`${failure} failed`));
      assert.equal(f.game.prepareResources(), pending);
      assert.equal(f.stats().target, f.previousTarget);
      assert.deepEqual(f.renderer.shadowMap, { autoUpdate: true, needsUpdate: true });
      assert.equal(f.gun.visible, false);
      assert.deepEqual(f.camera.children, [f.gun]);
      assert.equal(f.stats().released, failure === 'render' ? 1 : 0);
    } finally { f.cleanup(); }
  }
});

test('disposing before preparation starts prevents later resource creation and rendering', async () => {
  const f = fixture();
  try {
    const pending = f.game.prepareResources();
    f.game.disposed = true;
    await assert.rejects(pending, /disposed/);
    await assert.rejects(f.game.prepareResources(), /disposed/);
    assert.equal(f.graphics.weapons.size, 0);
    assert.equal(f.stats().compiled, 0);
    assert.equal(f.stats().rendered, 0);
  } finally { f.cleanup(); }
});

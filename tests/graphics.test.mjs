import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Graphics } from '../lib/graphics.ts';

function triangles(root) {
  let result = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh)
      result +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  return result;
}
test('scenery batching preserves collision raycasts and transforms while reducing draw submissions', () => {
  const g = new Graphics(),
    scene = new T.Scene(),
    material = new T.MeshStandardMaterial(),
    walls = [];
  for (let i = 0; i < 20; i++) {
    const m = new T.Mesh(g.box, material);
    m.position.set(i * 2, 0, -5);
    scene.add(m);
    if (i === 0) walls.push(m);
  }
  const ray = new T.Raycaster(new T.Vector3(0, 0, 0), new T.Vector3(0, 0, -1));
  scene.updateMatrixWorld(true);
  const distance = ray.intersectObjects(walls)[0].distance;
  const stats = g.batchScenery(scene, walls);
  scene.updateMatrixWorld(true);
  assert.deepEqual(stats, { before: 20, after: 1 });
  assert.equal(ray.intersectObjects(walls)[0].distance, distance);
  const batch = scene.children.find((o) => o instanceof T.InstancedMesh);
  assert.equal(batch.count, 20);
  assert.equal(ray.intersectObject(batch)[0].distance, distance);
  batch.dispose();
  material.dispose();
  g.dispose();
});
test('enemy models preserve headshot targets, independent animation joints, and bounded mesh complexity', () => {
  const g = new Graphics();
  for (let kind = 0; kind < 4; kind++) {
    const a = g.createEnemy(kind),
      b = g.createEnemy(kind);
    a.root.updateMatrixWorld(true);
    const ray = new T.Raycaster(
      new T.Vector3(0, 1.8 * a.root.scale.y, 4),
      new T.Vector3(0, 0, -1),
    );
    const hit = ray.intersectObjects(a.parts)[0];
    assert.ok(hit);
    assert.equal(hit.object.userData.hitZone, 'head');
    a.arms[0].rotation.x = 0.8;
    assert.ok(b.arms[0].rotation.x === 0);
    assert.equal(a.head.geometry, b.head.geometry);
    if (kind === 2) {
      assert.equal(a.chainsaw.parent, a.elbows[1]);
      assert.equal(a.sawChain.children.length, 2);
      a.sawChain.children[0].visible = false;
      assert.equal(b.sawChain.children[0].visible, true);
      a.sawChain.children[0].visible = true;
    } else {
      assert.equal(a.chainsaw, undefined);
    }
    assert.equal(Boolean(a.blade), kind === 1);
    assert.equal(Boolean(a.drill), kind === 3);
    if (kind === 3) {
      assert.equal(a.drill.parent, a.elbows[1]);
      assert.equal(a.drillBit.parent, a.drill);
      assert.equal(a.drillBitLeft.parent.parent, a.elbows[0]);
      const rotation = b.drillBit.rotation.y;
      a.drillBit.rotation.y += 1;
      assert.equal(b.drillBit.rotation.y, rotation);
      const rotLeft = b.drillBitLeft.rotation.y;
      a.drillBitLeft.rotation.y += 1;
      assert.equal(b.drillBitLeft.rotation.y, rotLeft);
      a.rageIndicator.visible = true;
      assert.equal(b.rageIndicator.visible, false);
    }
    // The chainsaw keeps one alternate tooth mesh hidden between animation frames.
    let visibleParts = 0;
    a.root.traverseVisible((o) => { if (o instanceof T.Mesh) visibleParts++; });
    assert.ok(visibleParts <= 30);
    assert.ok(a.parts.length <= (a.chainsaw ? 31 : 30));
    assert.ok(triangles(a.root) < 14000);
  }
  g.dispose();
});
test('weapon variants keep moving mechanisms and reuse resources across repeated switches', () => {
  const g = new Graphics();
  for (let i = 0; i < 6; i++) {
    const gun = g.createWeapon(i);
    assert.ok(gun.getObjectByName(i === 3 ? 'blade' : 'action'));
    assert.equal(Boolean(gun.getObjectByName('scope')), i === 2);
    assert.equal(Boolean(gun.getObjectByName('bolt-hand')), i === 2);
    assert.ok(triangles(gun) < 12000);
  }
  const resources = [g.geometries.size, g.materials.size, g.textures.size];
  for (let i = 0; i < 36; i++) g.createWeapon(i % 6);
  assert.deepEqual(
    [g.geometries.size, g.materials.size, g.textures.size],
    resources,
  );
  g.dispose();
});

test('G18C machine pistol features extended magazine, selector switch, and compensator ports', () => {
  const g = new Graphics();
  const gun = g.createWeapon(4);
  const action = gun.getObjectByName('action');
  assert.ok(action);
  assert.ok(gun.getObjectByName('extended-mag'));
  assert.ok(action.getObjectByName('selector'), 'selector switch must be mounted to reciprocating slide');
  assert.ok(action.getObjectByName('compensator'), 'compensator ports must be cut into slide');
  assert.equal(action.getObjectByName('extended-mag'), undefined, 'magazine is inserted into grip frame, not slide');
  assert.equal(Boolean(gun.getObjectByName('scope')), false);
  assert.equal(Boolean(gun.getObjectByName('bolt-hand')), false);
  assert.ok(triangles(gun) < 12000);
  g.dispose();
});

test('RPG and flying rockets clone cached resources with independent loaded round and exhaust visibility', () => {
  const g = new Graphics();
  const launcher = g.createWeapon(5), rocket = g.createRocket();
  assert.ok(launcher.getObjectByName('loaded-rocket'));
  assert.equal(launcher.getObjectByName('rocket-exhaust').visible, false);
  assert.equal(rocket.getObjectByName('rocket-exhaust').visible, true);
  assert.ok(triangles(rocket) < 2500);
  const counts = [g.geometries.size, g.materials.size, g.textures.size];
  launcher.getObjectByName('loaded-rocket').visible = false;
  for (let i = 0; i < 20; i++) {
    assert.equal(g.createWeapon(5).getObjectByName('loaded-rocket').visible, true);
    assert.equal(g.createRocket().getObjectByName('rocket-exhaust').visible, true);
  }
  assert.deepEqual([g.geometries.size, g.materials.size, g.textures.size], counts);
  g.dispose();
});

test('Bloat, Crawler and Husk keep headshot targets and their distinct anatomy', () => {
  const g = new Graphics();
  for (const kind of [4, 5, 6]) {
    const e = g.createEnemy(kind);
    e.root.updateMatrixWorld(true);
    const target = new T.Box3().setFromObject(e.neck).getCenter(new T.Vector3());
    const ray = new T.Raycaster(target.clone().add(new T.Vector3(0, 0, 4)), new T.Vector3(0, 0, -1));
    assert.equal(ray.intersectObjects(e.parts)[0]?.object.userData.hitZone, 'head');
    assert.ok(triangles(e.root) < 14000);
    if (kind === 4) assert.ok(e.root.getObjectByName('bile-sac'));
    if (kind === 6) {
      assert.ok(e.root.getObjectByName('cannon'));
      assert.ok(e.root.getObjectByName('fuel-tank'));
      assert.ok(e.cannonMuzzle);
      assert.equal(e.cannonCharge.visible, false);
      e.cannonCharge.visible = true;
      const clone = g.createEnemy(6);
      assert.equal(clone.cannonCharge.visible, false, 'charging does not light up other Husks');
      assert.ok(e.cannonMuzzle.getWorldPosition(new T.Vector3()).z > 0.8);
    }
    if (kind === 5) {
      assert.equal(e.legs.length, 0);
      assert.equal(e.knees.length, 0);
      assert.ok(new T.Box3().setFromObject(e.root).max.y < 1.2);
    }
  }
  g.dispose();
});

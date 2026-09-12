import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EnemyMaterials } from '../lib/enemy-materials.ts';
import { Graphics } from '../lib/graphics.ts';

function fixture() {
  const requests = [];
  const fallback = {
    map: new T.Texture(), normalMap: new T.Texture(), roughnessMap: new T.Texture(),
  };
  const materials = new EnemyMaterials(() => fallback, {
    load(url, onLoad, _progress, onError) {
      const texture = new T.Texture();
      requests.push({ url, texture, finish: () => onLoad(texture), fail: onError });
      return texture;
    },
  });
  return { materials, requests, fallback };
}

test('enemy textures load once and replace complete sets without affecting fallback materials', () => {
  const { materials, requests, fallback } = fixture();
  materials.preload();
  const skin = materials.surface('pale-skin');
  const bruised = materials.surface('pale-skin', 0xaa8888, 'wet');
  const oldColor = skin.color.clone();
  assert.equal(skin.map, fallback.map);
  assert.equal(requests.length, 21);
  requests[0].finish();
  requests[1].finish();
  assert.equal(skin.map, fallback.map, 'partial sets must not replace the fallback');
  requests[2].finish();
  assert.equal(skin.map, requests[0].texture);
  assert.equal(skin.map, bruised.map, 'tints share GPU textures');
  assert.equal(skin.normalMap, bruised.normalMap);
  assert.equal(skin.color.getHex(), 0xffffff);
  assert.equal(bruised.color.getHex(), 0xaa8888);
  assert.notDeepEqual(skin.color, oldColor);
  assert.equal(skin.map.colorSpace, T.SRGBColorSpace);
  assert.equal(skin.normalMap.colorSpace, T.NoColorSpace);
  assert.equal(skin.map.wrapS, T.RepeatWrapping);
  assert.equal(skin.normalMap.wrapT, T.RepeatWrapping);
  for (const request of requests.slice(3)) request.finish();
  for (let i = 0; i < 50; i++) {
    materials.preload();
    assert.equal(materials.surface('pale-skin'), skin);
  }
  assert.equal(requests.length, 21);
  assert.equal(materials.textures.size, 21);
  materials.dispose();
});

test('a failed texture set retains the fallback and does not retry or leak on later spawns', () => {
  const { materials, requests, fallback } = fixture();
  const skin = materials.surface('pale-skin');
  const color = skin.color.clone();
  let disposed = 0;
  requests.forEach(({ texture }) => texture.addEventListener('dispose', () => disposed++));
  requests[0].finish();
  requests[1].fail(new Error('unavailable'));
  requests[2].finish();
  assert.equal(disposed, 3);
  assert.equal(materials.textures.size, 0);
  assert.equal(skin.map, fallback.map);
  assert.deepEqual(skin.color, color);
  materials.surface('pale-skin', 0xaa8888);
  assert.equal(requests.length, 3);
  materials.dispose();
  assert.equal(disposed, 3);
});

test('late image callbacks cannot revive a disposed scene or dispose borrowed fallback textures', () => {
  const { materials, requests, fallback } = fixture();
  const skin = materials.surface('pale-skin');
  const color = skin.color.clone();
  let disposed = 0, fallbackDisposed = 0;
  requests.forEach(({ texture }) => texture.addEventListener('dispose', () => disposed++));
  fallback.map.addEventListener('dispose', () => fallbackDisposed++);
  materials.dispose();
  requests.forEach((request) => request.finish());
  requests[1].fail(new Error('late failure'));
  materials.dispose();
  assert.equal(disposed, 3);
  assert.equal(fallbackDisposed, 0);
  assert.equal(skin.map, fallback.map);
  assert.deepEqual(skin.color, color);
  assert.equal(materials.materials.size, 0);
  assert.equal(materials.textures.size, 0);
});

test('all seven enemy appearances keep bounded geometry cost and share resources across waves', () => {
  const g = new Graphics();
  const budgets = [
    [21, 4624], [23, 4768], [28, 8500], [28, 6132],
    [24, 5184], [14, 3968], [28, 5488],
  ];
  const player = g.createWeapon(0);
  for (let kind = 0; kind < 7; kind++) {
    const a = g.createEnemy(kind), b = g.createEnemy(kind);
    let draws = 0, triangles = 0;
    a.root.traverseVisible((o) => {
      if (!(o instanceof T.Mesh)) return;
      draws++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    assert.ok(draws <= budgets[kind][0], `kind ${kind}: ${draws} draw submissions`);
    assert.ok(triangles <= budgets[kind][1], `kind ${kind}: ${triangles} triangles`);
    assert.equal(a.head.material, b.head.material);
  }
  const resources = [g.geometries.size, g.enemyMaterials.materials.size, g.enemyMaterials.textures.size];
  for (let i = 0; i < 70; i++) g.createEnemy(i % 7);
  assert.deepEqual([g.geometries.size, g.enemyMaterials.materials.size, g.enemyMaterials.textures.size], resources);
  player.traverse((o) => {
    if (o instanceof T.Mesh) assert.ok(!o.material.name.startsWith('enemy/'));
  });
  g.dispose();
});

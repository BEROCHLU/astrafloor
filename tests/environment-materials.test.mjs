import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EnvironmentMaterials, environmentBoxGeometry } from '../lib/environment-materials.ts';

function fixture() {
  const requests = [];
  const fallback = { map: new T.Texture(), normalMap: new T.Texture(), roughnessMap: new T.Texture() };
  const materials = new EnvironmentMaterials(() => fallback, {
    load(url, onLoad, _progress, onError) {
      const texture = new T.Texture();
      requests.push({ url, texture, finish: () => onLoad(texture), fail: onError });
      return texture;
    },
  });
  return { materials, requests, fallback };
}

test('arena surfaces share complete local texture sets and respect the device filtering limit', () => {
  const { materials, requests, fallback } = fixture();
  materials.preload(4);
  const floor = materials.surface('floor'), wall = materials.surface('wall');
  requests[0].finish();
  requests[1].finish();
  assert.equal(floor.map, fallback.map);
  requests[2].finish();
  assert.equal(floor.map, requests[0].texture);
  assert.equal(wall.map, fallback.map);
  requests.slice(3).forEach((request) => request.finish());
  materials.preload(32);
  assert.equal(materials.surface('wall'), wall);
  assert.equal(requests.length, 6);
  for (const { url, texture } of requests) {
    assert.ok(url.startsWith('/textures/environment/'));
    assert.equal(texture.anisotropy, 8);
    assert.equal(texture.wrapS, T.RepeatWrapping);
  }
  materials.preload(2);
  assert.equal(floor.map.anisotropy, 2);
  assert.equal(floor.map.colorSpace, T.SRGBColorSpace);
  assert.equal(floor.normalMap.colorSpace, T.NoColorSpace);
  assert.equal(wall.roughnessMap.colorSpace, T.NoColorSpace);
  materials.dispose();
});

test('failed sets and late callbacks retain fallback surfaces without leaking or reviving textures', () => {
  const { materials, requests, fallback } = fixture();
  materials.preload();
  const floor = materials.surface('floor'), wall = materials.surface('wall');
  let disposed = 0, fallbackDisposed = 0, materialDisposed = 0;
  requests.forEach(({ texture }) => texture.addEventListener('dispose', () => disposed++));
  fallback.map.addEventListener('dispose', () => fallbackDisposed++);
  floor.addEventListener('dispose', () => materialDisposed++);
  requests[0].finish();
  requests[1].fail(new Error('missing image'));
  requests[2].finish();
  assert.equal(floor.map, fallback.map);
  assert.equal(disposed, 3);
  materials.preload();
  assert.equal(requests.length, 6);
  materials.dispose();
  requests.slice(3).forEach((request) => request.finish());
  requests[4].fail(new Error('late error'));
  materials.dispose();
  materials.preload();
  assert.equal(wall.map, fallback.map);
  assert.equal(disposed, 6);
  assert.equal(materialDisposed, 1);
  assert.equal(fallbackDisposed, 0);
  assert.equal(materials.textures.size, 0);
});

test('meter-scaled UVs keep wall streaks upright without changing collision geometry', () => {
  const original = new T.BoxGeometry(1, 1, 1);
  for (const [kind, size] of [
    ['floor', new T.Vector3(64, 0.5, 64)],
    ['wall', new T.Vector3(66, 12, 2)],
    ['wall', new T.Vector3(2, 12, 64)],
  ]) {
    const geometry = environmentBoxGeometry(size, kind);
    assert.deepEqual(geometry.attributes.position.array, original.attributes.position.array);
    assert.deepEqual(geometry.index.array, original.index.array);
    if (kind === 'wall') {
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        if (geometry.attributes.normal.getY(i)) continue;
        const y = geometry.attributes.position.getY(i);
        assert.equal(geometry.attributes.uv.getY(i), (y + 0.5) * 3);
      }
    }
    geometry.dispose();
  }
  original.dispose();
});

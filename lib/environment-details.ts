import * as T from 'three';
import type { Graphics } from './graphics.ts';

type Mask = 'wet' | 'dust' | 'runoff' | 'base';

// Shared, soft-edged masks add large-scale variation independently of the tiled concrete.
function weatherMask(kind: Mask) {
  const size = 256, data = new Uint8Array(size * size * 4);
  const smooth = T.MathUtils.smoothstep;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const px = u * 2 - 1, py = v * 2 - 1;
      const angle = Math.atan2(py, px), radius = Math.hypot(px, py);
      const grain = (Math.sin(x * 1.73 + y * 7.13) * Math.sin(x * 6.17 - y * 2.31) + 1) / 2;
      const cloud = (Math.sin(u * 19 + Math.sin(v * 13)) * Math.cos(v * 17 - u * 3) + 1) / 2;
      const boundary = 0.72 + Math.sin(angle * 3 + 0.7) * 0.09
        + Math.sin(angle * 5 - 1.4) * 0.065 + Math.sin(angle * 9 + 2.2) * 0.035;
      let alpha = 1 - smooth(radius, boundary - 0.2, boundary);
      if (kind === 'wet') alpha *= 0.88 + cloud * 0.12;
      if (kind === 'dust') {
        const crack = Math.abs(px - 0.15 * Math.sin(v * 11) - 0.08 * Math.sin(v * 27));
        alpha *= 0.18 + cloud * 0.5 + (1 - smooth(crack, 0.005, 0.018)) * 0.45;
      }
      if (kind === 'runoff') {
        const stripe = Math.pow((Math.sin(u * 91 + Math.sin(u * 33) * 3) + 1) / 2, 5);
        const bottom = 0.05 + (Math.sin(u * 63) + 1) * 0.23;
        alpha = stripe * smooth(v, bottom, bottom + 0.22)
          * (1 - smooth(v, 0.85, 1)) * smooth(u, 0, 0.1) * (1 - smooth(u, 0.9, 1));
      }
      if (kind === 'base') {
        alpha = Math.pow(1 - v, 2.3) * (0.35 + cloud * 0.5)
          * (1 - smooth(v, 0.5 + cloud * 0.2, 0.95));
      }
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(Math.min(1, alpha * (0.9 + grain * 0.1)) * 255);
    }
  }
  const texture = new T.DataTexture(data, size, size);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function addEnvironmentDetails(scene: T.Scene, graphics: Graphics) {
  const group = new T.Group();
  group.name = 'Concrete weathering';
  scene.add(group);
  const transform = new T.Object3D();
  let seed = 0x713f42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const batch = (kind: Mask, count: number, color: number, opacity: number) => {
    const material = graphics.material(new T.MeshStandardMaterial({
      map: graphics.texture(weatherMask(kind)), color, transparent: true, opacity,
      metalness: 0, roughness: kind === 'wet' ? 0.28 : 1,
      envMapIntensity: kind === 'wet' ? 0.55 : 1,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    }));
    material.name = `environment/${kind}`;
    const mesh = new T.InstancedMesh(graphics.plane, material, count);
    mesh.name = `Concrete ${kind}`;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const floorLayer = (kind: 'wet' | 'dust', count: number) => {
    const mesh = batch(kind, count, kind === 'wet' ? 0x586762 : 0x4c5146, kind === 'wet' ? 0.44 : 0.22);
    for (let i = 0; i < count; i++) {
      transform.position.set((random() - 0.5) * 56, kind === 'wet' ? 0.015 : 0.012, (random() - 0.5) * 56);
      transform.rotation.set(-Math.PI / 2, 0, random() * Math.PI * 2);
      const width = kind === 'wet' ? 1.5 + random() * 5 : 3 + random() * 6;
      transform.scale.set(width, width * (0.35 + random() * 0.65), 1);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    }
    mesh.computeBoundingSphere();
  };
  floorLayer('dust', 18);
  floorLayer('wet', 24);

  const streaks = batch('runoff', 24, 0x42473b, 0.22);
  const base = batch('base', 4, 0x393f35, 0.32);
  for (let side = 0; side < 4; side++) {
    const wallTransform = (along: number, height: number) => {
      transform.rotation.set(0, side * Math.PI / 2, 0);
      if (side === 0) transform.position.set(along, height, -30.986);
      if (side === 1) transform.position.set(-30.986, height, -along);
      if (side === 2) transform.position.set(-along, height, 30.986);
      if (side === 3) transform.position.set(30.986, height, along);
    };
    wallTransform(0, 0.9);
    transform.scale.set(62, 1.8, 1);
    transform.updateMatrix();
    base.setMatrixAt(side, transform.matrix);
    for (let i = 0; i < 6; i++) {
      const height = 2 + random() * 3;
      const top = [11.95, 7.8, 5.2][i % 3];
      wallTransform(-25 + i * 10 + (random() - 0.5) * 2, top - height / 2);
      transform.scale.set(2 + random() * 3, height, 1);
      transform.updateMatrix();
      streaks.setMatrixAt(side * 6 + i, transform.matrix);
    }
  }
  streaks.computeBoundingSphere();
  base.computeBoundingSphere();
}

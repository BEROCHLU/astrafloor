import * as T from 'three';
import type { Graphics } from './graphics.ts';

/** Body from rpg7.jpg. The existing sights, hands and loaded round remain in Graphics. */
export function createRPGBody(g: Graphics, root: T.Group) {
  const maps = g.createMaps('metal');
  const metal = (color: number, roughness: number) => g.material(new T.MeshStandardMaterial({
    color, metalness: 0.72, roughness,
    normalMap: maps.normalMap, normalScale: new T.Vector2(0.045, 0.045),
  }));
  const steel = metal(0x303332, 0.53);
  const band = metal(0x242826, 0.64);
  const edge = metal(0x626761, 0.48);
  const dark = g.material(new T.MeshStandardMaterial({ color: 0x0c100e, roughness: 0.94 }));

  // Fine, irregular longitudinal grain replaces the old cloth material on the wood.
  const width = 256, height = 512;
  const albedo = new Uint8Array(width * height * 4);
  const relief = new Float32Array(width * height);
  const normals = new Uint8Array(width * height * 4);
  const roughness = new Uint8Array(width * height * 4);
  const noise = (x: number, y: number, period: number) => {
    const hash = (a: number, b: number) => {
      let n = Math.imul((a % period + period) % period, 374761393) ^ Math.imul(b, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const ix = Math.floor(x), iy = Math.floor(y);
    const dx = x - ix, dy = y - iy;
    const u = dx * dx * (3 - 2 * dx), v = dy * dy * (3 - 2 * dy);
    return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
      T.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width, v = y / height, i = y * width + x, j = i * 4;
      const warp = Math.sin(v * 18 + Math.sin(u * Math.PI * 6)) * 0.7;
      const grain = noise(u * 96 + warp, v * 32, 96);
      const cloud = noise(u * 18, v * 28, 18);
      const fine = noise(u * 128, v * 256, 128);
      const pore = Math.max(0, 0.38 - grain);
      const value = 0.78 + cloud * 0.25 + grain * 0.17 + (fine - 0.5) * 0.14 - pore * 0.6;
      albedo[j] = Math.min(255, 228 * value);
      albedo[j + 1] = Math.min(255, 133 * value);
      albedo[j + 2] = Math.min(255, 65 * value);
      albedo[j + 3] = 255;
      relief[i] = grain * 0.1 + fine * 0.045 - pore * 0.2;
      roughness[j] = roughness[j + 1] = roughness[j + 2] = 173 + grain * 35;
      roughness[j + 3] = 255;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 4;
      const dx = relief[y * width + (x + 1) % width] - relief[y * width + (x - 1 + width) % width];
      const dy = relief[Math.min(height - 1, y + 1) * width + x]
        - relief[Math.max(0, y - 1) * width + x];
      const length = Math.hypot(dx, dy, 1);
      normals[j] = (0.5 - dx / length * 0.5) * 255;
      normals[j + 1] = (0.5 - dy / length * 0.5) * 255;
      normals[j + 2] = (0.5 + 0.5 / length) * 255;
      normals[j + 3] = 255;
    }
  }
  const texture = (data: Uint8Array, color = false) => {
    const t = g.texture(new T.DataTexture(data, width, height, T.RGBAFormat));
    t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    t.wrapS = T.RepeatWrapping;
    t.wrapT = T.ClampToEdgeWrapping;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };
  const wood = g.material(new T.MeshStandardMaterial({
    map: texture(albedo, true), normalMap: texture(normals), roughnessMap: texture(roughness),
    normalScale: new T.Vector2(0.45, 0.3), metalness: 0, roughness: 0.92,
  }));
  const gripWood = g.material(wood.clone());
  gripWood.color.setHex(0xa48568);
  const part = (name: string) => {
    const group = new T.Group(); group.name = name; root.add(group); return group;
  };
  const box = (p: T.Object3D, mat: T.Material, x: number, y: number, z: number,
    w: number, h: number, d: number) => g.mesh(p, g.box, mat, x, y, z, w, h, d);
  // Profiles use [radius, z]; rotate the lathe's axis into the launcher's axis.
  const turned = (p: T.Object3D, mat: T.Material, profile: number[][], segments = 32) => {
    const geom = g.geometry(new T.LatheGeometry(profile.map(([r, z]) => new T.Vector2(r, z)), segments));
    geom.rotateX(Math.PI / 2);
    return g.mesh(p, geom, mat, 0, 0, 0, 1, 1, 1);
  };
  const tube = part('rpg-body-tube');
  turned(tube, steel, [[0.057, -0.91], [0.069, -0.91], [0.073, -0.902],
    [0.073, 0.37], [0.061, 0.37], [0.057, -0.91]]);
  turned(tube, dark, [[0.056, -0.909], [0.057, -0.909], [0.057, -0.66], [0.056, -0.66]]);
  // An open, smoothly flared rear bell with visible wall thickness and a rolled rim.
  turned(tube, steel, [[0.073, 0.30], [0.076, 0.36], [0.087, 0.415],
    [0.108, 0.485], [0.139, 0.575], [0.148, 0.601], [0.149, 0.612],
    [0.145, 0.62], [0.135, 0.62], [0.132, 0.601], [0.098, 0.49],
    [0.076, 0.412], [0.063, 0.355], [0.061, 0.30], [0.073, 0.30]]);

  const jacket = part('rpg-wood-jacket');
  turned(jacket, wood, [[0.073, -0.463], [0.081, -0.451], [0.085, -0.425],
    [0.085, 0.269], [0.082, 0.298], [0.073, 0.316]]);
  for (const side of [-1, 1])
    box(jacket, dark, side * 0.059, -0.061, -0.07, 0.002, 0.002, 0.72);
  const clamps = part('rpg-jacket-bands');
  for (const [z, radius, span] of [[-0.454, 0.085, 0.026], [-0.053, 0.09, 0.018], [0.303, 0.087, 0.035]]) {
    turned(clamps, band, [[radius - 0.006, z - span / 2], [radius, z - span / 2],
      [radius + 0.002, z - span / 2 + 0.004], [radius + 0.002, z + span / 2 - 0.004],
      [radius, z + span / 2], [radius - 0.006, z + span / 2]], 16);
  }
  turned(tube, band, [[0.073, -0.795], [0.079, -0.79], [0.079, -0.71], [0.073, -0.703]], 16);
  turned(tube, band, [[0.073, -0.573], [0.079, -0.565], [0.079, -0.476], [0.073, -0.465]], 16);

  const grips = part('rpg-wood-grips');
  for (const z of [-0.05, -0.52]) {
    box(grips, band, 0, -0.084, z, 0.074, 0.045, 0.117);
    const outline = new T.Shape();
    outline.moveTo(-0.045, 0); outline.lineTo(0.046, 0);
    outline.lineTo(0.029, -0.179); outline.lineTo(0.011, -0.195);
    outline.lineTo(-0.035, -0.191); outline.lineTo(-0.059, -0.02); outline.closePath();
    const geom = g.geometry(new T.ExtrudeGeometry(outline, {
      depth: 0.066, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004,
      bevelSegments: 2, steps: 1,
    }));
    // Wood grain follows the handle vertically on both broad side faces.
    const uv = geom.getAttribute('uv'), position = geom.getAttribute('position');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (position.getX(i) + 0.064) / 0.115, -position.getY(i) / 0.2);
    geom.rotateY(Math.PI / 2); geom.translate(-0.033, -0.09, z);
    g.mesh(grips, geom, gripWood, 0, 0, 0, 1, 1, 1);
    for (const side of [-1, 1]) {
      const screw = g.mesh(grips, g.cylinder, edge, side * 0.039, -0.157, z, 0.012, 0.004, 0.012);
      screw.rotation.z = Math.PI / 2;
      box(grips, dark, side * 0.0415, -0.157, z, 0.001, 0.002, 0.008);
    }
  }
  // Thin trigger guard, kept within the existing hand poses.
  box(grips, band, 0, -0.14, -0.608, 0.024, 0.103, 0.012);
  box(grips, band, 0, -0.187, -0.573, 0.024, 0.012, 0.08);
  box(grips, steel, 0, -0.132, -0.568, 0.012, 0.054, 0.012).rotation.x = -0.3;
}

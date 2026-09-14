import * as T from 'three';
import type { Graphics } from './graphics.ts';

/** Dark, clean pistol body. Sights are supplied unchanged by Graphics. */
export function createH1Body(g: Graphics, root: T.Group, action: T.Group) {
  // Fine polymer grain, without the large cloth weave and stains of the shared tiles.
  const size = 128, pixels = new Uint8Array(size * size * 4);
  let seed = 41;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 225 + (seed >>> 28);
    pixels.set([value, value, value, 255], i * 4);
  }
  const grain = g.texture(new T.DataTexture(pixels, size, size));
  grain.wrapS = grain.wrapT = T.RepeatWrapping;
  grain.magFilter = T.LinearFilter;
  grain.minFilter = T.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  const finish = (color: number, metalness: number, roughness: number, textured = false) =>
    g.material(new T.MeshStandardMaterial({
      color, metalness, roughness, envMapIntensity: 0.35,
      ...(textured ? { roughnessMap: grain, bumpMap: grain, bumpScale: 0.00015 } : {}),
    }));
  const slide = finish(0x292a2e, 0.35, 0.77);
  const frame = finish(0x19191a, 0.02, 0.92, true);
  const grip = finish(0x111112, 0, 0.98, true);
  const hardware = finish(0x303033, 0.4, 0.78);
  const recess = finish(0x080809, 0, 1);
  const box = (p: T.Object3D, m: T.Material, x: number, y: number, z: number,
    w: number, h: number, d: number) => g.mesh(p, g.box, m, x, y, z, w, h, d);
  const profile = (p: T.Object3D, m: T.Material, points: number[][], width: number) => {
    const outline = new T.Shape();
    points.forEach(([z, y], i) => i ? outline.lineTo(-z, y) : outline.moveTo(-z, y));
    outline.closePath();
    const geometry = g.geometry(new T.ExtrudeGeometry(outline, {
      depth: width, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002,
      bevelSegments: 1, steps: 1, curveSegments: 1,
    }));
    geometry.rotateY(Math.PI / 2); geometry.translate(-width / 2, 0, 0);
    return g.mesh(p, geometry, m, 0, 0, 0, 1, 1, 1);
  };
  // Chamfered slide keeps the existing top height and sight alignment.
  const section = new T.Shape();
  section.moveTo(-0.055, -0.015);
  section.lineTo(0.055, -0.015); section.lineTo(0.055, 0.086);
  section.lineTo(0.043, 0.108); section.lineTo(-0.043, 0.108);
  section.lineTo(-0.055, 0.086); section.closePath();
  const slideGeometry = g.geometry(new T.ExtrudeGeometry(section, {
    depth: 0.416, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001,
    bevelSegments: 1, steps: 1, curveSegments: 1,
  }));
  slideGeometry.translate(0, 0, -0.44);
  g.mesh(action, slideGeometry, slide, 0, 0, 0, 1, 1, 1);
  box(action, recess, 0, 0.037, -0.022, 0.087, 0.081, 0.002);
  box(action, hardware, 0, -0.005, -0.02, 0.089, 0.012, 0.006);
  // Dark serrations replace the conspicuous silver bars.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      box(action, recess, side * 0.056, 0.042, -0.072 - i * 0.012,
        0.002, 0.082, 0.005);
    }
    box(root, hardware, side * 0.057, -0.042, -0.14, 0.005, 0.013, 0.038);
  }
  box(action, recess, 0.0555, 0.073, -0.26, 0.002, 0.03, 0.067);
  box(action, hardware, 0.035, 0.109, -0.26, 0.036, 0.002, 0.067);
  const muzzle = g.mesh(root, g.cylinder, hardware, 0, 0.034, -0.446, 0.051, 0.018, 0.051);
  muzzle.rotation.x = Math.PI / 2;
  const bore = g.mesh(root, g.cylinder, recess, 0, 0.034, -0.456, 0.033, 0.001, 0.033);
  bore.rotation.x = Math.PI / 2;
  profile(root, frame, [[-0.421, -0.022], [-0.027, -0.022], [-0.025, -0.091],
    [-0.13, -0.105], [-0.19, -0.07], [-0.405, -0.066]], 0.109);
  profile(root, frame, [[-0.115, -0.075], [-0.024, -0.072], [0.042, -0.31],
    [0.017, -0.331], [-0.078, -0.31], [-0.099, -0.166]], 0.101);
  profile(root, grip, [[-0.028, -0.104], [-0.012, -0.106], [0.039, -0.303],
    [0.016, -0.313], [-0.011, -0.276]], 0.103);
  profile(root, grip, [[-0.078, -0.312], [0.042, -0.313], [0.046, -0.331],
    [-0.079, -0.333]], 0.113);
  // Open trigger guard, with a recessed curved trigger.
  profile(root, frame, [[-0.211, -0.063], [-0.198, -0.067], [-0.197, -0.167],
    [-0.087, -0.168], [-0.081, -0.183], [-0.213, -0.181]], 0.035);
  profile(root, hardware, [[-0.165, -0.067], [-0.15, -0.067], [-0.142, -0.123],
    [-0.154, -0.145], [-0.173, -0.144], [-0.158, -0.125]], 0.013);
  return { slide, frame, grip, hardware, recess };
}

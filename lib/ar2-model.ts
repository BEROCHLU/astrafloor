import * as T from 'three';
import type { Graphics } from './graphics.ts';

/** Faceted, dark polymer rifle reconstructed from the user's rear-quarter reference. */
export function createAR2Body(g: Graphics, root: T.Group, action: T.Group) {
  const maps = g.createMaps('metal');
  const finish = (color: number, metalness: number, roughness: number) =>
    g.material(new T.MeshStandardMaterial({
      color, metalness, roughness,
      normalMap: maps.normalMap, normalScale: new T.Vector2(0.055, 0.055),
    }));
  const steel = finish(0x292e2d, 0.72, 0.57);
  const cover = finish(0x353b39, 0.65, 0.5);
  const edge = finish(0x515955, 0.75, 0.45);
  const polymer = finish(0x252a27, 0.05, 0.86);
  const rubber = finish(0x151a18, 0.01, 0.95);
  const recess = g.material(new T.MeshBasicMaterial({ color: 0x080c0b }));
  const part = (name: string) => {
    const group = new T.Group(); group.name = name; root.add(group); return group;
  };
  const box = (p: T.Object3D, m: T.Material, x: number, y: number, z: number,
    w: number, h: number, d: number) => g.mesh(p, g.box, m, x, y, z, w, h, d);
  // Side profiles are authored as [longitudinal position, height], then extruded across the rifle.
  const profile = (p: T.Object3D, m: T.Material, outline: number[][], width: number, x = 0) => {
    const shape = new T.Shape();
    outline.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
    shape.closePath();
    const geom = g.geometry(new T.ExtrudeGeometry(shape, {
      depth: width, bevelEnabled: true, bevelSize: 0.003,
      bevelThickness: 0.003, bevelSegments: 1, steps: 1, curveSegments: 1,
    }));
    geom.rotateY(Math.PI / 2); geom.translate(x - width / 2, 0, 0);
    return g.mesh(p, geom, m, 0, 0, 0, 1, 1, 1);
  };
  const barrel = (p: T.Object3D, m: T.Material, y: number, z: number,
    length: number, diameter: number) => {
    const mesh = g.mesh(p, g.cylinder, m, 0, y, z, diameter, length, diameter);
    mesh.rotation.x = Math.PI / 2; return mesh;
  };
  // A chamfered cross section gives the long stamped cover a crisp, sloping upper edge.
  const receiver = part('ar2-receiver');
  profile(receiver, steel, [[0.025, 0.038], [-0.48, 0.038], [-0.5, -0.073],
    [-0.33, -0.103], [-0.13, -0.103], [-0.07, -0.16], [0.027, -0.12]], 0.125);
  const section = new T.Shape();
  section.moveTo(-0.07, -0.035); section.lineTo(0.07, -0.035);
  section.lineTo(0.07, 0.051); section.lineTo(0.045, 0.094);
  section.lineTo(-0.045, 0.094); section.lineTo(-0.07, 0.051); section.closePath();
  const coverGeometry = g.geometry(new T.ExtrudeGeometry(section, {
    depth: 0.47, bevelEnabled: false, steps: 1,
  }));
  g.mesh(receiver, coverGeometry, cover, 0, 0, -0.455, 1, 1, 1);
  for (const side of [-1, 1]) {
    box(receiver, edge, side * 0.064, 0.055, -0.225, 0.006, 0.009, 0.435);
    box(receiver, rubber, side * 0.071, -0.01, -0.21, 0.003, 0.007, 0.43);
    for (const z of [-0.405, -0.355, -0.105, -0.012]) {
      const pin = g.mesh(receiver, g.cylinder, edge, side * 0.067, -0.066, z, 0.014, 0.006, 0.014);
      pin.rotation.z = Math.PI / 2;
    }
  }
  box(receiver, recess, 0.072, 0.008, -0.27, 0.005, 0.045, 0.17);
  box(action, steel, 0.076, 0.007, -0.25, 0.012, 0.032, 0.14);
  box(action, edge, 0.102, 0.013, -0.19, 0.055, 0.019, 0.028);
  box(action, steel, 0.129, 0.013, -0.19, 0.023, 0.025, 0.047);
  // Rear cover latch and its horizontal grooves are prominent in the supplied view.
  box(receiver, rubber, 0, 0.044, 0.02, 0.044, 0.034, 0.009);
  for (let i = 0; i < 5; i++)
    box(receiver, edge, 0, 0.032 + i * 0.005, 0.026, 0.035, 0.002, 0.004);
  profile(receiver, steel, [[-0.06, -0.018], [-0.33, -0.055], [-0.34, -0.073],
    [-0.07, -0.045]], 0.008, 0.073);

  const fore = part('ar2-handguard');
  profile(fore, polymer, [[-0.46, 0.025], [-0.7, 0.014], [-0.73, -0.023],
    [-0.7, -0.087], [-0.49, -0.105], [-0.46, -0.066]], 0.145);
  barrel(fore, steel, 0.042, -0.615, 0.285, 0.066);
  for (const z of [-0.48, -0.708]) barrel(fore, steel, 0.012, z, 0.026, 0.095);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -0.5 - i * 0.034;
      box(fore, recess, side * 0.074, -0.018, z, 0.003, 0.018, 0.02);
      box(fore, cover, side * 0.074, -0.064, z, 0.005, 0.041, 0.007);
    }
    box(fore, steel, side * 0.073, -0.09, -0.586, 0.007, 0.008, 0.21);
  }
  const muzzle = part('ar2-barrel');
  barrel(muzzle, steel, -0.002, -0.827, 0.245, 0.038);
  barrel(muzzle, cover, -0.002, -0.937, 0.076, 0.055);
  barrel(muzzle, edge, -0.002, -0.975, 0.01, 0.058);
  barrel(muzzle, recess, -0.002, -0.981, 0.002, 0.038);
  for (const side of [-1, 1])
    box(muzzle, recess, side * 0.027, 0, -0.948, 0.002, 0.018, 0.027);

  // Half-height sight posts keep their mounting bases; the front tip sets the y=.106 ADS line.
  const sights = part('ar2-sights');
  box(sights, steel, 0, 0.077, -0.424, 0.083, 0.036, 0.092);
  box(sights, edge, 0, 0.098, -0.399, 0.075, 0.008, 0.104);
  for (const side of [-1, 1]) {
    box(sights, steel, side * 0.025875, 0.1095, -0.35, 0.01725, 0.015, 0.016);
    box(sights, edge, side * 0.04, 0.08, -0.41, 0.008, 0.025, 0.027);
  }
  box(sights, steel, 0, 0.04, -0.838, 0.034, 0.081, 0.035);
  box(sights, steel, 0, 0.085, -0.838, 0.058, 0.012, 0.026);
  for (const side of [-1, 1]) {
    const ear = box(sights, steel, side * 0.024, 0.101, -0.838, 0.009, 0.024, 0.022);
    ear.rotation.z = side * -0.16;
  }
  box(sights, edge, 0, 0.099, -0.838, 0.006, 0.014, 0.009);

  const magazine = part('ar2-magazine');
  profile(magazine, polymer, [[-0.32, -0.087], [-0.195, -0.087], [-0.199, -0.19],
    [-0.226, -0.315], [-0.281, -0.455], [-0.31, -0.485], [-0.389, -0.467],
    [-0.399, -0.438], [-0.351, -0.3], [-0.326, -0.184]], 0.077);
  for (const side of [-1, 1]) {
    profile(magazine, steel, [[-0.301, -0.14], [-0.219, -0.14], [-0.246, -0.31],
      [-0.302, -0.445], [-0.366, -0.434], [-0.326, -0.294]], 0.003, side * 0.04);
    for (let i = 0; i < 3; i++) {
      const z = -0.235 - i * 0.023;
      profile(magazine, rubber, [[z, -0.17], [z - 0.005, -0.17], [z - 0.027, -0.3],
        [z - 0.077, -0.428], [z - 0.07, -0.429], [z - 0.02, -0.3]], 0.002, side * 0.044);
    }
  }
  profile(magazine, rubber, [[-0.389, -0.456], [-0.298, -0.474], [-0.307, -0.491],
    [-0.398, -0.473]], 0.087);
  box(receiver, edge, 0, -0.125, -0.173, 0.033, 0.04, 0.023);

  const grip = part('ar2-grip');
  profile(grip, polymer, [[-0.088, -0.094], [-0.008, -0.105], [0.045, -0.339],
    [0.026, -0.362], [-0.053, -0.35], [-0.08, -0.23]], 0.082);
  for (const side of [-1, 1])
    box(grip, rubber, side * 0.043, -0.24, -0.02, 0.003, 0.13, 0.024).rotation.x = 0.18;
  // Hollow trigger guard, with an independent curved trigger inside the opening.
  profile(grip, steel, [[-0.18, -0.103], [-0.175, -0.193], [-0.077, -0.196],
    [-0.071, -0.18], [-0.16, -0.18], [-0.166, -0.105]], 0.026);
  profile(grip, edge, [[-0.125, -0.104], [-0.134, -0.139], [-0.12, -0.165],
    [-0.112, -0.162], [-0.123, -0.135], [-0.116, -0.104]], 0.014);

  const stock = part('ar2-stock');
  box(stock, steel, 0, -0.068, 0.055, 0.113, 0.106, 0.072);
  profile(stock, polymer, [[0.057, -0.016], [0.151, -0.031], [0.35, -0.09],
    [0.377, -0.118], [0.368, -0.277], [0.319, -0.28], [0.163, -0.153],
    [0.07, -0.123]], 0.113);
  profile(stock, cover, [[0.083, -0.021], [0.153, -0.036], [0.333, -0.088],
    [0.326, -0.111], [0.14, -0.065], [0.083, -0.053]], 0.12);
  for (const side of [-1, 1]) {
    profile(stock, rubber, [[0.148, -0.087], [0.318, -0.13], [0.318, -0.233],
      [0.164, -0.131]], 0.003, side * 0.058);
    box(stock, steel, side * 0.063, -0.089, 0.107, 0.012, 0.042, 0.036);
    box(stock, recess, side * 0.07, -0.089, 0.107, 0.003, 0.025, 0.019);
  }
  profile(stock, rubber, [[0.35, -0.087], [0.383, -0.115], [0.378, -0.285],
    [0.356, -0.286]], 0.127);
}

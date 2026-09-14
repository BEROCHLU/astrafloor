import * as T from 'three';
import type { Graphics } from './graphics.ts';

/** Emaciated, restrained silhouette with an independently animated jaw and throat. */
export function createSirenModel(g: Graphics): T.Group {
  const root = new T.Group();
  const skin = g.enemyMaterials.surface('pale-skin', 0xe8ded0);
  const flesh = g.enemyMaterials.surface('exposed-muscle', 0xb89a8b);
  const cavity = g.material(new T.MeshStandardMaterial({ color: 0x160d10, roughness: 1 }));
  const metal = g.enemyMaterials.surface('corroded-metal', 0x666b70, 'paint');
  const hair = g.material(new T.MeshStandardMaterial({ color: 0x160e10, roughness: 0.94 }));
  const teeth = g.material(new T.MeshStandardMaterial({ color: 0xc6bca2, roughness: 0.85 }));
  const red = g.material(new T.MeshBasicMaterial({ color: 0xff3030 }));
  const sphere = g.geometry(new T.SphereGeometry(0.5, 8, 5));
  const skull = g.geometry(new T.SphereGeometry(0.5, 12, 8));
  const joint = (p: T.Object3D, name: string, x: number, y: number, z: number) => {
    const node = new T.Group(); node.name = name; node.position.set(x, y, z); p.add(node); return node;
  };
  const shape = (p: T.Object3D, geom: T.BufferGeometry, mat: T.Material,
    x: number, y: number, z: number, w: number, h: number, d: number) =>
    g.mesh(p, geom, mat, x, y, z, w, h, d);

  const torso = joint(root, 'torso', 0, 1.03, 0);
  shape(torso, skull, flesh, 0, 0.30, 0, 0.38, 0.57, 0.22);
  shape(torso, sphere, skin, 0, 0.06, 0, 0.25, 0.33, 0.19);
  shape(torso, sphere, skin, 0, -0.065, 0, 0.32, 0.22, 0.23);
  shape(torso, g.taper, skin, 0, 0.28, 0.119, 0.025, 0.40, 0.025);
  for (const side of [-1, 1]) {
    shape(torso, sphere, skin, side * 0.13, 0.52, 0.045, 0.26, 0.07, 0.14).rotation.z = side * -0.2;
    for (let rib = 0; rib < 6; rib++) {
      shape(torso, sphere, skin, side * 0.088, 0.45 - rib * 0.054, 0.102,
        0.17 - rib * 0.008, 0.029, 0.047).rotation.z = side * (0.1 + rib * 0.06);
    }
    shape(torso, g.box, metal, side * 0.165, 0.37, 0.145, 0.044, 0.48, 0.034).rotation.z = side * 0.08;
    shape(torso, sphere, flesh, side * 0.055, 0.08, 0.095, 0.065, 0.23, 0.026).rotation.z = side * -0.2;
  }
  shape(torso, g.box, metal, 0, 0.30, 0.15, 0.37, 0.045, 0.045);
  shape(torso, g.box, metal, 0, -0.005, 0.125, 0.40, 0.065, 0.05);
  shape(torso, g.taper, metal, 0, -0.12, 0.125, 0.085, 0.22, 0.045);

  const neck = joint(torso, 'neck', 0, 0.60, 0.01);
  shape(neck, g.taper, skin, 0, -0.035, 0, 0.105, 0.19, 0.115);
  shape(neck, skull, skin, 0, 0.14, 0, 0.265, 0.34, 0.245);
  shape(neck, sphere, cavity, 0, 0.01, 0.112, 0.14, 0.145, 0.006);
  shape(neck, g.taper, skin, 0, 0.145, 0.135, 0.037, 0.082, 0.05).rotation.x = 0.2;
  shape(neck, sphere, hair, 0, 0.257, -0.037, 0.282, 0.15, 0.265);
  for (const side of [-1, 1]) {
    shape(neck, sphere, cavity, side * 0.067, 0.175, 0.106, 0.074, 0.060, 0.006).rotation.y = side * 0.35;
    shape(neck, g.taper, hair, side * 0.048, 0.275, 0.071, 0.10, 0.016, 0.10).rotation.z = side * -0.15;
    shape(neck, sphere, skin, side * 0.091, 0.085, 0.096, 0.070, 0.070, 0.060);
    shape(neck, sphere, skin, side * 0.066, 0.218, 0.111, 0.092, 0.025, 0.032).rotation.z = side * 0.13;
    for (let strand = 0; strand < 5; strand++) {
      const length = 0.35 + (strand % 3) * 0.067;
      const x = side * (0.13 + Math.sin(strand * 1.3) * 0.016);
      const z = 0.048 - strand * 0.036;
      shape(neck, g.taper, hair, x, 0.22 - length / 2, z, 0.039, length, 0.029).rotation.z = side * -0.06;
      shape(neck, g.cone, hair, x + side * 0.013, 0.195 - length, z, 0.035, 0.09, 0.021).rotation.z = Math.PI;
    }
  }
  for (let strand = -2; strand <= 2; strand++) {
    shape(neck, g.taper, hair, strand * 0.044, -0.017, -0.12, 0.048, 0.48 + strand * 0.015, 0.035);
  }
  const jaw = joint(neck, 'siren-jaw', 0, 0.029, 0.079);
  shape(jaw, sphere, skin, 0, -0.096, 0.043, 0.164, 0.058, 0.111);
  for (const side of [-1, 1])
    shape(jaw, sphere, flesh, side * 0.065, -0.045, 0.044, 0.03, 0.11, 0.05).rotation.z = side * -0.15;
  for (let tooth = -2; tooth <= 2; tooth++) {
    shape(neck, g.box, teeth, tooth * 0.022, 0.063, 0.145, 0.016, 0.027, 0.015);
    shape(jaw, g.box, teeth, tooth * 0.022, -0.069, 0.084, 0.015, 0.023, 0.017);
  }
  const throat = joint(neck, 'siren-throat', 0, -0.075, 0.064);
  shape(throat, sphere, red, 0, 0, 0, 0.042, 0.080, 0.025);
  throat.visible = false;

  for (const side of [-1, 1]) {
    const arm = joint(torso, `arm${side}`, side * 0.245, 0.49, 0);
    arm.rotation.z = side * 0.18;
    shape(arm, sphere, skin, 0, -0.018, 0, 0.15, 0.19, 0.17);
    shape(arm, g.taper, skin, 0, -0.17, 0, 0.10, 0.32, 0.105);
    const elbow = joint(arm, `elbow${side}`, 0, -0.33, 0);
    shape(elbow, sphere, skin, 0, 0, 0, 0.094, 0.092, 0.09);
    shape(elbow, g.taper, skin, 0, -0.14, 0, 0.087, 0.28, 0.078);
    shape(elbow, g.box, metal, 0, -0.225, 0, 0.11, 0.060, 0.10);
    shape(elbow, g.box, metal, side * 0.08, -0.21, 0, 0.35, 0.017, 0.022);
    shape(elbow, g.box, metal, side * 0.16, -0.21, 0, 0.015, 0.16, 0.018);
    shape(elbow, sphere, skin, 0, -0.315, 0.013, 0.105, 0.14, 0.055);
    for (let finger = 0; finger < 4; finger++) {
      const x = (finger - 1.5) * 0.026;
      const length = 0.115 - Math.abs(finger - 1.5) * 0.016;
      shape(elbow, g.taper, skin, x, -0.387, 0.038, 0.022, length, 0.025).rotation.x = -0.48;
      shape(elbow, g.taper, skin, x, -0.433, 0.046, 0.019, 0.053, 0.021).rotation.x = 0.65;
    }
    shape(elbow, g.taper, skin, side * 0.065, -0.324, 0.027, 0.025, 0.11, 0.03).rotation.z = side * 0.65;
    const leg = joint(root, `leg${side}`, side * 0.104, 0.98, 0);
    shape(leg, sphere, skin, 0, -0.21, 0, 0.17, 0.49, 0.20);
    const knee = joint(leg, `knee${side}`, 0, -0.46, 0);
    shape(knee, sphere, skin, 0, 0, 0.021, 0.098, 0.11, 0.115);
    shape(knee, g.taper, skin, 0, -0.21, 0, 0.105, 0.42, 0.12);
    shape(knee, sphere, skin, 0, -0.465, 0.052, 0.12, 0.10, 0.235);
    for (let toe = 0; toe < 3; toe++)
      shape(knee, sphere, skin, (toe - 1) * 0.032, -0.478, 0.154, 0.034, 0.043, 0.060);
  }
  g.mergeParts(root);
  return root;
}

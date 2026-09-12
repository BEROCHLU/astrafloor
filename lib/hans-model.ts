import * as T from 'three';
import type { Graphics } from './graphics.ts';

export type HansRig = {
  rifles: T.Group[];
  holsters: T.Group[];
  muzzles: T.Group[];
  flashes: T.Group[];
  reactor: T.Group;
};

/** Pale exosuit, respirator, green life-support hoses and needle claws from the reference. */
export function createHansModel(g: Graphics) {
  const root = new T.Group();
  const skin = g.enemyMaterials.surface('pale-skin', 0xc2c6a7);
  const black = g.enemyMaterials.surface('dirty-cloth', 0x343b37);
  const steel = g.enemyMaterials.surface('corroded-metal', 0x626d66);
  const straps = g.enemyMaterials.surface('dirty-cloth', 0x6e3534);
  const bone = g.enemyMaterials.surface('corroded-metal', 0xcbd0b4, 'paint');
  const wood = g.enemyMaterials.surface('dirty-cloth', 0x76533b);
  const green = g.material(new T.MeshStandardMaterial({
    color: 0xafff31, emissive: 0x81e914, emissiveIntensity: 1.8, roughness: 0.3,
  }));
  const flash = g.material(new T.MeshBasicMaterial({ color: 0xffd98c }));
  const joint = (parent: T.Object3D, name: string, x: number, y: number, z: number) => {
    const group = new T.Group(); group.name = name; group.position.set(x, y, z);
    parent.add(group); return group;
  };
  const shape = (p: T.Object3D, geom: T.BufferGeometry, mat: T.Material,
    x: number, y: number, z: number, w: number, h: number, d: number) =>
    g.mesh(p, geom, mat, x, y, z, w, h, d);
  const tube = (parent: T.Object3D, a: T.Vector3, b: T.Vector3, radius: number, mat: T.Material) => {
    const center = a.clone().add(b).multiplyScalar(0.5), delta = b.clone().sub(a);
    const mesh = shape(parent, g.cylinder, mat, center.x, center.y, center.z, radius * 2, delta.length(), radius * 2);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  };
  const torso = joint(root, 'torso', 0, 1, 0);
  shape(torso, g.sphere, skin, 0, 0.34, 0, 0.62, 0.77, 0.37);
  shape(torso, g.taper, skin, 0, 0.04, 0, 0.4, 0.38, 0.29);
  shape(torso, g.rounded, black, 0, -0.13, 0, 0.46, 0.22, 0.32);
  shape(torso, g.rounded, straps, 0, 0.32, 0.18, 0.065, 0.76, 0.035);
  // Backpack tank and reinforced frame.
  const pack = joint(torso, 'hans-backpack', 0, 0.33, -0.29);
  shape(pack, g.rounded, steel, 0, 0, 0, 0.48, 0.77, 0.23);
  shape(pack, g.rounded, green, 0, 0, -0.13, 0.22, 0.51, 0.035);
  for (const side of [-1, 1]) {
    shape(pack, g.rounded, black, side * 0.215, 0, -0.1, 0.07, 0.8, 0.1);
    shape(torso, g.rounded, steel, side * 0.34, 0.65, -0.13, 0.13, 0.26, 0.17).rotation.z = side * -0.25;
    for (let rib = 0; rib < 4; rib++)
      shape(torso, g.taper, bone, side * 0.145, 0.48 - rib * 0.065, 0.175, 0.24, 0.028, 0.045).rotation.z = side * 0.16;
    tube(torso, new T.Vector3(side * 0.22, 0.59, 0.12), new T.Vector3(side * 0.1, 0.22, 0.235), 0.021, green);
    tube(torso, new T.Vector3(side * 0.1, 0.22, 0.235), new T.Vector3(side * 0.22, -0.08, 0.15), 0.021, green);
    shape(torso, g.rounded, steel, side * 0.2, -0.12, 0.15, 0.17, 0.09, 0.08);
  }
  const reactor = joint(torso, 'hans-reactor', 0, 0.32, 0.225);
  shape(reactor, g.rounded, straps, 0, 0, 0, 0.21, 0.29, 0.095);
  shape(reactor, g.rounded, green, 0, 0, 0.055, 0.12, 0.2, 0.045);
  const neck = joint(torso, 'neck', 0, 0.68, 0.015);
  shape(neck, g.taper, skin, 0, 0.03, 0, 0.14, 0.19, 0.14);
  shape(neck, g.sphere, skin, 0, 0.2, 0, 0.3, 0.4, 0.29);
  shape(neck, g.rounded, bone, 0, 0.32, 0.016, 0.31, 0.13, 0.28);
  shape(neck, g.rounded, black, 0, 0.1, 0.145, 0.21, 0.2, 0.15);
  shape(neck, g.cylinder, steel, 0, 0.07, 0.25, 0.11, 0.11, 0.11).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    shape(neck, g.rounded, black, side * 0.17, 0.21, 0, 0.085, 0.21, 0.2);
    shape(neck, g.rounded, green, side * 0.207, 0.22, 0, 0.018, 0.11, 0.12);
    shape(neck, g.rounded, straps, side * 0.065, 0.23, 0.134, 0.09, 0.057, 0.055);
    shape(neck, g.rounded, green, side * 0.065, 0.23, 0.165, 0.045, 0.018, 0.013);
    const arm = joint(torso, `arm${side}`, side * 0.35, 0.53, 0);
    shape(arm, g.sphere, skin, 0, -0.035, 0, 0.23, 0.3, 0.25);
    shape(arm, g.taper, skin, 0, -0.2, 0, 0.18, 0.34, 0.2);
    shape(arm, g.rounded, straps, 0, -0.14, 0, 0.245, 0.11, 0.24);
    const elbow = joint(arm, `elbow${side}`, 0, -0.37, 0);
    shape(elbow, g.taper, skin, 0, -0.16, 0, 0.16, 0.32, 0.18);
    shape(elbow, g.rounded, straps, 0, -0.31, 0, 0.23, 0.11, 0.21);
    shape(elbow, g.rounded, steel, side * 0.09, -0.13, 0, 0.075, 0.35, 0.12);
    shape(elbow, g.sphere, skin, 0, -0.4, 0.04, 0.18, 0.2, 0.1);
    for (let finger = 0; finger < 3; finger++) {
      const x = (finger - 1) * 0.056;
      shape(elbow, g.taper, bone, x, -0.5, 0.055, 0.035, 0.19, 0.038);
      shape(elbow, g.taper, green, x, -0.65, 0.09, 0.016, 0.17, 0.018).rotation.x = -0.18;
    }
    // MKb42-style silhouette: wood stock, stamped receiver, curved magazine, long barrel.
    const rifle = joint(elbow, `hans-rifle${side}`, 0, -0.39, 0.06);
    shape(rifle, g.rounded, steel, 0, 0, 0.04, 0.09, 0.12, 0.39);
    shape(rifle, g.rounded, wood, 0, -0.005, -0.28, 0.07, 0.12, 0.28);
    shape(rifle, g.rounded, black, 0, -0.14, 0.06, 0.065, 0.27, 0.12).rotation.x = -0.17;
    shape(rifle, g.rounded, wood, 0, 0, 0.29, 0.07, 0.08, 0.22);
    shape(rifle, g.cylinder, steel, 0, 0.015, 0.5, 0.03, 0.33, 0.03).rotation.x = Math.PI / 2;
    shape(rifle, g.box, steel, 0, 0.07, 0.61, 0.035, 0.075, 0.025);
    const muzzle = joint(rifle, `hans-muzzle${side}`, 0, 0.015, 0.69);
    const muzzleFlash = joint(muzzle, `hans-flash${side}`, 0, 0, 0);
    shape(muzzleFlash, g.sphere, flash, 0, 0, 0.1, 0.16, 0.16, 0.32);
    muzzleFlash.visible = false;
    g.mergeParts(rifle);
    rifle.traverse((o) => { if (o instanceof T.Mesh) o.userData.noHit = true; });
    const holster = rifle.clone(true);
    holster.name = `hans-holster${side}`;
    // Remove duplicated animated muzzle names before adding the holstered model.
    holster.remove(holster.children.find((child) => child.name === `hans-muzzle${side}`)!);
    holster.position.set(side * 0.34, -0.07, -0.19);
    holster.rotation.x = Math.PI / 2;
    torso.add(holster);
    rifle.visible = false;
    const leg = joint(root, `leg${side}`, side * 0.16, 0.83, 0);
    shape(leg, g.taper, black, 0, -0.2, 0, 0.24, 0.43, 0.28);
    shape(leg, g.rounded, steel, side * 0.04, -0.19, 0.135, 0.19, 0.25, 0.065);
    const knee = joint(leg, `knee${side}`, 0, -0.41, 0);
    shape(knee, g.taper, black, 0, -0.16, 0, 0.2, 0.34, 0.22);
    shape(knee, g.rounded, steel, 0, -0.02, 0.12, 0.24, 0.16, 0.075);
    shape(knee, g.rounded, black, 0, -0.32, 0.04, 0.24, 0.15, 0.36);
    shape(knee, g.rounded, straps, side * 0.07, -0.15, 0, 0.09, 0.27, 0.25);
  }
  g.mergeParts(root);
  root.scale.setScalar(1.25);
  return root;
}

export function bindHansRig(root: T.Group): HansRig {
  const groups = (name: string) => [-1, 1].map((side) => root.getObjectByName(`${name}${side}`) as T.Group);
  return {
    rifles: groups('hans-rifle'), holsters: groups('hans-holster'),
    muzzles: groups('hans-muzzle'), flashes: groups('hans-flash'),
    reactor: root.getObjectByName('hans-reactor') as T.Group,
  };
}

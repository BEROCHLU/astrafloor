import * as T from 'three';
import type { Graphics } from './graphics.ts';

/**
 * KF1 Bloat Model:
 * - Morbidly obese silhouette with Wheat skin color #f5deb3.
 * - Sagging breasts (man-boobs) overlapping the upper abdomen with discolored areolas.
 * - Enormous pendulous protruding belly (bile-sac) sagging over the thighs.
 * - Inflamed rash stains and glowing yellow bile boils / pustules on lower belly and right shin.
 * - Swollen bald skull, fat folds, double chin, grimacing mouth with jagged teeth, glowing sunken eyes.
 * - Short, thick splayed arms holding dual butcher meat cleavers.
 * - Short tree-trunk legs with bare stubby feet.
 */
export function createBloatModel(g: Graphics): T.Group {
  const root = new T.Group();
  const materials = g.enemyMaterials;

  // Wheat skin color #f5deb3
  const skin = materials.surface('bloated-skin', 0xf5deb3);
  const stain = materials.surface('exposed-muscle', 0x783630, 'wet');
  const darkFlesh = materials.surface('exposed-muscle', 0x281c1c, 'wet');
  const pustule = g.material(
    new T.MeshStandardMaterial({
      color: 0xd8cf64,
      emissive: 0x484618,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
  );
  const eyeGlint = g.material(new T.MeshBasicMaterial({ color: 0xd44020 }));
  const teeth = g.material(
    new T.MeshStandardMaterial({ color: 0xb5a787, roughness: 0.85 }),
  );
  const cleaverMetal = materials.surface('corroded-metal', 0x9fa4a2);
  const cleaverHandle = materials.surface('dirty-cloth', 0x453528);

  const sphere = g.geometry(new T.SphereGeometry(0.5, 8, 5));

  const joint = (
    parent: T.Object3D,
    name: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const group = new T.Group();
    group.name = name;
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  };

  const shape = (
    p: T.Object3D,
    geom: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => g.mesh(p, geom, mat, x, y, z, w, h, d);

  // 1. Torso
  const torso = joint(root, 'torso', 0, 0.93, 0);
  shape(torso, sphere, skin, 0, 0.35, -0.04, 1.25, 1.15, 0.85);

  // Massive pendulous breasts (man-boobs)
  for (const side of [-1, 1]) {
    const breast = shape(
      torso,
      sphere,
      skin,
      side * 0.26,
      0.44,
      0.32,
      0.48,
      0.4,
      0.38,
    );
    breast.rotation.z = side * -0.12;
    // Dark areolas / chafing stains
    shape(torso, sphere, stain, side * 0.27, 0.38, 0.48, 0.11, 0.08, 0.04);
    shape(torso, sphere, stain, side * 0.32, 0.56, 0.3, 0.16, 0.12, 0.06);
  }

  // 2. Belly (Bile Sac)
  const sac = joint(torso, 'bile-sac', 0, 0, 0);
  shape(sac, sphere, skin, 0, 0.1, 0.18, 1.32, 1.25, 1.05);
  shape(sac, sphere, skin, 0, -0.06, 0.35, 1.18, 1.05, 0.85);
  shape(sac, sphere, skin, 0, -0.22, 0.28, 0.95, 0.65, 0.65);

  // Inflamed rash stains on lower belly
  shape(sac, sphere, stain, 0, -0.08, 0.62, 0.75, 0.65, 0.25);
  shape(sac, sphere, stain, 0.22, 0.08, 0.58, 0.38, 0.35, 0.15);
  shape(sac, sphere, stain, -0.25, -0.15, 0.52, 0.42, 0.38, 0.18);

  // Yellow bile pustules / boils
  shape(sac, sphere, pustule, -0.18, 0.12, 0.68, 0.045, 0.052, 0.035);
  shape(sac, sphere, pustule, -0.15, 0.04, 0.72, 0.035, 0.04, 0.03);
  shape(sac, sphere, pustule, 0.12, -0.04, 0.72, 0.055, 0.062, 0.038);
  shape(sac, sphere, pustule, 0.24, -0.14, 0.64, 0.04, 0.048, 0.032);
  shape(sac, sphere, pustule, -0.05, -0.18, 0.7, 0.048, 0.055, 0.035);
  shape(sac, sphere, pustule, 0.08, -0.22, 0.66, 0.038, 0.044, 0.03);

  // 3. Neck & Head
  const neck = joint(torso, 'neck', 0, 0.68, 0.035);
  // Neck fat folds & double chin
  shape(neck, g.rounded, skin, 0, 0.01, 0.06, 0.45, 0.14, 0.32);
  shape(neck, g.rounded, skin, 0, 0.08, 0.1, 0.38, 0.12, 0.28);
  shape(neck, sphere, skin, 0, 0.14, 0.06, 0.48, 0.38, 0.42);

  // Swollen bald skull
  shape(neck, sphere, skin, 0, 0.28, 0.02, 0.42, 0.48, 0.42);
  shape(neck, sphere, skin, 0, 0.38, 0.0, 0.35, 0.38, 0.36);

  // Brow ridge
  shape(neck, g.rounded, darkFlesh, 0, 0.32, 0.17, 0.32, 0.06, 0.1);
  shape(neck, g.rounded, skin, 0, 0.33, 0.19, 0.08, 0.08, 0.06);

  // Eye sockets & eyes
  for (const side of [-1, 1]) {
    shape(neck, sphere, darkFlesh, side * 0.1, 0.28, 0.18, 0.09, 0.07, 0.05);
    shape(neck, sphere, eyeGlint, side * 0.1, 0.28, 0.2, 0.025, 0.02, 0.018);
    shape(neck, sphere, skin, side * 0.18, 0.18, 0.12, 0.18, 0.22, 0.18); // cheeks
    shape(neck, sphere, skin, side * 0.24, 0.26, 0.0, 0.06, 0.12, 0.08); // ears
  }
  shape(neck, g.taper, skin, 0, 0.22, 0.21, 0.09, 0.09, 0.09); // nose

  // Grimacing mouth & jagged teeth
  shape(neck, g.rounded, darkFlesh, 0, 0.14, 0.2, 0.24, 0.08, 0.06);
  for (let i = -1; i <= 1; i++) {
    shape(neck, g.box, teeth, i * 0.045, 0.155, 0.22, 0.03, 0.035, 0.02);
  }

  // 4. Arms & Meat Cleavers
  for (const side of [-1, 1]) {
    const arm = joint(torso, `arm${side}`, side * 0.62, 0.52, 0);
    arm.rotation.z = side * 0.45;
    shape(arm, sphere, skin, 0, 0, 0, 0.42, 0.38, 0.38);
    shape(arm, g.taper, skin, 0, -0.2, 0, 0.34, 0.42, 0.32);

    const elbow = joint(arm, `elbow${side}`, 0, -0.38, 0);
    shape(elbow, sphere, skin, 0, -0.12, 0.02, 0.28, 0.34, 0.26);
    shape(elbow, sphere, skin, 0, -0.34, 0.04, 0.22, 0.2, 0.18);
    shape(elbow, g.box, skin, 0, -0.38, 0.08, 0.18, 0.14, 0.12);

    // Meat Cleaver Handle
    const handle = shape(
      elbow,
      g.cylinder,
      cleaverHandle,
      0,
      -0.38,
      0.08,
      0.05,
      0.36,
      0.05,
    );
    handle.rotation.x = Math.PI / 2;

    // Meat Cleaver Blade (broad rectangular steel blade & bolster)
    shape(elbow, g.box, cleaverMetal, 0, -0.42, 0.28, 0.025, 0.28, 0.38);
    shape(elbow, g.box, cleaverMetal, 0, -0.28, 0.26, 0.035, 0.04, 0.36);
  }

  // 5. Legs & Feet
  for (const side of [-1, 1]) {
    const leg = joint(root, `leg${side}`, side * 0.28, 0.74, 0);
    shape(leg, g.taper, skin, 0, -0.18, 0, 0.44, 0.46, 0.44);

    const knee = joint(leg, `knee${side}`, 0, -0.38, 0);
    shape(knee, sphere, skin, 0, -0.1, 0.02, 0.34, 0.36, 0.34);
    shape(knee, g.taper, skin, 0, -0.22, 0.02, 0.3, 0.32, 0.3);
    shape(knee, sphere, skin, 0, -0.36, 0.1, 0.32, 0.16, 0.36);
    for (let t = -2; t <= 2; t++) {
      shape(knee, sphere, skin, t * 0.035, -0.42, 0.25, 0.045, 0.045, 0.06);
    }

    // Inflamed rash & pustules on right leg (side === 1) as in KF1 reference
    if (side === 1) {
      shape(knee, sphere, stain, 0.05, -0.15, 0.16, 0.18, 0.24, 0.08);
      shape(knee, sphere, pustule, 0.06, -0.12, 0.2, 0.035, 0.038, 0.025);
      shape(knee, sphere, pustule, 0.02, -0.19, 0.19, 0.03, 0.035, 0.022);
    }
  }

  g.mergeParts(root);
  return root;
}

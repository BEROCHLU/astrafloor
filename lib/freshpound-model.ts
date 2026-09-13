import * as T from 'three';
import type { Graphics } from './graphics.ts';

/**
 * KF1 Freshpound Model:
 * - Massive muscular hulk silhouette (scale 2x) with pale pinkish raw muscle/skin.
 * - Metal visor / blindfold over the eyes with vertical head straps and exposed snarling teeth.
 * - Central chest siren housing with radiating metal rib clamps and rage indicator.
 * - Dual massive spiked meat grinder gauntlets (pounders) on both forearms.
 *   (Right forearm contains 'drill' and rotating 'drill-bit').
 * - Metal bone brackets and staples on shoulders, hips, knees, and shins.
 */
export function createFreshpoundModel(g: Graphics): T.Group {
  const root = new T.Group();
  const materials = g.enemyMaterials;

  // Muscular pale-pinkish flesh with bruising
  const skin = materials.surface('pale-skin', 0xd6a194);
  const darkFlesh = materials.surface('exposed-muscle', 0x4a2422, 'wet');
  const metal = materials.surface('corroded-metal', 0x766e66, 'paint');
  const steel = materials.surface('corroded-metal', 0xa49e96);
  const teeth = g.material(
    new T.MeshStandardMaterial({ color: 0xb5a787, roughness: 0.85 }),
  );
  const sirenCalm = materials.surface('corroded-metal', 0xf5b355, 'paint');
  const sirenRage = g.material(new T.MeshBasicMaterial({ color: 0xff2010 }));

  const sphere = g.geometry(new T.SphereGeometry(0.5, 8, 6));

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
  // Massive muscular chest & back
  shape(torso, sphere, skin, 0, 0.38, 0, 0.98, 0.72, 0.54);
  shape(torso, g.taper, skin, 0, 0.12, 0, 0.62, 0.44, 0.44);

  // Pectorals & shoulder implants
  for (const side of [-1, 1]) {
    shape(torso, sphere, skin, side * 0.22, 0.44, 0.18, 0.44, 0.32, 0.26);
    shape(torso, g.box, metal, side * 0.36, 0.62, 0.05, 0.14, 0.035, 0.08);
    shape(torso, g.box, metal, side * 0.28, 0.64, -0.06, 0.12, 0.035, 0.08);
  }

  // Abdominals & groin
  shape(torso, sphere, skin, 0, 0.04, 0.08, 0.58, 0.42, 0.38);
  shape(torso, sphere, skin, 0, -0.16, 0, 0.58, 0.32, 0.42);

  // Pelvic girdle / metal hip bracket clamps
  shape(torso, g.box, metal, 0, -0.18, 0.18, 0.36, 0.05, 0.06);
  for (const side of [-1, 1]) {
    const hipClamp = shape(
      torso,
      g.box,
      metal,
      side * 0.22,
      -0.15,
      0.14,
      0.05,
      0.14,
      0.06,
    );
    hipClamp.rotation.z = side * 0.45;
  }

  // Chest Siren & Rib Clamps
  for (const side of [-1, 1]) {
    for (let r = 0; r < 4; r++) {
      const bar = shape(
        torso,
        g.box,
        metal,
        side * (0.16 + r * 0.035),
        0.52 - r * 0.07,
        0.26,
        0.18,
        0.026,
        0.04,
      );
      bar.rotation.z = side * -0.22;
    }
    shape(torso, sphere, darkFlesh, side * 0.22, 0.42, 0.24, 0.32, 0.24, 0.06);
  }

  // Triangular central chest plate housing
  shape(torso, g.cylinder, metal, 0, 0.42, 0.28, 0.26, 0.12, 0.18);
  shape(torso, g.box, metal, 0, 0.34, 0.29, 0.18, 0.14, 0.08);
  // Calm amber siren core
  shape(torso, sphere, sirenCalm, 0, 0.42, 0.32, 0.13, 0.13, 0.04);

  // Enraged pulsing red siren indicator (required node name)
  const rage = joint(torso, 'rage-indicator', 0, 0.42, 0.33);
  shape(rage, sphere, sirenRage, 0, 0, 0, 0.18, 0.18, 0.05);
  rage.visible = false;

  // 2. Head & Visor
  const neck = joint(torso, 'neck', 0, 0.76, 0.02);
  // Muscular neck folds & trapezius
  shape(neck, g.taper, skin, 0, 0.02, 0, 0.28, 0.24, 0.28);
  // Muscular jaw & skull
  shape(neck, sphere, skin, 0, 0.18, 0.02, 0.42, 0.44, 0.42);
  shape(neck, sphere, skin, 0, 0.28, 0.01, 0.36, 0.38, 0.38); // crown
  shape(neck, g.rounded, skin, 0, 0.08, 0.14, 0.24, 0.18, 0.18); // chin/jaw

  // Visor Blindfold & metal straps
  shape(neck, g.box, metal, 0, 0.22, 0.195, 0.34, 0.08, 0.07);
  shape(neck, g.box, metal, 0, 0.28, 0.14, 0.06, 0.22, 0.18); // over forehead & scalp
  shape(neck, g.box, metal, 0, 0.08, 0.19, 0.05, 0.12, 0.05); // chin strap
  shape(neck, sphere, darkFlesh, 0, 0.22, 0.16, 0.28, 0.07, 0.05);

  // Mouth cavity & jagged teeth
  shape(neck, g.rounded, darkFlesh, 0, 0.1, 0.18, 0.2, 0.065, 0.04);
  for (let t = -2; t <= 2; t++) {
    shape(neck, g.box, teeth, t * 0.032, 0.105, 0.19, 0.022, 0.028, 0.018);
  }

function getDrillBladeGeometry(g: Graphics): T.BufferGeometry {
  const key = '_fpDrillBlade';
  const cached = (g as unknown as Record<string, T.BufferGeometry>)[key];
  if (cached) return cached;
  const geom = new T.BufferGeometry();
  const positions = new Float32Array([
    // Base (Y = 0)
    -0.015,  0.0, 0.05,
     0.015,  0.0, 0.05,
    -0.015,  0.0, 0.20,
     0.015,  0.0, 0.20,
    // Mid step (Y = -0.18)
    -0.012, -0.18, 0.13,
     0.012, -0.18, 0.13,
    // Tip chisel (Y = -0.38 to -0.40)
    -0.005, -0.38, 0.01,
     0.005, -0.38, 0.01,
     0.000, -0.40, 0.00,
  ]);
  const indices = [
    0, 1, 3,  0, 3, 2, // base
    0, 2, 4,  0, 4, 6,  0, 6, 8, // left
    1, 5, 3,  1, 7, 5,  1, 8, 7, // right
    2, 3, 5,  2, 5, 4, // outer upper
    4, 5, 7,  4, 7, 6, // outer lower
    6, 7, 8,           // tip cap
    0, 8, 1,           // inner edge
  ];
  geom.setAttribute('position', new T.BufferAttribute(positions, 3));
  geom.setAttribute(
    'uv',
    new T.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
  );
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const registered = g.geometry(geom);
  (g as unknown as Record<string, T.BufferGeometry>)[key] = registered;
  return registered;
}

  const drillBlade = getDrillBladeGeometry(g);
  const rotMatrix = new T.Matrix4();
  const spikeQuat = new T.Quaternion();

  // Helper for Spiked Drill Gauntlet
  const buildDrillGauntlet = (parent: T.Object3D, isDrill: boolean) => {
    // 4 segmented rings with radial spikes along the forearm
    for (let r = 0; r < 4; r++) {
      const ringY = -0.06 - r * 0.07;
      const ringRadius = 0.245 - r * 0.01;
      // Armored ring collar
      shape(
        parent,
        g.cylinder,
        metal,
        0,
        ringY,
        0,
        ringRadius * 2,
        0.06,
        ringRadius * 2,
      );

      // 4 radial sharp triangular spikes per ring
      for (let s = 0; s < 4; s++) {
        const ang = (s * Math.PI) / 2;
        const ca = Math.cos(ang),
          sa = Math.sin(ang);
        const dist = ringRadius + 0.06;
        const spike = shape(
          parent,
          g.pyramid,
          metal,
          ca * dist,
          ringY,
          sa * dist,
          0.03,
          0.13,
          0.08,
        );
        rotMatrix.set(0, ca, sa, 0, 1, 0, 0, 0, 0, sa, -ca, 0, 0, 0, 0, 1);
        spikeQuat.setFromRotationMatrix(rotMatrix);
        spike.quaternion.copy(spikeQuat);
      }
    }

    // Drill head assembly
    let bitContainer: T.Group;
    if (isDrill) {
      const drillGroup = joint(parent, 'drill', 0, 0, 0);
      bitContainer = joint(drillGroup, 'drill-bit', 0, -0.34, 0);
    } else {
      const drillGroup = joint(parent, 'drill-left', 0, 0, 0);
      bitContainer = joint(drillGroup, 'drill-bit-left', 0, -0.34, 0);
    }

    // Rotating hub base
    shape(bitContainer, g.cylinder, steel, 0, -0.03, 0, 0.4, 0.06, 0.4);

    // Central conical drill core
    const core = shape(
      bitContainer,
      g.cone,
      steel,
      0,
      -0.21,
      0,
      0.18,
      0.38,
      0.18,
    );
    core.rotation.x = Math.PI; // point apex forward/down

    // 4 chisel drill blades forming conical auger
    for (let b = 0; b < 4; b++) {
      const ang = (b * Math.PI) / 2;
      const blade = shape(bitContainer, drillBlade, steel, 0, -0.03, 0, 1, 1, 1);
      blade.rotation.y = ang;
      blade.rotateY(0.25); // spiral flute pitch
    }
  };

  // 3. Arms & Gauntlets
  for (const side of [-1, 1]) {
    const arm = joint(torso, `arm${side}`, side * 0.54, 0.5, 0);
    arm.rotation.z = side * 0.42;
    // Shoulder & massive bicep
    shape(arm, sphere, skin, 0, 0, 0, 0.46, 0.44, 0.44);
    shape(arm, g.taper, skin, 0, -0.22, 0, 0.38, 0.48, 0.38);
    // Arm staple / bone clamp
    shape(arm, g.box, metal, side * 0.14, -0.12, 0.08, 0.04, 0.16, 0.04);

    const elbow = joint(arm, `elbow${side}`, 0, -0.38, 0);
    shape(elbow, sphere, skin, 0, 0, 0, 0.32, 0.32, 0.32);

    // Drill Gauntlets: right arm (side === 1) has drill/drillBit, left arm (side === -1) has matching grinder-bit
    buildDrillGauntlet(elbow, side === 1);
  }

  // 4. Legs & Braces
  for (const side of [-1, 1]) {
    const leg = joint(root, `leg${side}`, side * 0.24, 0.74, 0);
    // Muscular thigh
    shape(leg, g.taper, skin, 0, -0.18, 0, 0.42, 0.5, 0.42);
    shape(leg, sphere, skin, 0, -0.12, 0.04, 0.4, 0.42, 0.4);
    // Thigh staple / bone clamp
    shape(leg, g.box, metal, side * 0.18, -0.22, 0.04, 0.04, 0.22, 0.04);

    const knee = joint(leg, `knee${side}`, 0, -0.38, 0);
    // Knee joint & calf
    shape(knee, sphere, skin, 0, 0, 0.02, 0.34, 0.34, 0.34);
    shape(knee, g.taper, skin, 0, -0.2, 0.02, 0.32, 0.42, 0.34);
    // Shin bracket running down the leg
    shape(knee, g.box, metal, 0, -0.18, 0.16, 0.06, 0.28, 0.04);
    shape(knee, g.box, metal, side * 0.14, -0.24, 0.02, 0.04, 0.18, 0.04);
    // Ankle bracket
    shape(knee, g.box, metal, 0, -0.36, 0.08, 0.24, 0.04, 0.18);
    // Foot & toes
    shape(knee, sphere, skin, 0, -0.38, 0.08, 0.3, 0.16, 0.36);
    for (let t = -2; t <= 2; t++) {
      shape(knee, sphere, skin, t * 0.042, -0.44, 0.24, 0.05, 0.05, 0.07);
    }
  }

  g.mergeParts(root);
  root.scale.setScalar(2);
  return root;
}

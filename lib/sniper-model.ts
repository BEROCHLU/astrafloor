import * as T from 'three';
import type { Graphics } from './graphics.ts';

/**
 * Procedural Remington M24 / M700 style tactical sniper rifle (SR-3).
 * Reconstructed to match reference image: streamlined light-grey synthetic stock,
 * thick rubber buttpad, steel receiver with animated bolt action mechanism,
 * detachable box magazine, free-floating barrel with front sight post, and
 * precision tactical riflescope.
 */
export function createSniperBody(g: Graphics, root: T.Group, action: T.Group) {
  const maps = g.createMaps('metal');
  const finish = (
    color: number,
    metalness: number,
    roughness: number,
    bump = 0.045,
  ) =>
    g.material(
      new T.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        normalMap: maps.normalMap,
        normalScale: new T.Vector2(bump, bump),
      }),
    );

  // Surface Finishes
  // Streamlined tactical olive-grey composite stock (grey mixed with olive green)
  const stockMat = finish(0x586452, 0.02, 0.85, 0.035);
  // Heavy black rubber recoil pad on the buttstock
  const rubberMat = finish(0x14181a, 0.02, 0.96, 0.03);
  // Dark parkerized steel for receiver, barrel, and action
  const steelMat = finish(0x252a2c, 0.76, 0.48);
  // Polished machined steel highlights for bolt surface
  const brightSteelMat = finish(0x484e52, 0.82, 0.40);
  // Matte black metal for scope, mounting rings, magazine, and trigger guard
  const blackMetalMat = finish(0x1c2022, 0.62, 0.52);
  // Coated optical glass
  const opticGlassMat = g.material(
    new T.MeshStandardMaterial({
      color: 0x244b58,
      metalness: 0.82,
      roughness: 0.08,
    }),
  );
  const rearGlassMat = g.material(
    new T.MeshStandardMaterial({
      color: 0x16242c,
      metalness: 0.75,
      roughness: 0.12,
    }),
  );
  const darkCavity = g.material(new T.MeshBasicMaterial({ color: 0x050707 }));

  // Helper constructors
  const part = (name: string) => {
    const group = new T.Group();
    group.name = name;
    root.add(group);
    return group;
  };
  const box = (
    p: T.Object3D,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => g.mesh(p, g.box, m, x, y, z, w, h, d);

  const barrel = (
    p: T.Object3D,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
  ) => {
    const mesh = g.mesh(p, g.cylinder, m, x, y, z, radius, length, radius);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  const cone = (
    p: T.Object3D,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    rTop: number,
    rBottom: number,
    length: number,
  ) => {
    const geom = g.geometry(new T.CylinderGeometry(rTop, rBottom, length, 16));
    const mesh = g.mesh(p, geom, m, x, y, z, 1, 1, 1);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  const profile = (
    p: T.Object3D,
    m: T.Material,
    outline: number[][],
    width: number,
    x = 0,
  ) => {
    const shape = new T.Shape();
    outline.forEach(([z, y], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
    shape.closePath();
    const geom = g.geometry(
      new T.ExtrudeGeometry(shape, {
        depth: width,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.003,
        bevelSegments: 1,
        steps: 1,
        curveSegments: 1,
      }),
    );
    geom.rotateY(Math.PI / 2);
    geom.translate(x - width / 2, 0, 0);
    return g.mesh(p, geom, m, 0, 0, 0, 1, 1, 1);
  };

  // 1. One-Piece Streamlined Synthetic Stock
  const stockGroup = part('sniper-stock');
  const stockOutline = [
    [0.32, 0.015],    // top rear of comb at buttpad interface
    [0.10, 0.012],    // comb forward slope
    [0.05, -0.012],   // wrist dip behind receiver
    [-0.01, 0.008],   // receiver tang bedding start
    [-0.67, 0.008],   // forend top forward line
    [-0.71, -0.020],  // angled forend nose tip
    [-0.69, -0.038],  // forend underside nose
    [-0.32, -0.058],  // forend underside taper
    [-0.26, -0.058],  // front of magazine well
    [-0.15, -0.065],  // rear of magazine well
    [-0.09, -0.065],  // trigger guard front
    [-0.04, -0.125],  // pistol grip front ergonomic curve
    [-0.02, -0.178],  // pistol grip base front
    [0.03, -0.178],   // pistol grip base rear
    [0.08, -0.118],   // grip rear transition to buttstock
    [0.32, -0.165],   // bottom rear toe at buttpad interface
  ];
  profile(stockGroup, stockMat, stockOutline, 0.062);

  // Soft grip swell panels on sides of wrist
  for (const side of [-1, 1]) {
    box(stockGroup, stockMat, side * 0.032, -0.105, 0.01, 0.006, 0.075, 0.065);
  }

  // 2. Thick Black Rubber Recoil Buttpad
  const buttOutline = [
    [0.32, 0.015],
    [0.342, 0.008],
    [0.348, -0.012],
    [0.348, -0.145],
    [0.342, -0.160],
    [0.32, -0.165],
  ];
  profile(stockGroup, rubberMat, buttOutline, 0.064);
  // Buttpad spacer
  box(stockGroup, blackMetalMat, 0, -0.075, 0.32, 0.063, 0.178, 0.004);

  // 3. Receiver, Bolt Shroud, and Picatinny Rail
  const receiverGroup = part('sniper-receiver');
  // Cylindrical steel receiver
  barrel(receiverGroup, steelMat, 0, 0.018, -0.195, 0.033, 0.37);

  // Rear bolt shroud cap (stationary sleeve behind action)
  barrel(receiverGroup, blackMetalMat, 0, 0.018, 0.018, 0.027, 0.055);
  // Cocking indicator pin
  barrel(receiverGroup, brightSteelMat, 0, 0.018, 0.048, 0.006, 0.012);

  // Ejection port chamber recess (right side cutout)
  box(receiverGroup, darkCavity, 0.016, 0.022, -0.21, 0.026, 0.032, 0.12);

  // Picatinny / Tactical scope mount rail along top of receiver
  box(receiverGroup, blackMetalMat, 0, 0.051, -0.205, 0.032, 0.012, 0.33);
  // Rail recoil cross-slots
  for (let z = -0.35; z <= -0.06; z += 0.024) {
    box(receiverGroup, darkCavity, 0, 0.056, z, 0.033, 0.003, 0.008);
  }

  // 4. Action Mechanism (Bolt Body & Bolt Handle)
  // Inside action group: rotates (lift) and translates (pull) during animateBolt()
  // Cylindrical polished bolt body sliding in receiver
  barrel(action, brightSteelMat, 0, 0.018, -0.14, 0.023, 0.22);
  // Bolt face / extractor rim at front of bolt
  barrel(action, darkCavity, 0, 0.018, -0.252, 0.022, 0.006);

  // Bolt handle collar and angled stem
  // Collar around bolt body
  barrel(action, blackMetalMat, 0, 0.018, -0.035, 0.028, 0.024);
  // Slender steel stem extending right and down
  const stem = g.mesh(action, g.cylinder, blackMetalMat, 0.054, -0.008, -0.05, 0.009, 0.076, 0.009);
  stem.rotation.z = -0.92; // angled downwards to the right
  stem.rotation.x = 0.22;  // angled slightly rearwards

  // Tactical round bolt knob at stem tip
  g.mesh(action, g.sphere, blackMetalMat, 0.088, -0.038, -0.064, 0.032, 0.032, 0.032);
  // Knob knurled center band
  g.mesh(action, g.cylinder, brightSteelMat, 0.088, -0.038, -0.064, 0.033, 0.01, 0.033);

  // 5. Detachable Box Magazine & Trigger Guard
  const lowerGroup = part('sniper-lower');
  // Detachable AICS-style box magazine protruding below stock
  const mag = box(lowerGroup, blackMetalMat, 0, -0.116, -0.205, 0.038, 0.098, 0.082);
  mag.rotation.x = -0.04; // slight forward tactical cant
  // Magazine floorplate
  const floorplate = box(lowerGroup, blackMetalMat, 0, -0.165, -0.203, 0.042, 0.010, 0.086);
  floorplate.rotation.x = -0.04;
  // Side stamping indentations on magazine body
  for (const side of [-1, 1]) {
    box(lowerGroup, darkCavity, side * 0.020, -0.116, -0.218, 0.002, 0.076, 0.018);
    box(lowerGroup, darkCavity, side * 0.020, -0.116, -0.192, 0.002, 0.076, 0.018);
  }

  // Trigger guard loop
  box(lowerGroup, blackMetalMat, 0, -0.075, -0.155, 0.022, 0.024, 0.018); // front latch pillar
  box(lowerGroup, blackMetalMat, 0, -0.138, -0.115, 0.022, 0.010, 0.082); // bottom guard floor
  box(lowerGroup, blackMetalMat, 0, -0.095, -0.072, 0.022, 0.060, 0.016); // rear guard pillar
  // Magazine release paddle
  box(lowerGroup, steelMat, 0, -0.095, -0.158, 0.008, 0.024, 0.006);
  // Curved steel trigger blade
  const trigger = box(lowerGroup, brightSteelMat, 0, -0.098, -0.106, 0.006, 0.034, 0.010);
  trigger.rotation.x = 0.28;

  // 6. Free-Floating Barrel & Muzzle Front Sight
  const barrelGroup = part('sniper-barrel');
  // Barrel chamber collar
  barrel(barrelGroup, steelMat, 0, 0.018, -0.40, 0.030, 0.04);
  // Long precision tapered barrel extending to muzzle at z = -1.24
  cone(barrelGroup, steelMat, 0, 0.018, -0.82, 0.022, 0.029, 0.80);
  // Muzzle crown ring
  barrel(barrelGroup, steelMat, 0, 0.018, -1.23, 0.023, 0.02);
  // Deep bore cavity
  barrel(barrelGroup, darkCavity, 0, 0.018, -1.242, 0.011, 0.006);

  // Muzzle Front Sight Post (faithfully replicating reference image)
  // Sight ramp base sitting on top of the muzzle
  box(barrelGroup, steelMat, 0, 0.043, -1.218, 0.008, 0.008, 0.026);
  // Upright sight post / bead
  barrel(barrelGroup, steelMat, 0, 0.052, -1.222, 0.003, 0.010);

  // 7. Tactical Precision Riflescope
  const scope = new T.Group();
  scope.name = 'scope';
  root.add(scope);

  const scopeY = 0.112; // optical centerline height
  // Dual heavy-duty tactical mounting rings clamped to rail
  for (const ringZ of [-0.12, -0.32]) {
    // Ring base clamp
    box(scope, blackMetalMat, 0, 0.076, ringZ, 0.036, 0.038, 0.028);
    // Ring upper hoop around tube
    barrel(scope, blackMetalMat, 0, scopeY, ringZ, 0.029, 0.028);
    // Left-side cross-bolt locking nut
    const nut = g.mesh(scope, g.cylinder, steelMat, -0.022, 0.074, ringZ, 0.008, 0.012, 0.008);
    nut.rotation.z = Math.PI / 2;
  }

  // Central 30mm scope main tube
  barrel(scope, blackMetalMat, 0, scopeY, -0.22, 0.021, 0.34);

  // Central Turret Saddle
  box(scope, blackMetalMat, 0, scopeY, -0.22, 0.048, 0.048, 0.050);
  // Top Elevation Turret (with knurled cap)
  g.mesh(scope, g.cylinder, blackMetalMat, 0, scopeY + 0.032, -0.22, 0.016, 0.024, 0.016);
  g.mesh(scope, g.cylinder, steelMat, 0, scopeY + 0.044, -0.22, 0.0175, 0.006, 0.0175);
  // Right Windage Turret
  const windage = g.mesh(scope, g.cylinder, blackMetalMat, 0.032, scopeY, -0.22, 0.015, 0.022, 0.015);
  windage.rotation.z = Math.PI / 2;
  const windCap = g.mesh(scope, g.cylinder, steelMat, 0.043, scopeY, -0.22, 0.016, 0.005, 0.016);
  windCap.rotation.z = Math.PI / 2;
  // Left Parallax / Focus Turret
  const parallax = g.mesh(scope, g.cylinder, blackMetalMat, -0.030, scopeY, -0.22, 0.013, 0.018, 0.013);
  parallax.rotation.z = Math.PI / 2;

  // Front Objective Bell: Flared cone expanding to large objective lens
  cone(scope, blackMetalMat, 0, scopeY, -0.43, 0.021, 0.042, 0.08);
  // Objective housing & sunshade extension
  barrel(scope, blackMetalMat, 0, scopeY, -0.55, 0.042, 0.16);
  // Coated green/blue optical objective lens
  barrel(scope, opticGlassMat, 0, scopeY, -0.628, 0.038, 0.004);

  // Rear Ocular Eyepiece Housing
  // Magnification zoom ring with tactile rib
  barrel(scope, blackMetalMat, 0, scopeY, -0.02, 0.025, 0.06);
  box(scope, steelMat, 0, scopeY + 0.026, -0.02, 0.008, 0.007, 0.018); // zoom throw rib
  // Ocular bell expanding to eyepiece rim
  cone(scope, blackMetalMat, 0, scopeY, 0.03, 0.025, 0.030, 0.04);
  barrel(scope, rubberMat, 0, scopeY, 0.052, 0.030, 0.008); // rubber eye cushion rim
  // Dark rear ocular lens
  barrel(scope, rearGlassMat, 0, scopeY, 0.050, 0.026, 0.004);
}

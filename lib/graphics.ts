import * as T from 'three';
import { createAR2Body } from './ar2-model.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EnemyMaterials } from './enemy-materials.ts';
import { createHansModel, bindHansRig, type HansRig } from './hans-model.ts';

export type Quality = 'high';
type Surface = 'concrete' | 'metal' | 'cloth' | 'skin';
type Maps = {
  map: T.DataTexture;
  normalMap: T.DataTexture;
  roughnessMap: T.DataTexture;
};
export type EnemyRig = {
  hans?: HansRig;
  root: T.Group;
  head: T.Mesh;
  parts: T.Mesh[];
  arms: T.Group[];
  legs: T.Group[];
  elbows: T.Group[];
  knees: T.Group[];
  neck: T.Group;
  torso: T.Group;
  cannonMuzzle?: T.Group;
  cannonCharge?: T.Group;
  chainsaw?: T.Group;
  sawChain?: T.Group;
  blade?: T.Group;
  drill?: T.Group;
  drillBit?: T.Group;
  rageIndicator?: T.Group;
};

// Periodic value noise keeps the small material tiles seamless at every edge.
function noise(x: number, y: number, period: number) {
  const hash = (a: number, b: number) => {
    let h =
      Math.imul(((a % period) + period) % period, 374761393) ^
      Math.imul(((b % period) + period) % period, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const sx = x - ix,
    sy = y - iy,
    u = sx * sx * (3 - 2 * sx),
    v = sy * sy * (3 - 2 * sy);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    T.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  );
}

/** Scene-owned resources. Tiles and model geometries are reused across all spawns. */
export class Graphics {
  geometries = new Set<T.BufferGeometry>();
  materials = new Set<T.Material>();
  textures = new Set<T.Texture>();
  maps = new Map<Surface, Maps>();
  surfaces = new Map<string, T.MeshStandardMaterial>();
  enemyMaterials = new EnemyMaterials((kind) => this.createMaps(kind));
  models = new Map<number, T.Group>();
  weapons = new Map<number, T.Group>();
  grenadeModel?: T.Group;
  grenadeHandModel?: T.Group;
  rocketModel?: T.Group;
  environment?: T.WebGLRenderTarget;
  box = this.geometry(new T.BoxGeometry(1, 1, 1));
  rounded = this.geometry(new RoundedBoxGeometry(1, 1, 1, 1, 0.12));
  sphere = this.geometry(new T.SphereGeometry(0.5, 10, 8));
  cylinder = this.geometry(new T.CylinderGeometry(0.5, 0.5, 1, 10));
  taper = this.geometry(new T.CylinderGeometry(0.5, 0.33, 1, 10));
  ring = this.geometry(new T.TorusGeometry(0.5, 0.08, 5, 14));
  plane = this.geometry(new T.PlaneGeometry(1, 1));

  geometry<G extends T.BufferGeometry>(g: G): G {
    this.geometries.add(g);
    return g;
  }
  material<M extends T.Material>(m: M): M {
    this.materials.add(m);
    return m;
  }
  texture<X extends T.Texture>(t: X): X {
    this.textures.add(t);
    return t;
  }

  createMaps(kind: Surface): Maps {
    const cached = this.maps.get(kind);
    if (cached) return cached;
    const size = kind === 'concrete' || kind === 'metal' ? 256 : 128;
    const height = new Float32Array(size * size),
      colors = new Uint8Array(size * size * 4),
      normals = new Uint8Array(size * size * 4),
      rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size,
          i = y * size + x,
          j = i * 4;
        const broad = noise(u * 8, v * 8, 8),
          grain = noise(u * 64, v * 64, 64),
          fine = noise(u * 128, v * 128, 128);
        const weave = Math.sin(u * Math.PI * 128) * Math.sin(v * Math.PI * 128);
        const scratch =
          Math.pow(
            Math.max(
              0,
              Math.sin((v * 64 + noise(u * 4, v * 4, 4)) * Math.PI * 2),
            ),
            36,
          ) * (grain > 0.5 ? 1 : 0);
        const rust = kind === 'metal' ? Math.max(0, broad - 0.57) * 2.1 : 0;
        let h = broad * 0.45 + grain * 0.4 + fine * 0.15;
        if (kind === 'metal') h = grain * 0.08 + scratch * 0.22 + rust * 0.1;
        if (kind === 'cloth') h = grain * 0.2 + weave * 0.18;
        if (kind === 'skin') h = broad * 0.23 + grain * 0.13 + fine * 0.04;
        height[i] = h;
        const value =
          kind === 'cloth'
            ? 0.77 + weave * 0.12 + grain * 0.12
            : kind === 'metal'
              ? 0.85 + scratch * 0.14 - rust * 0.35
              : 0.56 + broad * 0.34 + fine * 0.13;
        colors[j] = Math.min(255, (value + rust * 0.17) * 255);
        colors[j + 1] = Math.min(255, (value - rust * 0.13) * 255);
        colors[j + 2] = Math.min(255, (value - rust * 0.22) * 255);
        colors[j + 3] = 255;
        const r =
          (kind === 'metal'
            ? 0.6 + rust * 0.35 - scratch * 0.2
            : kind === 'concrete'
              ? 0.58 + broad * 0.4
              : 0.75 + grain * 0.2) * 255;
        rough[j] = rough[j + 1] = rough[j + 2] = r;
        rough[j + 3] = 255;
      }
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const j = (y * size + x) * 4;
        const dx =
          (height[y * size + ((x + 1) % size)] -
            height[y * size + ((x - 1 + size) % size)]) *
          2;
        const dy =
          (height[((y + 1) % size) * size + x] -
            height[((y - 1 + size) % size) * size + x]) *
          2;
        const len = Math.hypot(dx, dy, 1);
        normals[j] = ((-dx / len) * 0.5 + 0.5) * 255;
        normals[j + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        normals[j + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        normals[j + 3] = 255;
      }
    const make = (data: Uint8Array, color = false) => {
      const t = this.texture(new T.DataTexture(data, size, size, T.RGBAFormat));
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.magFilter = T.LinearFilter;
      t.minFilter = T.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const result = {
      map: make(colors, true),
      normalMap: make(normals),
      roughnessMap: make(rough),
    };
    this.maps.set(kind, result);
    return result;
  }

  surface(kind: Surface, color: number, repeatX = 1, repeatY = repeatX) {
    const key = `${kind}/${color}/${repeatX}/${repeatY}`;
    const cached = this.surfaces.get(key);
    if (cached) return cached;
    const maps = this.createMaps(kind);
    const tile = (original: T.DataTexture) => {
      const t = this.texture(original.clone());
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    };
    const material = this.material(
      new T.MeshStandardMaterial({
        color,
        map: tile(maps.map),
        normalMap: tile(maps.normalMap),
        roughnessMap: tile(maps.roughnessMap),
        normalScale: new T.Vector2(
          kind === 'concrete' ? 0.65 : 0.35,
          kind === 'concrete' ? 0.65 : 0.35,
        ),
        metalness: kind === 'metal' ? 0.72 : 0.03,
        roughness: kind === 'metal' ? 0.62 : 0.93,
      }),
    );
    this.surfaces.set(key, material);
    return material;
  }

  environmentLighting(renderer: T.WebGLRenderer, scene: T.Scene) {
    this.enemyMaterials.preload();
    const room = new RoomEnvironment(),
      generator = new T.PMREMGenerator(renderer);
    this.environment = generator.fromScene(room, 0.06, 0.1, 100, { size: 128 });
    scene.environment = this.environment.texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    generator.dispose();
  }

  mesh(
    parent: T.Object3D,
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Merge by material *within each moving joint*. Animation pivots and raycast targets survive.
  mergeParts(root: T.Object3D) {
    for (const child of root.children)
      if (!(child instanceof T.Mesh)) this.mergeParts(child);
    const groups = new Map<T.Material, T.Mesh[]>();
    for (const child of root.children)
      if (
        child instanceof T.Mesh &&
        !Array.isArray(child.material) &&
        child.children.length === 0
      ) {
        const list = groups.get(child.material) || [];
        list.push(child);
        groups.set(child.material, list);
      }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const pieces = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(pieces);
      pieces.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new T.Mesh(this.geometry(merged), material);
      mesh.castShadow = meshes.some((m) => m.castShadow);
      mesh.receiveShadow = true;
      meshes.forEach((m) => root.remove(m));
      root.add(mesh);
    }
  }

  /** Batch only scenery. Keep invisible collision meshes in the scene for world matrices/rays. */
  batchScenery(scene: T.Scene, collision: T.Mesh[]) {
    scene.updateMatrixWorld(true);
    const groups = new Map<string, T.Mesh[]>();
    for (const child of scene.children)
      if (
        child instanceof T.Mesh &&
        !Array.isArray(child.material) &&
        !child.material.transparent &&
        child.visible
      ) {
        const key = `${child.geometry.uuid}/${child.material.uuid}/${child.castShadow}`;
        const list = groups.get(key) || [];
        list.push(child);
        groups.set(key, list);
      }
    let before = 0,
      after = 0;
    for (const meshes of groups.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0],
        batch = new T.InstancedMesh(
          first.geometry,
          first.material,
          meshes.length,
        );
      batch.name = 'Scenery batch';
      batch.castShadow = first.castShadow;
      batch.receiveShadow = true;
      meshes.forEach((m, index) => {
        batch.setMatrixAt(index, m.matrixWorld);
        if (collision.includes(m)) m.visible = false;
        else scene.remove(m);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      scene.add(batch);
      before += meshes.length;
      after++;
    }
    return { before, after };
  }

  radialTexture() {
    const size = 64,
      data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const j = (y * size + x) * 4,
          r = Math.hypot(
            ((x + 0.5) / size) * 2 - 1,
            ((y + 0.5) / size) * 2 - 1,
          );
        data[j] = data[j + 1] = data[j + 2] = 255;
        data[j + 3] = Math.pow(Math.max(0, 1 - r), 2.6) * 255;
      }
    const t = this.texture(new T.DataTexture(data, size, size));
    t.magFilter = T.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  createEnemy(kind: number): EnemyRig {
    if (!this.models.has(kind)) this.models.set(kind, this.enemyTemplate(kind));
    const root = this.models.get(kind)!.clone(true),
      parts: T.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof T.Mesh && !o.userData.noHit) parts.push(o);
    });
    const neck = root.getObjectByName('neck') as T.Group;
    neck.traverse((o) => {
      if (o instanceof T.Mesh) o.userData.hitZone = 'head';
    });
    return {
      hans: kind === 7 ? bindHansRig(root) : undefined,
      root,
      parts,
      head: parts.find((p) => p.userData.hitZone === 'head')!,
      neck,
      torso: root.getObjectByName('torso') as T.Group,
      cannonMuzzle: root.getObjectByName('cannon-muzzle') as T.Group | undefined,
      cannonCharge: root.getObjectByName('cannon-charge') as T.Group | undefined,
      chainsaw: root.getObjectByName('chainsaw') as T.Group | undefined,
      sawChain: root.getObjectByName('saw-chain') as T.Group | undefined,
      blade: root.getObjectByName('arm-blade') as T.Group | undefined,
      drill: root.getObjectByName('drill') as T.Group | undefined,
      drillBit: root.getObjectByName('drill-bit') as T.Group | undefined,
      rageIndicator: root.getObjectByName('rage-indicator') as T.Group | undefined,
      arms: [-1, 1].map((i) => root.getObjectByName(`arm${i}`) as T.Group),
      legs: [-1, 1].map((i) => root.getObjectByName(`leg${i}`)).filter((o): o is T.Group => o instanceof T.Group),
      elbows: [-1, 1].map((i) => root.getObjectByName(`elbow${i}`) as T.Group),
      knees: [-1, 1].map((i) => root.getObjectByName(`knee${i}`)).filter((o): o is T.Group => o instanceof T.Group),
    };
  }

  // 0: Clot, 1: Gorefast, 2: Scrake, 3: Freshpound, 4: Bloat, 5: Crawler, 6: Husk, 7: Hans.
  enemyTemplate(kind: number) {
    if (kind === 7) return createHansModel(this);
    const root = new T.Group();
    const materials = this.enemyMaterials;
    const skin = materials.surface(
      kind === 6 ? 'charred-skin' : kind === 5 ? 'hardened-skin' :
        kind === 4 ? 'bloated-skin' : kind === 1 ? 'exposed-muscle' : 'pale-skin',
      kind === 2 ? 0x8f9da9 : 0xffffff,
    );
    const cloth = materials.surface('dirty-cloth', kind === 2 ? 0xe2ded2 : 0x484d49);
    const body = kind === 3 ? materials.surface('exposed-muscle') : skin;
    const trousers = materials.surface('dirty-cloth', kind === 3 ? 0x635a42 : 0x434747),
      dark = materials.surface('exposed-muscle', 0x493b37),
      blood = materials.surface('exposed-muscle', 0xbe8881, 'wet');
    const armor = kind === 2 ? cloth : materials.surface('corroded-metal',
      kind === 3 ? 0xc49b46 : kind === 6 ? 0x817166 : 0x9ea5a2, 'paint'),
      teeth = this.material(
        new T.MeshStandardMaterial({ color: 0xb5a787, roughness: 0.85 }),
      );
    const glow = this.material(
      new T.MeshBasicMaterial({ color: kind === 6 ? 0xff9b32 : kind === 3 ? 0xf5b355 : kind === 4 ? 0xb7bf83 : 0xb9b4a0 }),
    );
    const torsoWidth = kind === 0 ? 0.74 : kind === 2 ? 1.38 : kind === 4 ? 1.5 : 1;
    const torsoDepth = kind === 0 ? 0.8 : kind === 2 ? 1.32 : kind === 4 ? 1.45 : 1;
    const limbWidth = kind === 0 ? 0.78 : kind === 2 ? 1.5 : kind === 4 ? 1.2 : 1;
    const shape = (
      p: T.Object3D,
      g: T.BufferGeometry,
      m: T.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      // Wounds and clothing follow the body; head and weapon proportions stay independent.
      const torsoPart = p.name === 'torso' || p.name === 'bile-sac';
      const limbPart = /^(arm|elbow|leg|knee)-?1$/.test(p.name);
      const width = torsoPart ? torsoWidth : limbPart ? limbWidth : 1;
      const depth = torsoPart ? torsoDepth : limbPart ? limbWidth : 1;
      return this.mesh(p, g, m, x * width, y, z * depth, w * width, h, d * depth);
    };
    const joint = (
      p: T.Object3D,
      name: string,
      x: number,
      y: number,
      z: number,
    ) => {
      const group = new T.Group();
      group.name = name;
      group.position.set(x, y, z);
      p.add(group);
      return group;
    };
    const torso = joint(root, 'torso', 0, kind === 5 ? 0.4 : 0.93, 0);
    shape(torso, this.sphere, body, 0, 0.33, -0.025, 0.68, 0.8, 0.39);
    shape(torso, this.taper, body, 0, 0.08, 0, 0.42, 0.4, 0.32);
    if (kind !== 5) shape(torso, this.sphere, trousers, 0, -0.1, 0, 0.48, 0.25, 0.34);
    shape(
      torso,
      this.rounded,
      blood,
      -0.19,
      0.4,
      0.16,
      0.12,
      0.24,
      0.036,
    ).rotation.z = 0.25;
    shape(torso, this.rounded, dark, 0, 0.17, 0.195, 0.035, 0.52, 0.018);
    for (let n = 0; n < 3; n++)
      shape(
        torso,
        this.sphere,
        skin,
        0.13,
        0.3 + n * 0.075,
        0.172,
        0.2,
        0.032,
        0.04,
      );
    if (kind === 2) {
      for (const side of [-1, 1]) {
        // Pectorals, abdominal muscles and trapezius merge into the existing skin mesh.
        shape(torso, this.sphere, skin, side * 0.155, 0.45, 0.165, 0.32, 0.26, 0.2);
        shape(torso, this.sphere, skin, side * 0.13, 0.64, -0.025, 0.26, 0.23, 0.3);
        for (let row = 0; row < 2; row++)
          shape(torso, this.sphere, skin, side * 0.068, 0.24 - row * 0.11, 0.15, 0.12, 0.105, 0.15);
      }
    }
    const neck = joint(torso, 'neck', 0, 0.68, 0.035);
    shape(neck, this.taper, skin, 0, 0.01, -0.035, 0.14, 0.2, 0.14);
    shape(neck, this.sphere, skin, 0, 0.17, 0.008, 0.345, 0.39, 0.31);
    shape(neck, this.sphere, skin, 0, 0.027, 0.083, 0.23, 0.18, 0.22);
    shape(neck, this.sphere, dark, 0, 0.048, 0.19, 0.18, 0.072, 0.018);
    shape(
      neck,
      this.taper,
      skin,
      0,
      0.14,
      0.174,
      0.065,
      0.115,
      0.095,
    ).rotation.x = 0.3;
    for (const side of [-1, 1]) {
      shape(
        neck,
        this.sphere,
        dark,
        side * 0.085,
        0.205,
        0.143,
        0.106,
        0.08,
        0.047,
      );
      shape(
        neck,
        this.sphere,
        glow,
        side * 0.085,
        0.2,
        0.168,
        0.038,
        0.025,
        0.018,
      );
      shape(
        neck,
        this.taper,
        skin,
        side * 0.082,
        0.246,
        0.137,
        0.13,
        0.035,
        0.045,
      ).rotation.z = side * 0.19;
      shape(
        neck,
        this.sphere,
        skin,
        side * 0.17,
        0.152,
        0.005,
        0.055,
        0.1,
        0.072,
      );
      for (let i = 0; i < 3; i++)
        shape(
          neck,
          this.box,
          teeth,
          side * (0.021 + i * 0.022),
          0.068,
          0.204,
          0.016,
          0.033,
          0.014,
        );
      const arm = joint(torso, `arm${side}`, side * 0.36 * torsoWidth, 0.5, 0);
      shape(arm, this.sphere, body, 0, -0.025, 0, 0.28, 0.3, 0.3);
      shape(arm, kind === 2 ? this.sphere : this.taper, body, 0, -0.2, 0, 0.22, 0.35, 0.235);
      const elbow = joint(arm, `elbow${side}`, 0, -0.38, 0);
      if (kind === 6 && side === 1) {
        const cannon = joint(elbow, 'cannon', 0, 0, 0);
        shape(cannon, this.cylinder, armor, 0, -0.22, 0, 0.32, 0.58, 0.32);
        shape(cannon, this.cylinder, dark, 0, -0.53, 0, 0.37, 0.08, 0.37);
        shape(cannon, this.cylinder, glow, 0, -0.575, 0, 0.22, 0.012, 0.22);
        for (const edge of [-1, 1]) {
          shape(cannon, this.rounded, armor, edge * 0.16, -0.22, 0, 0.055, 0.4, 0.21);
          shape(cannon, this.rounded, glow, edge * 0.193, -0.17, 0, 0.012, 0.12, 0.06);
        }
        const muzzle = joint(cannon, 'cannon-muzzle', 0, -0.61, 0);
        const charge = joint(muzzle, 'cannon-charge', 0, 0, 0);
        shape(charge, this.sphere, glow, 0, 0, 0, 0.19, 0.19, 0.19);
        charge.visible = false;
        arm.rotation.x = -Math.PI / 2;
      } else {
        shape(elbow, this.sphere, skin, 0, 0, 0, 0.17, 0.18, 0.18);
        shape(elbow, this.taper, skin, 0, -0.14, 0.01, 0.17, 0.3, 0.17);
        shape(elbow, this.sphere, skin, 0, -0.33, 0.027, 0.17, 0.19, 0.105);
        for (let finger = 0; finger < 3; finger++)
          shape(
            elbow,
            this.taper,
            skin,
            (finger - 1) * 0.045,
            -0.43,
            0.05,
            0.036,
            0.13,
            0.037,
          ).rotation.x = -0.25;
        shape(
          elbow,
          this.sphere,
          blood,
          side * 0.058,
          -0.17,
          0.075,
          0.08,
          0.17,
          0.025,
        );
      }
      if (kind === 1 && side === 1) {
        const blade = joint(elbow, 'arm-blade', 0.09, -0.12, 0.08);
        const outline = new T.Shape();
        outline.moveTo(-0.09, 0);
        outline.lineTo(0.08, 0);
        outline.lineTo(0.14, -0.61);
        outline.lineTo(0.02, -0.96);
        outline.lineTo(-0.09, -0.66);
        outline.closePath();
        const metal = materials.surface('corroded-metal', 0xe1ded7);
        const geometry = this.geometry(new T.ExtrudeGeometry(outline, {
          depth: 0.035, bevelEnabled: true, bevelThickness: 0.012,
          bevelSize: 0.012, bevelSegments: 1, steps: 1,
        }));
        shape(blade, geometry, metal, 0, 0, 0, 1, 1, 1);
        shape(blade, this.rounded, armor, 0, 0, 0, 0.25, 0.12, 0.12);
      }
      if (kind === 2 && side === 1) {
        const saw = this.chainsawTemplate();
        saw.position.set(0, -0.34, 0.025);
        elbow.add(saw);
        arm.rotation.x = -0.65;
        elbow.rotation.x = -0.45;
      }
      if (kind === 3 && side === 1) {
        const drill = this.drillTemplate();
        drill.position.set(0, -0.18, 0.025);
        elbow.add(drill);
        arm.rotation.x = -0.75;
        elbow.rotation.x = -0.4;
      }
      if (kind === 5) continue;
      const leg = joint(root, `leg${side}`, side * 0.17 * torsoWidth, 0.78, 0);
      shape(leg, this.taper, trousers, 0, -0.18, 0, 0.265, 0.4, 0.29);
      const knee = joint(leg, `knee${side}`, 0, -0.38, 0);
      shape(knee, this.sphere, trousers, 0, 0, 0.015, 0.23, 0.21, 0.25);
      shape(knee, this.taper, trousers, 0, -0.15, 0, 0.2, 0.34, 0.22);
      shape(knee, this.rounded, dark, 0, -0.32, 0.045, 0.23, 0.15, 0.39);
    }
    if (kind === 4) {
      const sac = joint(torso, 'bile-sac', 0, 0, 0);
      const bile = materials.surface('bloated-skin', 0xabb557, 'wet');
      shape(sac, this.sphere, skin, 0, 0.2, 0.12, 0.9, 0.78, 0.64);
      shape(sac, this.sphere, bile, 0, 0.25, 0.36, 0.53, 0.48, 0.2);
      shape(neck, this.sphere, bile, 0, -0.1, 0.12, 0.3, 0.26, 0.25);
      shape(neck, this.sphere, dark, 0, 0.01, 0.211, 0.21, 0.14, 0.028);
    }
    if (kind === 5) {
      shape(torso, this.sphere, blood, 0, -0.15, 0, 0.39, 0.12, 0.3);
      torso.rotation.x = 1.1;
      neck.rotation.x = -1.05;
      for (const side of [-1, 1]) {
        torso.getObjectByName(`arm${side}`)!.rotation.x = -0.8;
        torso.getObjectByName(`elbow${side}`)!.rotation.x = -1.1;
      }
    }
    if (kind === 6) {
      const tank = joint(torso, 'fuel-tank', 0, 0.3, -0.31);
      shape(tank, this.cylinder, armor, 0, 0, 0, 0.36, 0.72, 0.36);
      shape(tank, this.rounded, dark, 0, 0, -0.02, 0.41, 0.13, 0.39);
      shape(tank, this.sphere, glow, 0, 0.3, -0.13, 0.14, 0.12, 0.09);
    }
    if (kind === 2 || kind === 3 || kind === 6) {
      if (kind === 2)
        shape(torso, this.rounded, armor, 0, -0.055, 0.19, 0.4, 0.25, 0.07);
      else
        shape(torso, this.rounded, armor, 0, 0.36, 0.19, 0.55, 0.45, 0.135);
      for (const side of [-1, 1]) {
        const arm = torso.getObjectByName(`arm${side}`)!;
        shape(arm, this.sphere, kind === 2 ? skin : armor, 0, 0.04, 0, 0.34, 0.28, 0.37);
        shape(
          torso,
          this.rounded,
          armor,
          side * 0.21,
          kind === 2 ? -0.07 : 0.1,
          0.215,
          0.13,
          0.18,
          0.1,
        );
      }
      if (kind === 3) {
        for (const side of [-1, 1])
          for (let i = 0; i < 3; i++)
            shape(
              torso,
              this.taper,
              teeth,
              side * (0.26 + i * 0.07),
              0.71 - i * 0.055,
              -0.08,
              0.085,
              0.25,
              0.085,
            ).rotation.z = side * -0.45;
        shape(torso, this.rounded, glow, 0, 0.39, 0.264, 0.12, 0.075, 0.012);
        const rage = joint(torso, 'rage-indicator', 0, 0.39, 0.285);
        const red = this.material(new T.MeshBasicMaterial({ color: 0xff2010 }));
        shape(rage, this.sphere, red, 0, 0, 0, 0.22, 0.15, 0.028);
        rage.visible = false;
      }
    }
    this.mergeParts(root);
    root.scale.setScalar(
      kind === 3 ? 2 : kind === 2 ? 1.3 : kind === 6 ? 1.08 : kind === 1 ? 0.9 : 1,
    );
    return root;
  }

  createWeapon(index: number) {
    if (!this.weapons.has(index))
      this.weapons.set(index, this.weaponTemplate(index));
    return this.weapons.get(index)!.clone(true);
  }

  createGrenade() {
    if (!this.grenadeModel) {
      const root = new T.Group();
      const shell = this.surface('metal', 0x52623c);
      const steel = this.surface('metal', 0xb0b9bb);
      const marking = this.material(new T.MeshStandardMaterial({
        color: 0xffc65a, emissive: 0xff922b, emissiveIntensity: 0.65,
        roughness: 0.65,
      }));
      this.mesh(root, this.sphere, shell, 0, 0, 0, 0.24, 0.28, 0.24);
      this.mesh(root, this.cylinder, shell, 0, 0.14, 0, 0.09, 0.08, 0.09);
      this.mesh(root, this.cylinder, marking, 0, 0.035, 0, 0.235, 0.04, 0.235);
      this.mesh(root, this.box, steel, 0.065, 0.095, 0, 0.035, 0.22, 0.055).rotation.z = 0.2;
      this.mesh(root, this.ring, steel, -0.075, 0.17, 0, 0.085, 0.085, 0.085);
      this.mergeParts(root);
      this.grenadeModel = root;
    }
    return this.grenadeModel.clone(true);
  }

  createGrenadeHand() {
    if (!this.grenadeHandModel) {
      const root = new T.Group();
      const glove = this.surface('cloth', 0x182321);
      const sleeve = this.surface('cloth', 0x394a46);
      this.mesh(root, this.sphere, glove, 0, -0.085, 0.04, 0.19, 0.16, 0.2);
      this.mesh(root, this.taper, sleeve, 0, -0.19, 0.23, 0.18, 0.43, 0.2).rotation.x = 1.1;
      for (let i = 0; i < 3; i++)
        this.mesh(root, this.sphere, glove, -0.08, -0.025 + i * 0.035, -0.04, 0.065, 0.035, 0.12);
      this.mergeParts(root);
      const grenade = this.createGrenade();
      grenade.name = 'held-grenade';
      root.add(grenade);
      root.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = false;
      });
      this.grenadeHandModel = root;
    }
    return this.grenadeHandModel.clone(true);
  }

  createRocket() {
    if (!this.rocketModel) {
      const root = new T.Group();
      root.name = 'rpg-rocket';
      const olive = this.surface('metal', 0x667046);
      const steel = this.surface('metal', 0x485254);
      const band = this.surface('metal', 0xbca55d);
      const body = this.mesh(root, this.cylinder, olive, 0, 0, -0.07, 0.17, 0.3, 0.17);
      body.rotation.x = Math.PI / 2;
      const tip = this.geometry(new T.ConeGeometry(0.085, 0.22, 10));
      this.mesh(root, tip, olive, 0, 0, -0.33, 1, 1, 1).rotation.x = -Math.PI / 2;
      this.mesh(root, this.cylinder, band, 0, 0, -0.21, 0.174, 0.035, 0.174).rotation.x = Math.PI / 2;
      this.mesh(root, this.cylinder, steel, 0, 0, 0.22, 0.065, 0.3, 0.065).rotation.x = Math.PI / 2;
      for (const angle of [0, Math.PI / 2]) {
        this.mesh(root, this.box, steel, 0, 0, 0.31, 0.19, 0.012, 0.13).rotation.z = angle;
      }
      const exhaust = new T.Group();
      exhaust.name = 'rocket-exhaust';
      const flame = this.material(new T.MeshBasicMaterial({
        color: 0xffb34a, transparent: true, opacity: 0.8,
        blending: T.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      this.mesh(exhaust, tip, flame, 0, 0, 0.55, 0.65, 1.8, 0.65).rotation.x = Math.PI / 2;
      root.add(exhaust);
      this.mergeParts(root);
      root.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = false;
      });
      this.rocketModel = root;
    }
    return this.rocketModel.clone(true);
  }

  rpgTemplate() {
    const root = new T.Group();
    root.name = 'rpg-launcher';
    const tube = this.surface('metal', 0x424e35);
    const steel = this.surface('metal', 0x606867);
    const wood = this.surface('cloth', 0x705039);
    const glove = this.surface('cloth', 0x192321);
    const sleeve = this.surface('cloth', 0x394a46);
    const bore = this.material(new T.MeshBasicMaterial({ color: 0x060909 }));
    this.mesh(root, this.cylinder, tube, 0, 0, -0.25, 0.145, 1.3, 0.145).rotation.x = Math.PI / 2;
    this.mesh(root, this.cylinder, wood, 0, 0, -0.15, 0.17, 0.45, 0.17).rotation.x = Math.PI / 2;
    for (const z of [-0.39, 0.09, -0.85])
      this.mesh(root, this.cylinder, steel, 0, 0, z, 0.177, 0.055, 0.177).rotation.x = Math.PI / 2;
    const bell = this.geometry(new T.CylinderGeometry(0.075, 0.15, 0.22, 12));
    this.mesh(root, bell, tube, 0, 0, 0.47, 1, 1, 1).rotation.x = -Math.PI / 2;
    this.mesh(root, this.cylinder, bore, 0, 0, 0.583, 0.25, 0.004, 0.25).rotation.x = Math.PI / 2;
    this.mesh(root, this.cylinder, bore, 0, 0, -0.906, 0.12, 0.006, 0.12).rotation.x = Math.PI / 2;
    for (const z of [-0.05, -0.52])
      this.mesh(root, this.rounded, wood, 0, -0.16, z, 0.09, 0.23, 0.115).rotation.x = -0.15;
    // Compact low-profile iron sights with distinct center aiming dot
    const sightDot = this.material(new T.MeshBasicMaterial({ color: 0x55ff55, toneMapped: false }));
    // Rear sight: open U-notch base and compact alignment ears at z = -0.14
    this.mesh(root, this.rounded, steel, 0, 0.102, -0.14, 0.036, 0.010, 0.018);
    this.mesh(root, this.rounded, steel, -0.015, 0.114, -0.14, 0.007, 0.018, 0.018);
    this.mesh(root, this.rounded, steel, 0.015, 0.114, -0.14, 0.007, 0.018, 0.018);
    // Front sight: slim post at z = -0.75 with high-visibility center dot at y = 0.120 (screen center in ADS)
    this.mesh(root, this.rounded, steel, 0, 0.096, -0.75, 0.018, 0.014, 0.020);
    this.mesh(root, this.rounded, steel, 0, 0.112, -0.75, 0.005, 0.018, 0.012);
    const dot = this.mesh(root, this.box, sightDot, 0, 0.120, -0.742, 0.004, 0.004, 0.002);
    dot.name = 'rpg-sight-dot';
    this.mesh(root, this.sphere, glove, 0.025, -0.19, -0.05, 0.18, 0.17, 0.2);
    this.mesh(root, this.taper, sleeve, 0.08, -0.29, 0.15, 0.2, 0.46, 0.21).rotation.x = 1.25;
    this.mesh(root, this.sphere, glove, -0.04, -0.18, -0.5, 0.19, 0.17, 0.2);
    this.mesh(root, this.taper, sleeve, -0.15, -0.3, -0.23, 0.2, 0.5, 0.22).rotation.x = 1.05;
    const action = new T.Group();
    action.name = 'action';
    root.add(action);
    const round = this.createRocket();
    round.name = 'loaded-rocket';
    round.position.z = -0.87;
    round.getObjectByName('rocket-exhaust')!.visible = false;
    root.add(round);
    this.mergeParts(root);
    root.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = false;
    });
    return root;
  }

  drillTemplate() {
    const root = new T.Group();
    root.name = 'drill';
    const housing = this.enemyMaterials.surface('corroded-metal', 0xc49b46, 'paint');
    const steel = this.enemyMaterials.surface('corroded-metal', 0xb9b5ab);
    this.mesh(root, this.cylinder, housing, 0, -0.12, 0, 0.35, 0.42, 0.35);
    this.mesh(root, this.rounded, housing, 0, -0.14, 0, 0.39, 0.2, 0.39);
    const bit = new T.Group();
    bit.name = 'drill-bit';
    bit.position.y = -0.34;
    root.add(bit);
    const cone = this.geometry(new T.ConeGeometry(0.17, 0.8, 12));
    this.mesh(bit, cone, steel, 0, -0.4, 0, 1, 1, 1).rotation.z = Math.PI;
    const points = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48, angle = t * Math.PI * 6, radius = 0.17 * (1 - t);
      return new T.Vector3(Math.cos(angle) * radius, -t * 0.8, Math.sin(angle) * radius);
    });
    const ridge = this.geometry(new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, 0.018, 4, false));
    this.mesh(bit, ridge, steel, 0, 0, 0, 1, 1, 1);
    return root;
  }

  chainsawTemplate() {
    const root = new T.Group();
    root.name = 'chainsaw';
    const housing = this.enemyMaterials.surface('corroded-metal', 0xba703c, 'paint');
    const steel = this.enemyMaterials.surface('corroded-metal', 0xb9b5ab);
    const dark = this.enemyMaterials.surface('corroded-metal', 0x454645, 'wet');
    const shape = (p: T.Object3D, g: T.BufferGeometry, m: T.Material,
      x: number, y: number, z: number, w: number, h: number, d: number) =>
      this.mesh(p, g, m, x, y, z, w, h, d);
    shape(root, this.rounded, housing, 0, -0.08, 0, 0.3, 0.34, 0.32);
    shape(root, this.rounded, dark, 0, 0.035, 0.16, 0.34, 0.09, 0.08);
    for (const side of [-1, 1]) {
      shape(root, this.rounded, dark, side * 0.15, 0.07, 0.07, 0.055, 0.15, 0.21);
      for (let i = 0; i < 4; i++)
        shape(root, this.box, dark, side * 0.154, -0.07 - i * 0.035, 0, 0.014, 0.016, 0.17);
    }
    // A narrow steel guide bar with rounded ends and teeth around its edge.
    shape(root, this.box, dark, 0, -0.6, 0, 0.07, 0.6, 0.23);
    shape(root, this.box, steel, 0, -0.6, 0, 0.08, 0.6, 0.19);
    for (const y of [-0.3, -0.9]) {
      shape(root, this.sphere, dark, 0, y, 0, 0.07, 0.23, 0.23);
      shape(root, this.sphere, steel, 0, y, 0, 0.08, 0.19, 0.19);
    }
    const chain = new T.Group();
    chain.name = 'saw-chain';
    root.add(chain);
    // Two merged tooth positions animate the chain without per-tooth draw calls.
    const radius = 0.125, straight = 0.6, arc = Math.PI * radius;
    for (let frame = 0; frame < 2; frame++) {
      const phase = new T.Group();
      phase.visible = frame === 0;
      chain.add(phase);
      for (let i = 0; i < 28; i++) {
        const travel = ((i + frame * 0.5) / 28) * (2 * straight + 2 * arc);
        let y: number, z: number, angle = 0;
        if (travel < straight) {
          y = -0.3 - travel; z = radius;
        } else if (travel < straight + arc) {
          angle = (travel - straight) / radius;
          y = -0.9 - Math.sin(angle) * radius; z = Math.cos(angle) * radius;
        } else if (travel < 2 * straight + arc) {
          y = -0.9 + travel - straight - arc; z = -radius;
        } else {
          angle = (travel - 2 * straight - arc) / radius;
          y = -0.3 + Math.sin(angle) * radius; z = -Math.cos(angle) * radius;
        }
        shape(phase, this.box, steel, 0, y, z, 0.1, 0.043, 0.035).rotation.x = angle;
      }
    }
    return root;
  }

  weaponTemplate(index: number) {
    if (index === 3) return this.katanaTemplate();
    if (index === 5) return this.rpgTemplate();
    const root = new T.Group(),
      action = new T.Group();
    action.name = 'action';
    root.add(action);
    const steel = this.surface('metal', 0x343e44),
      edges = this.surface('metal', 0x738084),
      black = this.surface('cloth', 0x171e20),
      polymer = this.surface('cloth', 0x3d463f),
      skin = this.surface('skin', 0xa18a73);
    const green = this.material(new T.MeshBasicMaterial({ color: 0xa9e0a0 })),
      bore = this.material(new T.MeshBasicMaterial({ color: 0x050707 }));
    const shape = (
      p: T.Object3D,
      g: T.BufferGeometry,
      m: T.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => this.mesh(p, g, m, x, y, z, w, h, d);
    const barrel = (
      p: T.Object3D,
      x: number,
      y: number,
      z: number,
      length: number,
      radius: number,
      material: T.Material,
    ) => {
      const m = shape(
        p,
        this.cylinder,
        material,
        x,
        y,
        z,
        radius,
        length,
        radius,
      );
      m.rotation.x = Math.PI / 2;
      return m;
    };
    if (index === 1) {
      createAR2Body(this, root, action);
    } else if (index === 0 || index === 4) {
      shape(action, this.rounded, steel, 0, 0.045, -0.23, 0.115, 0.13, 0.42);
      barrel(root, 0, 0.015, -0.425, 0.12, 0.067, edges);
      barrel(root, 0, 0.015, -0.487, 0.003, 0.044, bore);
      shape(root, this.rounded, black, 0, -0.065, -0.18, 0.117, 0.11, 0.29);
      shape(
        root,
        this.rounded,
        polymer,
        0,
        -0.18,
        -0.055,
        0.108,
        0.24,
        0.13,
      ).rotation.x = -0.22;
      shape(
        action,
        this.rounded,
        bore,
        0.058,
        0.071,
        -0.21,
        0.005,
        0.038,
        0.085,
      );
      for (const side of [-1, 1])
        for (let i = 0; i < 6; i++)
          shape(
            action,
            this.box,
            edges,
            side * 0.058,
            0.035,
            -0.1 - i * 0.014,
            0.004,
            0.067,
            0.004,
          );
      shape(root, this.rounded, black, 0, -0.16, -0.182, 0.115, 0.11, 0.15);
      shape(root, this.rounded, bore, 0, -0.145, -0.19, 0.12, 0.062, 0.092);
      if (index === 4) {
        // G18C: Extended 33-round magazine protruding from grip bottom
        const mag = new T.Group();
        mag.name = 'extended-mag';
        shape(mag, this.rounded, black, 0, -0.34, -0.015, 0.096, 0.16, 0.115).rotation.x = -0.22;
        shape(mag, this.box, polymer, 0, -0.42, 0.003, 0.106, 0.032, 0.125).rotation.x = -0.22;
        root.add(mag);

        // G18C: Full-auto selector switch on rear left side of slide
        const selector = new T.Group();
        selector.name = 'selector';
        const dial = shape(selector, this.cylinder, black, -0.061, 0.055, -0.09, 0.02, 0.008, 0.02);
        dial.rotation.z = Math.PI / 2;
        const lever = shape(selector, this.box, steel, -0.064, 0.044, -0.09, 0.005, 0.02, 0.008);
        lever.rotation.x = 0.25;
        action.add(selector);

        // G18C: Compensator ports cut into top front of slide revealing ported barrel
        const comp = new T.Group();
        comp.name = 'compensator';
        shape(comp, this.box, bore, 0, 0.112, -0.33, 0.06, 0.01, 0.075);
        for (let p = 0; p < 2; p++) {
          shape(comp, this.box, edges, 0, 0.082, -0.31 - p * 0.036, 0.036, 0.01, 0.015);
        }
        action.add(comp);
      }
    } else {
      shape(root, this.rounded, steel, 0, 0.005, -0.27, 0.15, 0.17, 0.53);
      shape(root, this.rounded, polymer, 0, -0.04, 0.05, 0.13, 0.17, 0.28);
      shape(
        root,
        this.rounded,
        polymer,
        0,
        -0.2,
        -0.055,
        0.115,
        0.24,
        0.15,
      ).rotation.x = -0.2;
      // Long precision barrel, compact ten-round magazine, and cheek rest.
      barrel(root, 0, 0.01, -0.86, 0.72, 0.057, edges);
      barrel(root, 0, 0.01, -1.19, 0.1, 0.082, steel);
      barrel(root, 0, 0.01, -1.242, 0.004, 0.037, bore);
      shape(root, this.rounded, polymer, 0, -0.035, -0.56, 0.14, 0.14, 0.42);
      shape(root, this.rounded, steel, 0, -0.16, -0.27, 0.095, 0.15, 0.16);
      shape(root, this.rounded, polymer, 0, -0.035, 0.18, 0.15, 0.17, 0.32);
      shape(root, this.rounded, black, 0, 0.065, 0.12, 0.16, 0.07, 0.22);

      const scope = new T.Group();
      scope.name = 'scope';
      root.add(scope);
      for (const z of [-0.12, -0.36]) {
        shape(scope, this.box, edges, 0, 0.15, z, 0.07, 0.12, 0.045);
        barrel(scope, 0, 0.235, z, 0.04, 0.115, edges);
      }
      barrel(scope, 0, 0.235, -0.25, 0.48, 0.085, black);
      barrel(scope, 0, 0.235, -0.455, 0.13, 0.14, steel);
      barrel(scope, 0, 0.235, -0.03, 0.09, 0.11, black);
      const glass = this.material(new T.MeshStandardMaterial({
        color: 0x397c8f, metalness: 0.65, roughness: 0.12,
      }));
      barrel(scope, 0, 0.235, -0.522, 0.004, 0.115, glass);
      barrel(scope, 0, 0.235, 0.017, 0.004, 0.088, glass);
      shape(scope, this.cylinder, edges, 0, 0.307, -0.22, 0.068, 0.065, 0.068);

      // The bolt remains a separate joint for the firing animation.
      shape(action, this.cylinder, edges, 0.11, 0.035, -0.16, 0.026, 0.1, 0.026).rotation.z = -1.1;
      shape(action, this.sphere, black, 0.155, 0.01, -0.16, 0.045, 0.045, 0.045);
      shape(root, this.rounded, black, 0.077, 0.045, -0.26, 0.008, 0.07, 0.15);
    }
    // Pistol sights remain separate from the reference-based AR-2 sights.
    if (index === 0 || index === 4) {
      // Low-profile rear sight with open notch (低背・コンパクトな凹型切り欠きリアサイト)
      shape(root, this.rounded, black, 0, 0.112, -0.07, 0.044, 0.005, 0.014);
      shape(root, this.rounded, black, -0.015, 0.119, -0.07, 0.012, 0.01, 0.014);
      shape(root, this.rounded, black, 0.015, 0.119, -0.07, 0.012, 0.01, 0.014);
      shape(root, this.box, green, -0.015, 0.12, -0.062, 0.004, 0.004, 0.002);
      shape(root, this.box, green, 0.015, 0.12, -0.062, 0.004, 0.004, 0.002);

      // Low-profile front sight post (低背でスリムなセンターポスト)
      const frontZ = index === 0 || index === 4 ? -0.405 : -0.65;
      shape(root, this.rounded, black, 0, 0.117, frontZ, 0.006, 0.014, 0.014);
      shape(root, this.box, green, 0, 0.12, frontZ + 0.008, 0.004, 0.004, 0.002);
    }
    if (index !== 1) {
      for (const side of [-1, 1])
        barrel(
          root,
          side * 0.058,
          -0.06,
          -0.04,
          0.012,
          0.018,
          edges,
        ).rotation.set(0, 0, Math.PI / 2);
      shape(
        root,
        this.taper,
        edges,
        0,
        -0.135,
        -0.156,
        0.025,
        0.075,
        0.032,
      ).rotation.x = 0.4;
    }
    const hand = index === 2 ? new T.Group() : root;
    if (index === 2) {
      hand.name = 'bolt-hand';
      root.add(hand);
    }
    if (index !== 1)
      shape(hand, this.sphere, black, 0.035, -0.23, -0.014, 0.18, 0.18, 0.22);
    shape(
      hand,
      this.taper,
      skin,
      0.065,
      -0.3,
      0.19,
      0.17,
      0.46,
      0.18,
    ).rotation.x = Math.PI / 2 - 0.2;
    shape(
      hand,
      this.taper,
      polymer,
      0.075,
      -0.33,
      0.38,
      0.23,
      0.24,
      0.24,
    ).rotation.x = Math.PI / 2 - 0.2;
    for (let i = 0; i < 3; i++)
      shape(
        hand,
        this.sphere,
        polymer,
        -0.027,
        -0.15 - i * 0.035,
        -0.07,
        0.15,
        0.043,
        0.06,
      );
    if (index === 1 || index === 2) {
      if (index === 2) {
        shape(root, this.sphere, black, -0.015, -0.15, -0.48, 0.2, 0.14, 0.2);
        const arm = shape(
          root,
          this.taper,
          polymer,
          -0.12,
          -0.29,
          -0.18,
          0.2,
          0.52,
          0.22,
        );
        arm.rotation.x = Math.PI / 2 - 0.3;
        arm.rotation.z = -0.5;
      }
      for (let i = 0; i < 3; i++)
        shape(
          root,
          this.sphere,
          polymer,
          0.06,
          -0.11,
          -0.43 - i * 0.04,
          0.055,
          0.13,
          0.04,
        );
    }
    this.mergeParts(root);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    return root;
  }

  katanaTemplate() {
    const root = new T.Group();
    const blade = new T.Group();
    blade.name = 'blade';
    root.add(blade);
    const outline = new T.Shape();
    // Spine (mune) along -X with subtle sori:
    outline.moveTo(-0.015, 0);
    outline.quadraticCurveTo(-0.015, 0.5, -0.018, 0.85);
    // Kissaki apex (sharp point at tip):
    outline.lineTo(-0.005, 1.06);
    // Fukura (curved cutting edge at kissaki) to main edge (+X):
    outline.quadraticCurveTo(0.013, 0.98, 0.012, 0.85);
    // Cutting edge (ha) running down to habaki:
    outline.quadraticCurveTo(0.016, 0.5, 0.018, 0);
    outline.closePath();
    const geometry = this.geometry(new T.ExtrudeGeometry(outline, {
      depth: 0.018, bevelEnabled: false, curveSegments: 10,
    }));
    const steel = this.material(new T.MeshStandardMaterial({
      color: 0xd5e0e3, metalness: 0.95, roughness: 0.18,
    }));
    const cuttingEdge = new T.Mesh(geometry, steel);
    cuttingEdge.position.set(0, 0.02, -0.009);
    blade.add(cuttingEdge);
    const wrap = this.surface('cloth', 0x182321);
    const gold = this.surface('metal', 0xa48a45);
    this.mesh(root, this.cylinder, gold, 0, 0.01, 0, 0.22, 0.028, 0.12);
    this.mesh(root, this.rounded, wrap, 0, -0.16, 0, 0.065, 0.32, 0.062);
    for (let i = 0; i < 8; i++) {
      const band = this.mesh(root, this.box, gold, 0, -0.035 - i * 0.036, 0.033, 0.06, 0.012, 0.004);
      band.rotation.z = i % 2 ? 0.45 : -0.45;
    }
    this.mesh(root, this.cylinder, gold, 0, -0.33, 0, 0.077, 0.025, 0.072);
    this.mergeParts(root);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    return root;
  }

  dispose() {
    this.enemyMaterials.dispose();
    this.environment?.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}

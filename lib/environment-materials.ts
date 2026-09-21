import * as T from 'three';

export type EnvironmentSurface = 'floor' | 'wall';
type Maps = Pick<T.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap'>;
const SURFACES = {
  floor: { fallback: 0x748180, tint: 0xc9cecc, relief: 0.45, meters: 2.1 },
  wall: { fallback: 0x647676, tint: 0xb5c1bd, relief: 0.5, meters: 4 },
} as const;

/** Only the arena floor and perimeter walls use these scene-owned texture sets. */
export class EnvironmentMaterials {
  materials = new Map<EnvironmentSurface, T.MeshStandardMaterial>();
  textures = new Set<T.Texture>();
  private disposed = false;
  private anisotropy = 1;
  private fallback: () => Maps;
  private loader: Pick<T.TextureLoader, 'load'> | null;

  constructor(
    fallback: () => Maps,
    loader: Pick<T.TextureLoader, 'load'> | null =
      typeof document === 'undefined' ? null : new T.TextureLoader(),
  ) {
    this.fallback = fallback;
    this.loader = loader;
  }

  preload(maxAnisotropy = 1) {
    if (this.disposed) return;
    this.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
    for (const texture of this.textures) {
      texture.anisotropy = this.anisotropy;
      texture.needsUpdate = true;
    }
    this.surface('floor');
    this.surface('wall');
  }

  surface(kind: EnvironmentSurface) {
    const cached = this.materials.get(kind);
    if (cached) return cached;
    if (this.disposed) throw new Error('Environment materials already disposed');
    const spec = SURFACES[kind];
    const material = new T.MeshStandardMaterial({
      ...this.fallback(),
      color: spec.fallback,
      normalScale: new T.Vector2(spec.relief, spec.relief),
      roughness: 1,
      metalness: 0,
    });
    material.name = `environment/${kind}`;
    if (kind === 'floor') {
      // Neutralize the source's brown cast without altering its measured relief/roughness.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb,
            vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.85);`,
        );
      };
      material.customProgramCacheKey = () => 'environment/floor/neutral-v1';
    }
    this.materials.set(kind, material);
    if (this.loader) this.load(kind, material);
    return material;
  }

  owns(material: T.Material) {
    return [...this.materials.values()].includes(material as T.MeshStandardMaterial);
  }

  private load(kind: EnvironmentSurface, material: T.MeshStandardMaterial) {
    const slots = ['map', 'normalMap', 'roughnessMap'] as const;
    const suffixes = ['albedo.webp', 'normal.png', 'roughness.png'];
    const maps: Maps = { map: null, normalMap: null, roughnessMap: null };
    const pending = new Set<T.Texture>();
    let remaining = slots.length, failed = false;
    const discard = () => {
      for (const texture of pending) {
        if (this.textures.delete(texture)) texture.dispose();
      }
    };
    slots.forEach((slot, i) => {
      const texture = this.loader!.load(
        `/textures/environment/${kind}-${suffixes[i]}`,
        (loaded) => {
          if (this.disposed || failed) return;
          maps[slot] = loaded;
          if (--remaining !== 0) return;
          // Switch complete sets together; a partial failure keeps the procedural surface.
          Object.assign(material, maps);
          material.color.setHex(SURFACES[kind].tint);
          material.needsUpdate = true;
        },
        undefined,
        () => { failed = true; discard(); },
      );
      texture.name = `environment/${kind}/${slot}`;
      texture.colorSpace = slot === 'map' ? T.SRGBColorSpace : T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = this.anisotropy;
      pending.add(texture);
      this.textures.add(texture);
      if (failed) discard();
    });
  }

  dispose() {
    this.disposed = true;
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.materials.clear();
    this.textures.clear();
  }
}

/** Keep the unit box/collider unchanged; only its UVs follow the mesh's meter scale. */
export function environmentBoxGeometry(size: T.Vector3, kind: EnvironmentSurface) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const uv = geometry.attributes.uv, meters = SURFACES[kind].meters;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * size.x, y = (positions.getY(i) + 0.5) * size.y;
    const z = positions.getZ(i) * size.z;
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
    const u = nx ? -nx * z : x * (nz || 1);
    const v = ny ? -ny * z : y;
    uv.setXY(i, u / meters, v / meters);
  }
  return geometry;
}

import * as T from 'three';

export const ENEMY_SURFACES = {
  'pale-skin': { fallback: 'skin', color: 0xb3a7a4, roughness: 0.9, relief: 0.45 },
  'exposed-muscle': { fallback: 'skin', color: 0x913b36, roughness: 0.7, relief: 0.65 },
  'bloated-skin': { fallback: 'skin', color: 0xb2b29a, roughness: 0.87, relief: 0.5 },
  'hardened-skin': { fallback: 'skin', color: 0x60656c, roughness: 0.85, relief: 0.65 },
  'charred-skin': { fallback: 'skin', color: 0x50403b, roughness: 0.97, relief: 0.8 },
  'dirty-cloth': { fallback: 'cloth', color: 0xb8aea0, roughness: 1, relief: 0.4 },
  'corroded-metal': { fallback: 'metal', color: 0x8d8981, roughness: 0.85, relief: 0.4 },
} as const;

type EnemySurface = keyof typeof ENEMY_SURFACES;
type Finish = 'default' | 'wet' | 'paint';
type Maps = Pick<T.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap'>;
type MapSet = {
  maps?: Maps;
  materials: Map<T.MeshStandardMaterial, number>;
};

/** Enemy-only tiles: one texture set per surface, shared by every tint and spawn. */
export class EnemyMaterials {
  materials = new Map<string, T.MeshStandardMaterial>();
  textures = new Set<T.Texture>();
  private sets = new Map<EnemySurface, MapSet>();
  private disposed = false;
  private fallback: (kind: 'skin' | 'cloth' | 'metal') => Maps;
  private loader: Pick<T.TextureLoader, 'load'> | null;

  constructor(
    fallback: (kind: 'skin' | 'cloth' | 'metal') => Maps,
    loader: Pick<T.TextureLoader, 'load'> | null =
      typeof document === 'undefined' ? null : new T.TextureLoader(),
  ) {
    this.fallback = fallback;
    this.loader = loader;
  }

  /** Start once during scene setup, so later waves don't initiate downloads. */
  preload() {
    if (this.disposed) return;
    for (const kind of Object.keys(ENEMY_SURFACES) as EnemySurface[]) this.mapSet(kind);
  }

  surface(kind: EnemySurface, tint = 0xffffff, finish: Finish = 'default') {
    const key = `${kind}/${tint}/${finish}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const spec = ENEMY_SURFACES[kind], set = this.mapSet(kind);
    const material = new T.MeshStandardMaterial({
      ...(set.maps ?? this.fallback(spec.fallback)),
      color: new T.Color(tint).multiply(new T.Color(set.maps ? 0xffffff : spec.color)),
      normalScale: new T.Vector2(spec.relief, spec.relief),
      roughness: finish === 'wet' ? 0.48 : spec.roughness,
      metalness: kind === 'corroded-metal' ? (finish === 'paint' ? 0.25 : 0.68) : 0,
    });
    material.name = `enemy/${key}`;
    this.materials.set(key, material);
    set.materials.set(material, tint);
    return material;
  }

  private mapSet(kind: EnemySurface) {
    const cached = this.sets.get(kind);
    if (cached) return cached;
    const set: MapSet = { materials: new Map() };
    this.sets.set(kind, set);
    if (!this.loader || this.disposed) return set;

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
        `/textures/enemies/${kind}-${suffixes[i]}`,
        (loaded) => {
          if (this.disposed || failed) return;
          maps[slot] = loaded;
          if (--remaining !== 0) return;
          set.maps = maps;
          // Commit a complete set together; existing clones share these materials.
          for (const [material, tint] of set.materials) {
            Object.assign(material, maps);
            material.color.setHex(tint);
            material.needsUpdate = true;
          }
        },
        undefined,
        () => {
          failed = true;
          discard();
          // Retain procedural materials on failure. Never retry once per spawn.
        },
      );
      texture.name = `enemy/${kind}/${slot}`;
      texture.colorSpace = slot === 'map' ? T.SRGBColorSpace : T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.magFilter = T.LinearFilter;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4;
      pending.add(texture);
      this.textures.add(texture);
      if (failed) discard();
    });
    return set;
  }

  dispose() {
    this.disposed = true;
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.materials.clear();
    this.textures.clear();
    this.sets.clear();
  }
}

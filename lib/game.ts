import * as T from 'three';
import { Graphics, type EnemyRig, type Quality } from './graphics.ts';
import { WeaponRecoil, RECOIL_PROFILES, G18C_RECOIL } from './recoil.ts';
import { HANS, HansEncounter, type BossSnapshot } from './hans.ts';
import { SIREN, SirenAttack, replaceSirenSlots } from './siren.ts';
export type Snapshot = {
  bossDebug: boolean;
  debugTargetWave?: number;
  debugMinHp?: boolean;
  boss: BossSnapshot | null;
  mode: 'menu' | 'playing' | 'paused' | 'cleared' | 'shop' | 'dead' | 'won';
  wave: number;
  health: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  cash: number;
  kills: number;
  remaining: number;
  ammo: number;
  reserve: number;
  ammoFull: boolean;
  weapon: string;
  scoped: boolean;
  aiming: boolean;
  bolt: number;
  reload: number;
  message: string;
  pointerLockError: string;
  hit: number;
  hurt: number;
  grenades: number;
  maxGrenades: number;
  difficulty: 'normal' | 'hard';
  medicalKits: number;
  healCooldown: number;
  owned: boolean[];
  katana: boolean;
  g18c: boolean;
  pouch: boolean;
  level: number;
  time: number;
  fps: number;
  bgm: boolean;
};
export type Enemy = EnemyRig & {
  siren?: SirenAttack;
  hp: number;
  maxHp: number;
  scrakeEnraged: boolean;
  speed: number;
  damage: number;
  kind: number;
  phase: number;
  attack: number;
  meleeSwing: number;
  ragePhase: 'calm' | 'windup' | 'charging';
  rageTime: number;
  chargeDirection: T.Vector3;
  rangedWindup: number;
  rangedCooldown: number;
  rangedAim: T.Vector3 | null;
  dead: boolean;
  shadow: T.Mesh;
};
type Particle = {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  max: number;
};
type EnemyProjectile = {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  damage: number;
  kind: 'bile' | 'cannon' | 'rifle';
};
type ThrownGrenade = {
  mesh: T.Group;
  velocity: T.Vector3;
  fuse: number;
};
// 0: Clot (former Walker), 1: Gorefast (former Runner), 2: Scrake (former Brute),
// 3: Freshpound (former Boss), 4: Bloat (former Spitter), 5: Crawler, 6: Husk, 7: Hans Volter, 8: Siren.
export const ENEMY_SPECS = [
  { name: 'Clot', hp: 65, speed: 1.35, damage: 10, reward: 65 },
  { name: 'Gorefast', hp: 90, speed: 2.65, damage: 10, reward: 85 },
  { name: 'Scrake', hp: 1000, speed: 1, damage: 30, reward: 130 },
  { name: 'Freshpound', hp: 3000, speed: 1.5, damage: 42, reward: 450 },
  { name: 'Bloat', hp: 130, speed: 1.05, damage: 12, reward: 110 },
  { name: 'Crawler', hp: 60, speed: 1.55, damage: 9, reward: 55 },
  { name: 'Husk', hp: 240, speed: 1.1, damage: 28, reward: 160 },
  { name: 'Hans Volter', hp: HANS.hp, speed: HANS.speed, damage: HANS.clawDamage, reward: 2000 },
  { name: 'Siren', hp: SIREN.hp, speed: SIREN.speed, damage: SIREN.damagePerSecond, reward: SIREN.reward },
] as const;
const ENEMIES = ENEMY_SPECS;
const SNIPER_BOLT_DURATION = 1.1;
const KATANA = { damage: 100, range: 3.9, rate: 0.8 };
const FRESHPOUND_RAGE = { interval: 10, windup: 1, duration: 3, speedMultiplier: 10 };

function makeKatanaQuat(edgeDir: T.Vector3, bladeDir: T.Vector3): T.Quaternion {
  const b = bladeDir.clone().normalize();
  const e = edgeDir.clone().sub(b.clone().multiplyScalar(edgeDir.dot(b))).normalize();
  const f = new T.Vector3().crossVectors(e, b).normalize();
  const m = new T.Matrix4().makeBasis(e, b, f);
  return new T.Quaternion().setFromRotationMatrix(m);
}

const _bWindup = new T.Vector3(-0.70, 0.12, -0.70).normalize();
const _eWindup = new T.Vector3(0.70, 0.05, -0.71).normalize();
const _qWindup = makeKatanaQuat(_eWindup, _bWindup);

const _bFollow = new T.Vector3(0.85, 0.02, -0.52).normalize();
const _eFollow = new T.Vector3(0.52, -0.05, 0.85).normalize();
const _qFollow = makeKatanaQuat(_eFollow, _bFollow);

export const KATANA_ANIM = {
  pReady: new T.Vector3(-0.35, -0.40, -0.42),
  qReady: makeKatanaQuat(new T.Vector3(0.85, 0.10, -0.50), new T.Vector3(-0.55, 0.35, -0.75)),

  pWindup: new T.Vector3(-0.32, -0.15, -0.42),
  qWindup: _qWindup,

  pSlashMid: new T.Vector3(0.00, -0.13, -0.60),

  pFollow: new T.Vector3(0.32, -0.14, -0.44),
  qFollow: _qFollow,

  pSettle: new T.Vector3(0.35, -0.16, -0.44),
  qSettle: makeKatanaQuat(new T.Vector3(0.48, -0.08, 0.87), new T.Vector3(0.87, 0.00, -0.48)),

  pExit: new T.Vector3(0.38, -0.62, -0.52),
  qExit: makeKatanaQuat(new T.Vector3(0.45, -0.45, 0.77), new T.Vector3(0.75, -0.35, -0.55)),
};

const _katanaPos = new T.Vector3();
const _katanaQuat = new T.Quaternion();

export function evaluateKatanaMotion(
  progress: number,
  outPos?: T.Vector3,
  outQuat?: T.Quaternion,
): { pos: T.Vector3; quat: T.Quaternion } {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const targetPos = outPos ?? new T.Vector3();
  const targetQuat = outQuat ?? new T.Quaternion();
  if (p < 0.12) {
    const u = p / 0.12;
    const ease = u * (2 - u);
    targetPos.lerpVectors(KATANA_ANIM.pReady, KATANA_ANIM.pWindup, ease);
    targetQuat.slerpQuaternions(KATANA_ANIM.qReady, KATANA_ANIM.qWindup, ease);
  } else if (p < 0.38) {
    const u = (p - 0.12) / 0.26;
    const ease = u * u * (3 - 2 * u);
    const oneMinus = 1 - ease;
    targetPos
      .copy(KATANA_ANIM.pWindup)
      .multiplyScalar(oneMinus * oneMinus)
      .addScaledVector(KATANA_ANIM.pSlashMid, 2 * oneMinus * ease)
      .addScaledVector(KATANA_ANIM.pFollow, ease * ease);
    targetQuat.slerpQuaternions(KATANA_ANIM.qWindup, KATANA_ANIM.qFollow, ease);
  } else if (p < 0.50) {
    const u = (p - 0.38) / 0.12;
    const ease = u * u * (3 - 2 * u);
    targetPos.lerpVectors(KATANA_ANIM.pFollow, KATANA_ANIM.pSettle, ease);
    targetQuat.slerpQuaternions(KATANA_ANIM.qFollow, KATANA_ANIM.qSettle, ease);
  } else {
    const u = (p - 0.50) / 0.50;
    const ease = u * u * (3 - 2 * u);
    targetPos.lerpVectors(KATANA_ANIM.pSettle, KATANA_ANIM.pExit, ease);
    targetQuat.slerpQuaternions(KATANA_ANIM.qSettle, KATANA_ANIM.qExit, ease);
  }
  return { pos: targetPos, quat: targetQuat };
}
const FRESHPOUND_DRILL = { range: 3.0 };
const SCRAKE_MELEE = { range: 3.9, swingDuration: 0.3 };
const SCRAKE_RAGE = { hpRatio: 0.1, speedMultiplier: 3.5, contactDistance: 1.35 };
export const STAMINA = { max: 100, drain: 20, recover: 20 };
export const MEDICAL_KIT = { heal: 50, max: 3, cooldown: 8 };
export const GRENADE = { throwDuration: 0.55, release: 0.20, fuse: 1.0, speed: 15, gravity: 12, radius: 0.18 };
export const RPG = { damage: 600, speed: 60, life: 2, reload: 2.4, rate: 0.9, cost: 4000 } as const;
const LOOK_PITCH_LIMIT = 1.53;
const WEAPONS = [
  {
    name: 'H1 SERVICE PISTOL',
    mag: 12,
    reserve: 48,
    damage: 24,
    rate: 0.24,
    reload: 1.35,
    pellets: 1,
    spread: 0.024,
    adsSpread: 0.0035,
  },
  {
    name: 'AR-2 ASSAULT RIFLE',
    mag: 30,
    reserve: 120,
    damage: 30,
    rate: 0.095,
    reload: 1.9,
    pellets: 1,
    spread: 0.065,
    adsSpread: 0.0075,
  },
  {
    name: 'SR-3 SNIPER RIFLE',
    mag: 5,
    reserve: 18,
    damage: 150,
    rate: SNIPER_BOLT_DURATION,
    reload: 2.5,
    pellets: 1,
    spread: 0.15,
    adsSpread: 0,
    pierce: 3,
  },
  {
    name: 'RPG-7',
    mag: 1,
    reserve: 7,
    damage: 0,
    rate: RPG.rate,
    reload: RPG.reload,
    pellets: 1,
    spread: 0,
    adsSpread: 0,
  },
];
export const G18C_WEAPON = {
  name: 'G18C MACHINE PISTOL',
  mag: 33,
  reserve: 132,
  damage: 22,
  rate: 0.068,
  reload: 1.35,
  pellets: 1,
  spread: 0.048,
  adsSpread: 0.009,
};
const BOX = new T.BoxGeometry(1, 1, 1),
  SPHERE = new T.SphereGeometry(1, 8, 6);
type Rocket = { mesh: T.Group; velocity: T.Vector3; life: number };
export class Game {
  rockets: Rocket[] = [];
  graphics = new Graphics();
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(76, 1, 0.06, 150);
  renderer: T.WebGLRenderer;
  host: HTMLElement;
  callback: (s: Snapshot) => void;
  state: Snapshot = {
    bossDebug: false,
    debugTargetWave: undefined,
    debugMinHp: false,
    boss: null,
    mode: 'menu',
    wave: 0,
    health: 100,
    armor: 100,
    maxArmor: 100,
    stamina: 100,
    cash: 500,
    kills: 0,
    remaining: 0,
    ammo: 12,
    reserve: 48,
    ammoFull: true,
    weapon: WEAPONS[0].name,
    scoped: false,
    aiming: false,
    bolt: 0,
    reload: 0,
    message: '',
    pointerLockError: '',
    hit: 0,
    hurt: 0,
    grenades: 3,
    maxGrenades: 3,
    difficulty: 'normal',
    medicalKits: MEDICAL_KIT.max,
    healCooldown: 0,
    owned: [true, false, false, false],
    katana: false,
    g18c: false,
    pouch: false,
    level: 0,
    time: 0,
    fps: 60,
    bgm: true,
  };
  enemies: Enemy[] = [];
  hans?: HansEncounter;
  private enemySpawnPlan?: { key: string; kinds: number[] };
  particles: Particle[] = [];
  enemyProjectiles: EnemyProjectile[] = [];
  thrownGrenades: ThrownGrenade[] = [];
  grenadeHand?: T.Group;
  heldGrenade?: T.Object3D;
  bileMaterial?: T.MeshStandardMaterial;
  cannonMaterial?: T.MeshBasicMaterial;
  obstacles: T.Box3[] = [];
  walls: T.Mesh[] = [];
  materials: T.Material[] = [];
  textures: T.Texture[] = [];
  materialCache = new Map<string, T.MeshStandardMaterial>();
  keys = new Set<string>();
  gun = new T.Group();
  katana = new T.Group();
  flash = new T.Group();
  flashLight = new T.PointLight(0xffaa55, 0, 12);
  weaponIndex = 0;
  ammo = WEAPONS.map((w) => w.mag);
  reserve = WEAPONS.map((w) => w.reserve);
  yaw = 0;
  pitch = 0;
  shooting = false;
  aiming = false;
  recoil = 0;
  viewRecoil = new WeaponRecoil();
  cooldown = 0;
  sniperBoltTime = 0;
  sniperReloadQueued = false;
  reloadTime = 0;
  messageTime = 0;
  meleeTime = 0;
  grenadeTime = 0;
  grenadeThrowTime = 0;
  spawnTime = 0;
  pending = 0;
  waveTime = 0;
  vertical = 0;
  feet = 0;
  elapsed = 0;
  last = 0;
  uiTime = 0;
  raf = 0;
  disposed = false;
  pointerLockRequest = 0;
  difficulty = 1;
  difficultyMode: 'normal' | 'hard' = 'normal';
  audio: AudioContext | null = null;
  master: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  bgmAudio: HTMLAudioElement | null = null;
  bgmSource: MediaElementAudioSourceNode | null = null;
  bgmGain: GainNode | null = null;
  bgmEnabled = true;
  bgmStarted = false;
  muted = false;
  ray = new T.Raycaster();
  events: Array<() => void> = [];
  nav = new Int16Array(61 * 61);
  navTime = 0;
  quality: Quality = 'high';
  moon = new T.DirectionalLight(0xa5cbe1, 2.4);
  flashlight = new T.SpotLight(0xcfe5da, 15, 24, 0.48, 0.65, 2);
  gunAction?: T.Object3D;
  gunBoltHand?: T.Object3D;
  contactMaterial?: T.MeshBasicMaterial;
  glows: T.Sprite[] = [];
  sceneryBatches = { before: 0, after: 0 };
  corpses: Array<{ enemy: Enemy; age: number }> = [];
  previousFrame = 0;
  frameSamples = 0;
  frameTotal = 0;
  fps = 60;
  constructor(host: HTMLElement, callback: (s: Snapshot) => void) {
    this.host = host;
    this.callback = callback;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color(0x101e28);
    this.scene.fog = new T.FogExp2(0x162a31, 0.023);
    this.scene.add(new T.HemisphereLight(0x8bc5dc, 0x28261e, 0.8));
    this.graphics.environmentLighting(this.renderer, this.scene);
    const moon = this.moon;
    moon.position.set(-14, 28, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -36;
    moon.shadow.camera.right = 36;
    moon.shadow.camera.top = 36;
    moon.shadow.camera.bottom = -36;
    moon.shadow.normalBias = 0.035;
    this.scene.add(moon);
    this.buildWorld();
    this.sceneryBatches = this.graphics.batchScenery(this.scene, this.walls);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.7, 17);
    this.scene.add(this.camera);
    const beamTarget = new T.Object3D();
    beamTarget.position.set(0, 0, -15);
    this.camera.add(beamTarget);
    this.camera.add(this.flashlight);
    this.flashlight.target = beamTarget;
    this.flashlight.position.set(0.2, -0.18, -0.4);
    this.buildGun();
    this.listen(window, 'resize', this.resize);
    this.listen(document, 'keydown', this.keydown);
    this.listen(document, 'keyup', (e: KeyboardEvent) =>
      this.keys.delete(e.code),
    );
    this.listen(document, 'mousemove', this.mousemove);
    this.listen(document, 'mousedown', this.mousedown);
    this.listen(document, 'mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.shooting = false;
      if (e.button === 2) {
        this.aiming = false;
        this.emit();
      }
    });
    this.listen(host, 'contextmenu', (e: Event) => e.preventDefault());
    this.listen(document, 'pointerlockchange', () => {
      if (
        document.pointerLockElement !== this.renderer.domElement &&
        this.state.mode === 'playing'
      )
        this.pause();
    });
    this.listen(window, 'blur', () => this.pause());
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }
  listen<T extends Event = Event>(
    target: EventTarget,
    name: string,
    fn: (e: T) => void | boolean,
  ) {
    const listener = fn as unknown as EventListener;
    target.addEventListener(name, listener);
    this.events.push(() => target.removeEventListener(name, listener));
  }
  mat(color: number, metal = 0.2, rough = 0.7, emissive = 0) {
    const key = `${color}/${metal}/${rough}/${emissive}`;
    const existing = this.materialCache.get(key);
    if (existing) return existing;
    const m = new T.MeshStandardMaterial({
      color,
      metalness: metal,
      roughness: rough,
      emissive,
      emissiveIntensity: emissive ? 2 : 0,
    });
    this.materials.push(m);
    this.materialCache.set(key, m);
    return m;
  }
  box(
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    solid = false,
  ) {
    const mesh = new T.Mesh(BOX, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (solid) {
      mesh.updateMatrixWorld();
      this.obstacles.push(new T.Box3().setFromObject(mesh));
      this.walls.push(mesh);
    }
    return mesh;
  }
  label(
    text: string,
    width: number,
    height: number,
    color = '#b9c7b8',
    bg = '#243235',
  ) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(15, 15, 994, 226);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px Arial';
    ctx.fillText(text, 512, 138);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    this.textures.push(tex);
    const mat = new T.MeshBasicMaterial({ map: tex });
    this.materials.push(mat);
    return new T.Mesh(new T.PlaneGeometry(width, height), mat);
  }
  buildWorld() {
    const concrete = this.graphics.surface('concrete', 0x75817b, 2),
      wall = this.graphics.surface('concrete', 0x647676, 8, 3),
      dark = this.mat(0x18262b, 0.7, 0.45),
      rust = this.graphics.surface('metal', 0x805039, 2),
      yellow = this.mat(0xb69843, 0.4, 0.65),
      steel = this.graphics.surface('metal', 0x899d9b),
      light = this.mat(0xe3f7e6, 0.2, 0.3, 0xaeeccd);
    const floor = this.graphics.surface('concrete', 0x748180, 20);
    floor.roughness = 0.76;
    this.box(this.scene, 0, -0.25, 0, 64, 0.5, 64, floor);
    const radial = this.graphics.radialTexture();
    this.contactMaterial = this.graphics.material(
      new T.MeshBasicMaterial({
        map: radial,
        color: 0x020708,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    const halo = this.graphics.material(
      new T.SpriteMaterial({
        map: radial,
        color: 0xadf1de,
        transparent: true,
        opacity: 0.3,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const warningHalo = this.graphics.material(
      new T.SpriteMaterial({
        map: radial,
        color: 0xff5c26,
        transparent: true,
        opacity: 0.55,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const glow = (x: number, y: number, z: number, red = false) => {
      const sprite = new T.Sprite(red ? warningHalo : halo);
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(red ? 2.2 : 3.8);
      this.glows.push(sprite);
      this.scene.add(sprite);
    };
    const puddleMaterial = this.graphics.material(
      new T.MeshStandardMaterial({
        color: 0x354c52,
        metalness: 0.32,
        roughness: 0.12,
        transparent: true,
        opacity: 0.55,
        normalMap: this.graphics.createMaps('metal').normalMap,
        normalScale: new T.Vector2(0.04, 0.04),
        depthWrite: false,
      }),
    );
    const puddleGeometry = this.graphics.geometry(new T.CircleGeometry(1, 22));
    for (let n = -30; n <= 30; n += 4) {
      this.box(this.scene, n, 0.005, 0, 0.022, 0.01, 63, dark);
      this.box(this.scene, 0, 0.006, n, 63, 0.01, 0.022, dark);
    }
    for (let i = 0; i < 24; i++) {
      const p = new T.Mesh(puddleGeometry, puddleMaterial);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(1 + Math.random() * 3, 0.5 + Math.random() * 1.5, 1);
      p.position.set(
        (Math.random() - 0.5) * 56,
        0.013,
        (Math.random() - 0.5) * 56,
      );
      this.scene.add(p);
    }
    this.box(this.scene, 0, 6, -32, 66, 12, 2, wall, true);
    this.box(this.scene, -32, 6, 0, 2, 12, 64, wall, true);
    this.box(this.scene, 32, 6, 0, 2, 12, 64, wall, true);
    this.box(this.scene, 0, 6, 32, 64, 12, 2, wall, true);
    for (let i = -28; i <= 28; i += 4) {
      this.box(this.scene, i, 6, -30.9, 0.15, 12, 0.12, steel);
      this.box(this.scene, -30.9, 6, i, 0.12, 12, 0.15, steel);
      this.box(this.scene, 30.9, 6, i, 0.12, 12, 0.15, steel);
      for (const side of [-1, 1])
        this.box(
          this.scene,
          side * 30.8,
          8.6,
          i,
          0.05,
          1.5,
          2.2,
          this.mat(
            i % 8 === 0 ? 0x91a89d : 0x263b42,
            0.1,
            0.5,
            i % 8 === 0 ? 0x395b54 : 0,
          ),
        );
    }
    this.box(this.scene, 0, 3, -30.8, 10, 6, 0.25, dark);
    for (let n = 0; n < 12; n++)
      this.box(this.scene, 0, n * 0.47 + 0.2, -30.55, 9.8, 0.035, 0.09, steel);
    const sign = this.label('SECTOR 07', 9, 2);
    sign.position.set(0, 8, -30.7);
    this.scene.add(sign);
    const quarantine = this.label('QUARANTINE', 6, 1, '#e77155', '#351f1a');
    quarantine.position.set(18, 3.7, -30.7);
    this.scene.add(quarantine);
    // Corrugated shipping containers create cover and intersecting combat lanes.
    for (const [x, z, w, d, c] of [
      [-14, -12, 7, 12, 0x304f53],
      [13, -15, 8, 10, 0x784b35],
      [-18, 10, 6, 10, 0x4e5145],
      [16, 9, 8, 7, 0x364e4b],
    ]) {
      const m = this.graphics.surface('metal', c, 3, 1.5);
      this.box(this.scene, x, 1.7, z, w, 3.4, d, m, true);
      for (let n = -w / 2 + 0.3; n < w / 2; n += 0.45) {
        this.box(
          this.scene,
          x + n,
          1.7,
          z + d / 2 + 0.02,
          0.065,
          3.2,
          0.09,
          steel,
        );
        this.box(this.scene, x + n, 1.7, z - d / 2 - 0.02, 0.065, 3.2, 0.09, m);
      }
      this.box(this.scene, x, 3.45, z, w + 0.1, 0.12, d + 0.1, dark);
      const tag = this.label(
        '07 / BIOHAZARD',
        Math.min(w - 1, 4),
        0.7,
        '#cec4a0',
        '#283434',
      );
      tag.position.set(x, 2.3, z + d / 2 + 0.09);
      this.scene.add(tag);
      for (const side of [-1, 1]) {
        this.box(
          this.scene,
          x + side * w * 0.23,
          1.6,
          z + d / 2 + 0.13,
          0.07,
          2.85,
          0.07,
          steel,
        );
        for (const y of [0.35, 2.7])
          this.box(
            this.scene,
            x + side * w * 0.23,
            y,
            z + d / 2 + 0.18,
            0.3,
            0.09,
            0.08,
            dark,
          );
      }
    }
    for (const [x, z] of [
      [-7, 2],
      [7, -3],
      [23, -5],
      [-24, -22],
    ]) {
      this.box(this.scene, x, 0.65, z, 3, 1.3, 1.2, concrete, true);
      for (let j = 0; j < 5; j++) {
        const stripe = this.box(
          this.scene,
          x - 1.1 + j * 0.52,
          0.67,
          z + 0.61,
          0.22,
          1.05,
          0.02,
          yellow,
        );
        stripe.rotation.z = -0.35;
      }
    }
    for (const [x, z] of [
      [-24, 21],
      [24, 21],
      [-25, -23],
      [25, -24],
    ]) {
      this.box(this.scene, x, 4.7, z, 0.13, 9.4, 0.13, steel);
      this.box(this.scene, x, 9.4, z, 2, 0.16, 0.7, dark);
      this.box(this.scene, x, 9.25, z, 1.8, 0.06, 0.5, light);
      if (x > 0) {
        const l = new T.PointLight(0xb8e6df, 65, 32, 2);
        l.position.set(x, 8.8, z);
        this.scene.add(l);
      }
      glow(x, 9.15, z);
    }
    for (const x of [-6, 6]) {
      this.box(this.scene, x, 3, -30.3, 0.3, 6, 0.3, yellow);
      this.box(
        this.scene,
        x,
        6.3,
        -30,
        0.65,
        0.3,
        0.3,
        this.mat(0xff3d16, 0, 0.5, 0xff2505),
      );
      const l = new T.PointLight(0xff4820, 38, 18, 2);
      l.position.set(x, 5.8, -28);
      this.scene.add(l);
      glow(x, 6.3, -29.8, true);
    }
    // Industrial pipework along perimeter walls.
    for (let i = 0; i < 3; i++) {
      this.box(this.scene, -29 + i * 0.55, 5.2, -3, 0.3, 0.3, 54, rust);
      this.box(this.scene, 29 - i * 0.55, 4, -3, 0.3, 0.3, 54, dark);
    }
    for (const [x, z] of [
      [-9, 20],
      [24, 4],
      [-25, -3],
      [10, -25],
    ]) {
      const cyl = new T.Mesh(
        new T.CylinderGeometry(0.48, 0.48, 1.35, 12),
        rust,
      );
      cyl.position.set(x, 0.68, z);
      cyl.castShadow = true;
      this.scene.add(cyl);
      this.obstacles.push(
        new T.Box3(
          new T.Vector3(x - 0.5, 0, z - 0.5),
          new T.Vector3(x + 0.5, 1.35, z + 0.5),
        ),
      );
      this.walls.push(cyl);
      this.box(this.scene, x, 0.7, z + 0.49, 0.6, 0.3, 0.02, yellow);
    }
    // Mark a navigable central lane with worn yellow paint.
    for (let z = -27; z < 29; z += 5) {
      this.box(this.scene, -3, 0.017, z, 0.09, 0.01, 2.3, yellow);
      this.box(this.scene, 3, 0.017, z, 0.09, 0.01, 2.3, yellow);
    }
    const moon = new T.Mesh(
      new T.SphereGeometry(2.5, 16, 12),
      new T.MeshBasicMaterial({ color: 0xbbd8dd }),
    );
    moon.position.set(18, 32, -75);
    this.scene.add(moon);
    // Silhouettes above the enclosure and recessed drains add depth without extra lights.
    for (let n = 0; n < 10; n++) {
      const x = -43 + n * 10,
        height = 14 + ((n * 7) % 13);
      this.box(this.scene, x, height / 2, -47, 7, height, 7, dark);
      this.box(this.scene, x + 1, height + 2, -47, 0.9, 4, 0.9, rust);
    }
    for (const x of [-4.7, 4.7])
      for (let z = -24; z <= 24; z += 8) {
        this.box(this.scene, x, 0.022, z, 0.6, 0.014, 2.5, dark);
        for (let i = 0; i < 10; i++)
          this.box(
            this.scene,
            x,
            0.033,
            z - 1.05 + i * 0.23,
            0.54,
            0.016,
            0.055,
            steel,
          );
      }
    for (const bounds of this.obstacles) {
      const size = bounds.getSize(new T.Vector3());
      if (size.x > 15 || size.z > 15) continue;
      const center = bounds.getCenter(new T.Vector3());
      this.contactShadow(center.x, center.z, size.x + 1.8, size.z + 1.8);
    }
  }
  contactShadow(x: number, z: number, w: number, d: number) {
    const shadow = new T.Mesh(this.graphics.plane, this.contactMaterial!);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.025, z);
    shadow.scale.set(w, d, 1);
    shadow.renderOrder = 1;
    this.scene.add(shadow);
    return shadow;
  }
  buildGun() {
    this.gun.clear();
    this.camera.add(this.gun);
    const model = this.graphics.createWeapon(this.weaponIndex === 0 && this.state?.g18c ? 4 : this.weaponIndex === 3 ? 5 : this.weaponIndex);
    if (this.weaponIndex === 3) {
      const loaded = model.getObjectByName('loaded-rocket');
      if (loaded) loaded.visible = this.ammo[3] > 0;
    }
    this.gun.add(model);
    this.gunAction = model.getObjectByName('action');
    this.gunBoltHand = model.getObjectByName('bolt-hand');
    if (this.flash.children.length === 0) {
      const fm = this.graphics.material(
        new T.MeshBasicMaterial({
          color: 0xffd791,
          transparent: true,
          opacity: 0.9,
          blending: T.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const geometry = this.graphics.geometry(
        new T.ConeGeometry(0.055, 0.24, 5),
      );
      for (let i = 0; i < 3; i++) {
        const mesh = new T.Mesh(geometry, fm);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = i;
        this.flash.add(mesh);
      }
    }
    this.flash.position.set(
      0, 0.01, this.weaponIndex === 0 ? -0.52 : this.weaponIndex === 2 ? -1.25 : -0.98,
    );
    this.gun.add(this.flash, this.flashLight);
    this.flashLight.position.copy(this.flash.position);
    this.flash.visible = false;
    this.gun.position.set(0.27, -0.25, -0.42);
  }
  buildKatana() {
    if (this.katana.children.length === 0)
      this.katana.add(this.graphics.createWeapon(3));
    this.camera.add(this.katana);
    this.katana.visible = false;
    evaluateKatanaMotion(0, this.katana.position, this.katana.quaternion);
  }
  setQuality(_quality: Quality = 'high') {
    this.quality = 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.moon.castShadow = true;
    if (this.moon.shadow.mapSize.x !== 2048) {
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
      this.moon.shadow.mapSize.set(2048, 2048);
    }
    this.glows.forEach((g) => (g.visible = true));
    this.resize();
  }
  resize = () => {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  getWeapon(index = this.weaponIndex) {
    if (index === 0 && this.state?.g18c) return G18C_WEAPON;
    return WEAPONS[index];
  }
  getMaxReserve(index = this.weaponIndex): number {
    const base = this.getWeapon(index).reserve;
    return this.state?.pouch ? Math.round(base * 1.5) : base;
  }
  isAmmoFull() {
    return WEAPONS.every(
      (_, i) =>
        !this.state.owned[i] ||
        (this.ammo[i] >= this.getWeapon(i).mag &&
          this.reserve[i] >= this.getMaxReserve(i)),
    );
  }
  getMaxArmor(): number {
    return 100;
  }
  getMaxGrenades(pouch = this.state?.pouch ?? false): number {
    return 3 + (pouch ? 2 : 0);
  }
  emit() {
    this.state.boss = this.hans && !this.hans.enemy.dead ? this.hans.snapshot() : null;
    this.state.ammo = this.ammo[this.weaponIndex];
    this.state.reserve = this.reserve[this.weaponIndex];
    this.state.ammoFull = this.isAmmoFull();
    this.state.weapon = this.getWeapon(this.weaponIndex).name;
    this.state.scoped = this.isScoped();
    this.state.aiming = this.aiming && !this.isThrowingGrenade();
    this.state.bolt = this.isCyclingBolt()
      ? this.sniperBoltTime / SNIPER_BOLT_DURATION
      : 0;
    this.state.fps = this.fps;
    this.state.maxArmor = this.getMaxArmor();
    this.state.maxGrenades = this.getMaxGrenades();
    this.state.difficulty = this.difficultyMode ?? 'normal';
    this.state.bgm = this.bgmEnabled ?? true;
    this.callback?.({ ...this.state, owned: [...this.state.owned] });
  }
  message(text: string, seconds = 2.5) {
    this.state.message = text;
    this.messageTime = seconds;
  }
  lock() {
    this.initAudio();
    const state = this.state;
    const request = ++this.pointerLockRequest;
    state.pointerLockError = '';
    const failed = (error: unknown) => {
      if (
        this.disposed ||
        this.state !== state ||
        request !== this.pointerLockRequest ||
        (state.mode !== 'playing' && state.mode !== 'paused')
      )
        return;
      state.pointerLockError =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.pause();
      this.emit();
    };
    try {
      const p = this.renderer.domElement.requestPointerLock();
      p?.catch(failed);
    } catch (error) {
      failed(error);
    }
  }
  initAudio() {
    if (!this.audio) {
      if (typeof AudioContext === 'undefined') return;
      this.audio = new AudioContext();
      this.master = this.audio.createGain();
      this.master.gain.value = this.muted ? 0 : 0.27;

      // Master bus compressor / peak limiter:
      // Prevents digital clipping from overlapping shots or explosions,
      // tightens the dynamic range, and adds punch and cohesion.
      this.compressor = this.audio.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-10, this.audio.currentTime);
      this.compressor.knee.setValueAtTime(8, this.audio.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.audio.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audio.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.audio.currentTime);

      this.master.connect(this.compressor);
      this.compressor.connect(this.audio.destination);

      this.initNoiseBuffer();
    }
    if (
      !this.bgmAudio &&
      this.audio &&
      this.master &&
      typeof Audio !== 'undefined' &&
      typeof this.audio.createMediaElementSource === 'function'
    ) {
      let audioEl: HTMLAudioElement | null = null;
      let source: MediaElementAudioSourceNode | null = null;
      let gain: GainNode | null = null;
      try {
        audioEl = new Audio('/audio/zombgm.ogg');
        audioEl.loop = true;
        source = this.audio.createMediaElementSource(audioEl);
        gain = this.audio.createGain();
        gain.gain.value = 0.5;
        source.connect(gain);
        gain.connect(this.master);
        this.bgmAudio = audioEl;
        this.bgmSource = source;
        this.bgmGain = gain;
      } catch {
        // Roll back completely if creation or connection fails to prevent unrouted playback
        if (source) {
          try {
            source.disconnect();
          } catch {
            // Safe swallow
          }
        }
        if (gain) {
          try {
            gain.disconnect();
          } catch {
            // Safe swallow
          }
        }
        this.bgmAudio = null;
        this.bgmSource = null;
        this.bgmGain = null;
      }
    }
    void this.audio?.resume();
  }
  initNoiseBuffer() {
    if (!this.audio) return;
    const sr = this.audio.sampleRate;
    const len = Math.ceil(sr * 2.5);
    const buf = this.audio.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Paul Kellet's filtered pink noise (-3dB/octave slope):
    // Warm and balanced across human hearing range, eliminating harsh white noise treble.
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.14;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buf;
  }
  mute(value: boolean) {
    this.muted = value;
    if (this.master) this.master.gain.value = value ? 0 : 0.27;
  }
  playBgm() {
    if (
      !this.bgmAudio ||
      !this.bgmEnabled ||
      !this.bgmStarted ||
      this.state.mode === 'menu' ||
      this.disposed
    ) {
      return;
    }
    if (this.audio && this.audio.state === 'suspended') {
      void this.audio.resume();
    }
    const audioEl = this.bgmAudio;
    const p = audioEl.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (
          !this.bgmAudio ||
          !this.bgmEnabled ||
          !this.bgmStarted ||
          this.state.mode === 'menu' ||
          this.disposed
        ) {
          try {
            audioEl.pause();
            if (this.state.mode === 'menu' || this.disposed || !this.bgmStarted) {
              audioEl.currentTime = 0;
            }
          } catch {
            // Safe swallow
          }
        }
      }).catch(() => {
        // Autoplay policy or pause interruption; safely ignore
      });
    }
  }
  pauseBgm() {
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
      } catch {
        // Safe swallow
      }
    }
  }
  setBgm(enabled: boolean) {
    this.bgmEnabled = enabled;
    this.state.bgm = enabled;
    if (this.bgmStarted && this.state.mode !== 'menu') {
      if (enabled) {
        this.initAudio();
        this.playBgm();
      } else {
        this.pauseBgm();
      }
    }
    this.emit();
  }
  playNoise(
    duration: number,
    volume: number,
    filterConfig?: {
      type?: BiquadFilterType;
      freqStart: number;
      freqEnd?: number;
      q?: number;
    },
    startTime?: number,
  ) {
    if (!this.audio || !this.master) return;
    const a = this.audio;
    const now = startTime ?? a.currentTime;
    const dur = Math.max(0.008, duration);

    let src: AudioBufferSourceNode;
    if (this.noiseBuffer && this.noiseBuffer.duration > dur + 0.1) {
      src = a.createBufferSource();
      src.buffer = this.noiseBuffer;
      const maxOffset = Math.max(0, this.noiseBuffer.duration - dur - 0.05);
      const offset = Math.random() * maxOffset;
      src.start(now, offset, dur);
    } else {
      const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
      const data = b.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.15;
        b2 = 0.85 * b2 + white * 0.3;
        data[i] = (b0 + b1 + b2 + white * 0.3) * 0.22;
      }
      src = a.createBufferSource();
      src.buffer = b;
      src.start(now, 0, dur);
    }

    const g = a.createGain();
    const safeVol = Math.max(0.0001, volume);
    const attack = Math.min(0.0015, dur * 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(safeVol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    let filter: BiquadFilterNode | null = null;
    if (filterConfig) {
      filter = a.createBiquadFilter();
      filter.type = filterConfig.type ?? 'lowpass';
      filter.Q.setValueAtTime(filterConfig.q ?? 1.0, now);
      filter.frequency.setValueAtTime(Math.max(20, filterConfig.freqStart), now);
      if (
        filterConfig.freqEnd !== undefined &&
        filterConfig.freqEnd !== filterConfig.freqStart
      ) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(20, filterConfig.freqEnd),
          now + dur,
        );
      }
      src.connect(filter);
      filter.connect(g);
    } else {
      src.connect(g);
    }

    g.connect(this.master);

    src.onended = () => {
      try {
        src.disconnect();
        if (filter) filter.disconnect();
        g.disconnect();
      } catch {}
    };
  }
  playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    volume = 0.3,
    type: OscillatorType = 'sine',
    startTime?: number,
  ) {
    if (!this.audio || !this.master) return;
    const a = this.audio;
    const now = startTime ?? a.currentTime;
    const dur = Math.max(0.008, duration);
    const osc = a.createOscillator();
    const g = a.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        now + dur,
      );
    }

    const safeVol = Math.max(0.0001, volume);
    const attack = Math.min(0.0015, dur * 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(safeVol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    if (type === 'sawtooth' || type === 'square') {
      const filter = a.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + dur);
      osc.connect(filter);
      filter.connect(g);
      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          g.disconnect();
        } catch {}
      };
    } else {
      osc.connect(g);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch {}
      };
    }

    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur);
  }
  sound(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.3,
    end = 40,
  ) {
    this.playTone(freq, end, duration, volume, type);
  }
  /** A cancellable voice, routed through the normal mute and limiter bus. */
  sirenScreamSound(duration: number): (() => void) | undefined {
    if (!this.audio || !this.master || duration <= 0) return;
    const a = this.audio, now = a.currentTime;
    const envelope = a.createGain(), formant = a.createBiquadFilter();
    const voice = a.createOscillator(), overtone = a.createOscillator();
    const vibrato = a.createOscillator(), modulation = a.createGain();
    voice.type = 'sawtooth'; overtone.type = 'triangle';
    voice.frequency.setValueAtTime(560, now);
    voice.frequency.exponentialRampToValueAtTime(410, now + duration);
    overtone.frequency.setValueAtTime(843, now);
    overtone.frequency.exponentialRampToValueAtTime(618, now + duration);
    vibrato.frequency.setValueAtTime(19, now); modulation.gain.setValueAtTime(32, now);
    vibrato.connect(modulation); modulation.connect(voice.frequency);
    formant.type = 'bandpass'; formant.Q.setValueAtTime(0.75, now);
    formant.frequency.setValueAtTime(1300, now);
    formant.frequency.exponentialRampToValueAtTime(850, now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16, now + Math.min(0.06, duration * 0.15));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    voice.connect(formant); overtone.connect(formant);
    formant.connect(envelope); envelope.connect(this.master);
    const sources: Array<OscillatorNode | AudioBufferSourceNode> = [voice, overtone, vibrato];
    if (this.noiseBuffer) {
      const noise = a.createBufferSource(); noise.buffer = this.noiseBuffer; noise.loop = true;
      noise.connect(formant); sources.push(noise);
    }
    const nodes: AudioNode[] = [...sources, envelope, formant, modulation];
    let ended = 0, disconnected = false;
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      for (const node of nodes) node.disconnect();
    };
    for (const source of sources) {
      source.onended = () => { if (++ended === sources.length) disconnect(); };
      source.start(now); source.stop(now + duration);
    }
    return () => {
      if (disconnected) return;
      for (const source of sources) source.stop(a.currentTime);
      disconnect();
    };
  }
  noise(duration = 0.16, volume = 0.8, filterFreq = 2200) {
    this.playNoise(duration, volume * 0.55, {
      type: 'lowpass',
      freqStart: filterFreq,
      freqEnd: Math.max(80, filterFreq * 0.25),
      q: 1.0,
    });
  }
  gunshot(weaponIndex: number) {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;

    switch (weaponIndex) {
      case 0: {
        if (this.state.g18c) {
          // G18C MACHINE PISTOL:
          // High-rate 9mm full-auto fire (0.068s cooldown).
          // Compact envelopes (<=0.05s) keep acoustic space clean during 900 RPM bursts.
          const jitter = 0.96 + Math.random() * 0.08;

          // 1. Sharp high-velocity transient crack
          this.playNoise(
            0.015,
            0.28,
            {
              type: 'bandpass',
              freqStart: 2800 * jitter,
              freqEnd: 1200,
              q: 1.2,
            },
            now,
          );
          this.playTone(260 * jitter, 65, 0.01, 0.22, 'sine', now);

          // 2. Visceral low-mid punch (rapid 9mm chamber pop)
          this.playTone(165 * jitter, 45, 0.045, 0.44, 'sine', now);

          // 3. Compact muzzle gas blast (rapid sweep avoids acoustic mud)
          this.playNoise(
            0.048,
            0.3,
            {
              type: 'lowpass',
              freqStart: 2400 * jitter,
              freqEnd: 340,
              q: 1.1,
            },
            now,
          );

          // 4. Slide cycle mechanical feedback
          this.playNoise(
            0.012,
            0.1,
            {
              type: 'bandpass',
              freqStart: 2600,
              freqEnd: 1700,
              q: 1.5,
            },
            now + 0.014,
          );
          break;
        }

        // H1 SERVICE PISTOL:
        // Snappy, punchy mechanical pop with sharp supersonic crack and authoritative low-mid thump.
        // 1. Transient crack (bandpass noise sweep + fast percussive punch)
        this.playNoise(
          0.022,
          0.3,
          {
            type: 'bandpass',
            freqStart: 2600,
            freqEnd: 1100,
            q: 1.0,
          },
          now,
        );
        this.playTone(280, 75, 0.009, 0.24, 'sine', now);

        // 2. Visceral low-mid body thump (focused 9mm air displacement)
        this.playTone(155, 42, 0.075, 0.5, 'sine', now);

        // 3. Muzzle gas expansion (warm dynamic lowpass sweep, eliminating ear-piercing sizzle)
        this.playNoise(
          0.09,
          0.36,
          {
            type: 'lowpass',
            freqStart: 2000,
            freqEnd: 260,
            q: 1.1,
          },
          now,
        );

        // 4. Subtle slide cycling click (tactile mechanical feedback)
        this.playNoise(
          0.016,
          0.12,
          {
            type: 'bandpass',
            freqStart: 2400,
            freqEnd: 1600,
            q: 1.4,
          },
          now + 0.028,
        );
        break;
      }

      case 1: {
        // AR-2 ASSAULT RIFLE:
        // Rapid-fire 5.56mm carbine (0.095s cooldown). Compact envelope (<0.07s) leaves acoustic room.
        // Steep lowpass sweeps eliminate harsh frequency accumulation in sustained bursts.
        // Subtle micro-jitter prevents phase comb filtering and robotic drone.
        const pitchJitter = 0.97 + Math.random() * 0.06;
        const filterJitter = 0.95 + Math.random() * 0.1;

        // 1. Snappy transient crack (clean percussive bite, no laser blips)
        this.playNoise(
          0.018,
          0.26,
          {
            type: 'bandpass',
            freqStart: 2200 * filterJitter,
            freqEnd: 950,
            q: 1.0,
          },
          now,
        );
        this.playTone(240 * pitchJitter, 72, 0.012, 0.22, 'sine', now);

        // 2. Low-mid rhythmic punch (tight low-end drive)
        this.playTone(175 * pitchJitter, 48, 0.052, 0.46, 'sine', now);

        // 3. Muzzle blast sweep (rapid lowpass sweep keeps acoustic space clear)
        this.playNoise(
          0.065,
          0.3,
          {
            type: 'lowpass',
            freqStart: 2100 * filterJitter,
            freqEnd: 380,
            q: 1.1,
          },
          now,
        );

        // 4. Bolt reciprocation click
        this.playNoise(
          0.014,
          0.1,
          {
            type: 'bandpass',
            freqStart: 2200,
            freqEnd: 1500,
            q: 1.5,
          },
          now + 0.018,
        );
        break;
      }

      case 2: {
        // SR-3: sharp rifle crack and low report. Bolt sounds follow its animation.
        this.playNoise(
          0.025,
          0.45,
          {
            type: 'bandpass',
            freqStart: 3400,
            freqEnd: 1200,
            q: 1.0,
          },
          now,
        );
        this.playTone(270, 65, 0.016, 0.3, 'sine', now);

        this.playTone(160, 45, 0.12, 0.48, 'sine', now);
        this.playTone(90, 30, 0.18, 0.32, 'sine', now);

        // Diffuse muzzle report decays behind the short crack.
        this.playNoise(
          0.3,
          0.42,
          {
            type: 'lowpass',
            freqStart: 2400,
            freqEnd: 160,
            q: 2.3,
          },
          now,
        );

        break;
      }
      case 3: {
        this.playTone(95, 30, 0.25, 0.6, 'sine', now);
        this.playTone(65, 20, 0.35, 0.5, 'triangle', now);
        this.playNoise(
          0.45,
          0.38,
          {
            type: 'lowpass',
            freqStart: 900,
            freqEnd: 120,
            q: 1.5,
          },
          now,
        );
        break;
      }
    }
  }
  boltSound(closing: boolean) {
    if (!this.audio || !this.master) return;
    this.playNoise(
      closing ? 0.018 : 0.024,
      closing ? 0.1 : 0.14,
      {
        type: 'bandpass',
        freqStart: closing ? 2400 : 1800,
        freqEnd: closing ? 1600 : 1100,
        q: closing ? 1.6 : 1.4,
      },
      this.audio.currentTime,
    );
  }
  dryFire() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Crisp hammer strike on empty chamber: mechanical snap + chamber resonance ping
    this.playNoise(
      0.02,
      0.18,
      {
        type: 'highpass',
        freqStart: 2800,
        q: 1.2,
      },
      now,
    );
    this.playTone(380, 140, 0.015, 0.16, 'sine', now);
    this.playTone(1800, 1600, 0.025, 0.06, 'sine', now);
  }
  reloadStart() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Mag eject / breach release
    this.playNoise(
      0.028,
      0.15,
      {
        type: 'bandpass',
        freqStart: 1800,
        freqEnd: 900,
        q: 1.4,
      },
      now,
    );
    this.playTone(320, 140, 0.035, 0.16, 'triangle', now);
  }
  reloadComplete() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Dual tactile click: mag seating lock (t=0) and bolt release snap (t=0.04)
    this.playNoise(
      0.022,
      0.2,
      {
        type: 'bandpass',
        freqStart: 2000,
        freqEnd: 1100,
        q: 1.4,
      },
      now,
    );
    this.playTone(360, 160, 0.025, 0.18, 'sine', now);

    this.playNoise(
      0.025,
      0.24,
      {
        type: 'bandpass',
        freqStart: 2400,
        freqEnd: 1400,
        q: 1.5,
      },
      now + 0.04,
    );
    this.playTone(480, 220, 0.028, 0.2, 'sine', now + 0.04);
  }
  explosionSound() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // 1. Initial shockwave crack
    this.playNoise(
      0.035,
      0.4,
      {
        type: 'bandpass',
        freqStart: 1400,
        freqEnd: 600,
        q: 1.1,
      },
      now,
    );
    // 2. Heavy low-end sub boom
    this.playTone(85, 20, 0.85, 0.65, 'sine', now);
    // 3. Resonant explosive blast roar
    this.playNoise(
      0.65,
      0.62,
      {
        type: 'lowpass',
        freqStart: 1600,
        freqEnd: 60,
        q: 2.0,
      },
      now,
    );
    // 4. Low diffuse rumble
    this.playNoise(
      0.85,
      0.32,
      {
        type: 'lowpass',
        freqStart: 260,
        freqEnd: 35,
        q: 1.0,
      },
      now,
    );
  }
  meleeSound() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Aerodynamic weapon swing whoosh
    this.playNoise(
      0.13,
      0.26,
      {
        type: 'bandpass',
        freqStart: 500,
        freqEnd: 850,
        q: 1.5,
      },
      now,
    );
    this.playTone(180, 80, 0.12, 0.15, 'sine', now);
  }
  hurtSound() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Heavy blunt body impact thud
    this.playTone(95, 28, 0.22, 0.42, 'triangle', now);
    this.playNoise(
      0.09,
      0.24,
      {
        type: 'lowpass',
        freqStart: 600,
        freqEnd: 120,
        q: 1.2,
      },
      now,
    );
  }
  waveAlertSound() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Filtered dramatic synth horn rather than harsh raw sawtooth
    this.playTone(190, 85, 0.75, 0.22, 'sawtooth', now);
    this.playTone(95, 42, 0.75, 0.28, 'sine', now);
  }
  headshotSound() {
    if (!this.audio || !this.master) return;
    const now = this.audio.currentTime;
    // Crisp satisfying metallic headshot ping
    this.playTone(1760, 2200, 0.09, 0.32, 'sine', now);
    this.playTone(2640, 2640, 0.06, 0.18, 'triangle', now);
  }
  toMenu() {
    this.bgmStarted = false;
    this.pauseBgm();
    if (this.bgmAudio) {
      try {
        this.bgmAudio.currentTime = 0;
      } catch {
        // Safe swallow
      }
    }
    this.viewRecoil.reset();
    this.recoil = 0;
    this.clearEnemyProjectiles();
    this.hans?.dispose();
    this.hans = undefined;
    this.clearGrenades();
    this.clearRockets();
    for (const e of this.enemies) this.scene.remove(e.root, e.shadow);
    for (const { enemy } of this.corpses)
      this.scene.remove(enemy.root, enemy.shadow);
    this.corpses = [];
    this.enemies = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    this.difficultyMode = 'normal';
    this.difficulty = 1;
    this.state = {
      bossDebug: false,
      debugTargetWave: undefined,
      debugMinHp: false,
      boss: null,
      mode: 'menu',
      wave: 0,
      health: 100,
      armor: 100,
      maxArmor: 100,
      stamina: 100,
      cash: 500,
      kills: 0,
      remaining: 0,
      ammo: 12,
      reserve: 48,
      ammoFull: true,
      weapon: WEAPONS[0].name,
      scoped: false,
      aiming: false,
      bolt: 0,
      reload: 0,
      message: '',
      pointerLockError: '',
      hit: 0,
      hurt: 0,
      grenades: 3,
      maxGrenades: 3,
      difficulty: 'normal',
      medicalKits: MEDICAL_KIT.max,
      healCooldown: 0,
      owned: [true, false, false, false],
      katana: false,
      g18c: false,
      pouch: false,
      level: 0,
      time: 0,
      fps: this.fps,
      bgm: this.bgmEnabled ?? true,
    };
    this.weaponIndex = 0;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reserve = WEAPONS.map((w) => w.reserve);
    this.buildGun();
    this.yaw = 0;
    this.pitch = 0;
    this.feet = 0;
    this.vertical = 0;
    this.camera.position.set(0, 1.7, 17);
    this.keys.clear();
    this.shooting = false;
    this.aiming = false;
    this.cooldown = 0;
    this.sniperBoltTime = 0;
    this.sniperReloadQueued = false;
    this.reloadTime = 0;
    this.meleeTime = 0;
    this.grenadeTime = 0;
    this.navTime = 0;
    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.renderer?.domElement
    )
      document.exitPointerLock();
    this.emit();
  }
  start(
    difficulty: 'normal' | 'hard' = 'normal',
    options?: {
      bossDebug?: boolean;
      debugWave?: number;
      debugCash?: number;
      debugMinHp?: boolean;
    },
  ) {
    this.viewRecoil.reset();
    this.recoil = 0;
    this.clearEnemyProjectiles();
    this.hans?.dispose();
    this.hans = undefined;
    this.clearGrenades();
    this.clearRockets();
    for (const e of this.enemies) this.scene.remove(e.root, e.shadow);
    for (const { enemy } of this.corpses)
      this.scene.remove(enemy.root, enemy.shadow);
    this.corpses = [];
    this.enemies = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    this.initAudio();
    this.bgmStarted = true;
    if (this.bgmAudio) {
      try {
        this.bgmAudio.currentTime = 0;
      } catch {
        // Safe swallow
      }
    }
    if (options?.bossDebug) {
      this.initAudio();
      const isCustom =
        options.debugWave !== undefined || options.debugCash !== undefined || options.debugMinHp !== undefined;
      const targetDifficulty = isCustom ? difficulty : 'hard';
      const maxAllowedWave = HANS.wave;
      const targetWave = Math.min(
        maxAllowedWave,
        Math.max(
          1,
          Math.round(options.debugWave ?? 7),
        ),
      );
      const targetCash = Math.min(
        999000,
        Math.max(
          0,
          Math.round(options.debugCash ?? 20000),
        ),
      );
      const debugMinHp = !!options.debugMinHp;
      this.difficultyMode = targetDifficulty;
      this.difficulty = targetDifficulty === 'hard' ? 1.35 : 1;
      this.weaponIndex = 0;
      const maxArmor = this.getMaxArmor();
      const maxGrenades = this.getMaxGrenades(false);
      this.ammo = WEAPONS.map((w) => w.mag);
      this.reserve = WEAPONS.map((w) => w.reserve);
      this.state = {
        bossDebug: true,
        debugTargetWave: targetWave,
        debugMinHp,
        boss: null,
        mode: 'shop',
        wave: targetWave - 1,
        health: 100,
        armor: maxArmor,
        maxArmor,
        stamina: 100,
        cash: targetCash,
        kills: 0,
        remaining: 0,
        ammo: this.ammo[this.weaponIndex],
        reserve: this.reserve[this.weaponIndex],
        ammoFull: true,
        weapon: WEAPONS[0].name,
        scoped: false,
        aiming: false,
        bolt: 0,
        reload: 0,
        message: `WAVE ${String(targetWave).padStart(2, '0')} PREPARATION — ₡${targetCash.toLocaleString()}${debugMinHp ? ' MIN HP 1' : ''}`,
        pointerLockError: '',
        hit: 0,
        hurt: 0,
        grenades: maxGrenades,
        maxGrenades,
        difficulty: targetDifficulty,
        medicalKits: MEDICAL_KIT.max,
        healCooldown: 0,
        owned: [true, false, false, false],
        katana: false,
        g18c: false,
        pouch: false,
        level: 0,
        time: 0,
        fps: this.fps,
        bgm: this.bgmEnabled ?? true,
      };
      if (this.bgmEnabled) {
        this.playBgm();
      }
      this.buildGun();
      if (
        typeof document !== 'undefined' &&
        document.pointerLockElement === this.renderer?.domElement
      )
        document.exitPointerLock();
      this.emit();
      return;
    }
    this.difficultyMode = difficulty;
    this.difficulty = difficulty === 'hard' ? 1.35 : 1;
    this.weaponIndex = 0;
    const maxArmor = this.getMaxArmor();
    const maxGrenades = this.getMaxGrenades(false);
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reserve = WEAPONS.map((w) => w.reserve);
    this.state = {
      bossDebug: false,
      debugTargetWave: undefined,
      debugMinHp: false,
      boss: null,
      mode: 'playing',
      wave: 0,
      health: 100,
      armor: maxArmor,
      maxArmor,
      stamina: 100,
      cash: 500,
      kills: 0,
      remaining: 0,
      ammo: this.ammo[this.weaponIndex],
      reserve: this.reserve[this.weaponIndex],
      ammoFull: true,
      weapon: WEAPONS[0].name,
      scoped: false,
      aiming: false,
      bolt: 0,
      reload: 0,
      message: '',
      pointerLockError: '',
      hit: 0,
      hurt: 0,
      grenades: maxGrenades,
      maxGrenades,
      difficulty,
      medicalKits: MEDICAL_KIT.max,
      healCooldown: 0,
      owned: [true, false, false, false],
      katana: false,
      g18c: false,
      pouch: false,
      level: 0,
      time: 0,
      fps: this.fps,
      bgm: this.bgmEnabled ?? true,
    };
    if (this.bgmEnabled) {
      this.playBgm();
    }
    this.buildGun();
    this.yaw = 0;
    this.pitch = 0;
    this.feet = 0;
    this.vertical = 0;
    this.camera.position.set(0, 1.7, 17);
    this.keys.clear();
    this.shooting = false;
    this.aiming = false;
    this.cooldown = 0;
    this.sniperBoltTime = 0;
    this.sniperReloadQueued = false;
    this.reloadTime = 0;
    this.meleeTime = 0;
    this.grenadeTime = 0;
    this.navTime = 0;
    this.initAudio();
    if (difficulty === 'hard') {
      this.state.mode = 'shop';
      this.state.wave = 1;
      this.state.cash = 2000;
      if (
        typeof document !== 'undefined' &&
        document.pointerLockElement === this.renderer?.domElement
      )
        document.exitPointerLock();
      this.emit();
    } else {
      this.nextWave();
    }
  }
  nextWave() {
    if (
      this.state.mode !== 'shop' &&
      !(this.state.mode === 'playing' && this.state.wave === 0)
    )
      return;
    if (this.state.wave >= HANS.wave) return;
    this.initAudio();
    this.state.mode = 'playing';
    this.state.debugTargetWave = undefined;
    this.state.wave++;
    const basePending = 6 + this.state.wave * 3;
    this.pending =
      this.isHansWave() ? 1 : this.difficultyMode === 'hard' ? basePending * 2 : basePending;
    this.state.remaining = this.pending;
    this.spawnTime = 1;
    this.waveTime = 0;
    this.shooting = false;
    this.aiming = false;
    this.keys.clear();
    this.message(
      this.isHansWave()
        ? 'FINAL BOSS — HANS VOLTER'
        : `WAVE ${String(this.state.wave).padStart(2, '0')} — ASSAULT INCOMING`,
      3.5,
    );
    this.waveAlertSound();
    this.lock();
    this.emit();
  }
  pause() {
    if (this.state.mode !== 'playing') return;
    this.state.mode = 'paused';
    for (const e of this.enemies) e.siren?.silence();
    this.shooting = false;
    this.aiming = false;
    this.keys.clear();
    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.renderer?.domElement
    )
      document.exitPointerLock();
    this.emit();
  }
  resume() {
    if (this.state.mode !== 'paused') return;
    this.state.mode = 'playing';
    this.initAudio();
    this.lock();
    this.emit();
  }
  buy(id: string) {
    if (this.state.mode !== 'shop') return;
    const price: Record<string, number> = {
      ammo: 100,
      health: 50,
      armor: 150,
      rpg: 4000,
      rifle: 800,
      sniper: 1100,
      katana: 1000,
      g18c: 750,
      pouch: 1000,
      upgrade: 1000 + this.state.level * 1000,
      grenade: 50,
    };
    if (!(id in price) || this.state.cash < price[id]) return;
    const maxArmor = this.getMaxArmor();
    const maxGrenades = this.getMaxGrenades();
    if (
      (id === 'rifle' && this.state.owned[1]) ||
      (id === 'sniper' && this.state.owned[2]) ||
      (id === 'rpg' && this.state.owned[3]) ||
      (id === 'katana' && this.state.katana) ||
      (id === 'g18c' && this.state.g18c) ||
      (id === 'pouch' && this.state.pouch) ||
      (id === 'upgrade' && this.state.level >= 2) ||
      (id === 'health' && this.state.medicalKits >= MEDICAL_KIT.max) ||
      (id === 'armor' && this.state.armor >= maxArmor) ||
      (id === 'ammo' && this.isAmmoFull()) ||
      (id === 'grenade' && this.state.grenades >= maxGrenades)
    )
      return;
    this.state.cash -= price[id];
    if (id === 'ammo') {
      WEAPONS.forEach((_, i) => {
        const w = this.getWeapon(i);
        this.ammo[i] = w.mag;
        this.reserve[i] = Math.round(w.reserve * (this.state.pouch ? 1.5 : 1));
      });
    }
    if (id === 'pouch') {
      this.state.pouch = true;
      this.state.maxGrenades = this.getMaxGrenades();
      this.state.grenades = this.state.maxGrenades;
      WEAPONS.forEach((_, i) => {
        const w = this.getWeapon(i);
        this.ammo[i] = w.mag;
        this.reserve[i] = Math.round(w.reserve * (this.state.pouch ? 1.5 : 1));
      });
    }
    if (id === 'rpg') {
      this.state.owned[3] = true;
      this.weaponIndex = 3;
      if (this.state.pouch) this.reserve[3] = Math.round(WEAPONS[3].reserve * 1.5);
      this.buildGun();
    }
    if (id === 'health')
      this.state.medicalKits = Math.min(MEDICAL_KIT.max, this.state.medicalKits + 1);
    if (id === 'armor') this.state.armor = maxArmor;
    if (id === 'rifle' || id === 'sniper') {
      const index = id === 'rifle' ? 1 : 2;
      this.state.owned[index] = true;
      this.weaponIndex = index;
      this.buildGun();
    }
    if (id === 'katana') {
      this.state.katana = true;
      this.buildKatana();
    }
    if (id === 'g18c') {
      this.state.g18c = true;
      this.ammo[0] = G18C_WEAPON.mag;
      this.reserve[0] = Math.max(this.reserve[0], this.getMaxReserve(0));
      if (this.weaponIndex === 0) this.buildGun();
    }
    if (id === 'upgrade') this.state.level++;
    if (id === 'grenade')
      this.state.grenades = Math.min(maxGrenades, this.state.grenades + 1);
    this.sound(600, 0.12, 'sine', 0.3, 900);
    this.message('SUPPLIES RECEIVED');
    this.emit();
  }
  openShop() {
    if (this.state.mode !== 'cleared') return;
    this.state.mode = 'shop';
    this.emit();
  }
  toggleBossDebug(): boolean {
    if (this.state.mode === 'menu') {
      this.state.bossDebug = !this.state.bossDebug;
      this.emit();
      return this.state.bossDebug;
    }
    return false;
  }
  handleKeyDown(e: {
    code: string;
    repeat?: boolean;
    preventDefault?: () => void;
  }) {
    if (this.state.mode === 'menu') {
      const ke = e as KeyboardEvent;
      if (e.code === 'F8' && !e.repeat && !ke.ctrlKey && !ke.altKey && !ke.metaKey && !ke.shiftKey) {
        e.preventDefault?.();
        this.toggleBossDebug();
        return;
      }
      if (e.code === 'Escape' && this.state.bossDebug && !e.repeat) {
        e.preventDefault?.();
        this.toggleBossDebug();
        return;
      }
      return;
    }
    if (this.state.mode === 'cleared') {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault?.();
        this.openShop();
      }
      return;
    }
    if (this.state.mode !== 'playing') return;
    if (['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code))
      e.preventDefault?.();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyR') this.reload();
    if (e.code === 'KeyQ') this.heal();
    if (e.code === 'KeyG') this.grenade();
    if (e.code === 'KeyV') this.melee();
    if (e.code === 'Space' && this.feet <= 0.01) this.vertical = 5.3;
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    this.equipWeapon(i);
  }
  keydown = (e: KeyboardEvent) => {
    this.handleKeyDown(e);
  };
  equipWeapon(index: number) {
    if (index === 3 && !this.state.owned[3]) return;
    if (index < 0 || !this.state.owned[index] || index === this.weaponIndex || this.isThrowingGrenade())
      return;
    this.weaponIndex = index;
    this.reloadTime = 0;
    this.state.reload = 0;
    this.sniperReloadQueued = false;
    this.shooting = false;
    this.cooldown = 0.2;
    // A holstered sniper retains its unfinished bolt cycle.
    this.buildGun();
    if (this.weaponIndex === 3 && this.ammo[3] <= 0 && this.reserve[3] > 0) {
      this.reload();
    }
    this.emit();
  }
  mousemove = (e: MouseEvent) => {
    if (
      this.state.mode !== 'playing' ||
      document.pointerLockElement !== this.renderer.domElement
    )
      return;
    const sens = this.isScoped() ? 0.0004 : this.aiming ? 0.00125 : 0.002;
    this.applyAimDelta(-e.movementY * sens, -e.movementX * sens);
  };
  applyAimDelta(pitch: number, yaw: number) {
    this.yaw += yaw;
    this.pitch = T.MathUtils.clamp(
      this.pitch + pitch,
      -LOOK_PITCH_LIMIT,
      LOOK_PITCH_LIMIT,
    );
  }
  updateCameraAim() {
    this.camera.rotation.set(
      this.pitch,
      this.yaw,
      0,
      'YXZ',
    );
  }
  mousedown = (e: MouseEvent) => {
    this.initAudio();
    if (
      this.state.mode !== 'playing' ||
      document.pointerLockElement !== this.renderer.domElement
    )
      return;
    if (e.button === 0) {
      this.shooting = true;
      this.shoot();
    }
    if (e.button === 2) {
      e.preventDefault();
      this.aiming = true;
      this.emit();
    }
  };
  blocked(x: number, z: number, r = 0.35) {
    if (Math.abs(x) > 30.2 || Math.abs(z) > 30.2) return true;
    return this.obstacles.some(
      (b) =>
        x > b.min.x - r &&
        x < b.max.x + r &&
        z > b.min.z - r &&
        z < b.max.z + r,
    );
  }
  move(pos: T.Vector3, dx: number, dz: number, r = 0.35) {
    if (!this.blocked(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!this.blocked(pos.x, pos.z + dz, r)) pos.z += dz;
  }
  isScoped() {
    return (
      this.state.mode === 'playing' &&
      this.weaponIndex === 2 &&
      this.aiming &&
      this.reloadTime <= 0 &&
      !this.isThrowingGrenade() &&
      !(this.state.katana && this.meleeTime > 0) &&
      !this.isCyclingBolt()
    );
  }
  isCyclingBolt() {
    return this.weaponIndex === 2 && this.sniperBoltTime > 0;
  }
  updateReload(dt: number) {
    if (this.reloadTime <= 0 || this.state.mode !== 'playing') return;
    this.reloadTime -= dt;
    const curW = this.getWeapon();
    this.state.reload = Math.max(0, this.reloadTime / curW.reload);
    if (this.reloadTime <= 0) {
      const transfer = Math.min(
        curW.mag - this.ammo[this.weaponIndex],
        this.reserve[this.weaponIndex],
      );
      this.ammo[this.weaponIndex] += transfer;
      this.reserve[this.weaponIndex] -= transfer;
      this.reloadComplete();
      if (this.weaponIndex === 3) {
        const loaded = this.gun.getObjectByName('loaded-rocket');
        if (loaded) loaded.visible = true;
      }
    }
  }
  updateBolt(dt: number) {
    if (this.state.mode !== 'playing' || !this.isCyclingBolt()) return;
    const before = SNIPER_BOLT_DURATION - this.sniperBoltTime;
    this.sniperBoltTime = Math.max(0, this.sniperBoltTime - dt);
    const after = SNIPER_BOLT_DURATION - this.sniperBoltTime;
    if (before < 0.3 && after >= 0.3) this.boltSound(false);
    if (before < 0.85 && after >= 0.85) this.boltSound(true);
    if (this.sniperBoltTime === 0 && this.sniperReloadQueued) {
      this.sniperReloadQueued = false;
      this.reload();
    }
  }
  animateBolt() {
    if (!this.gunAction) return;
    const t = this.isCyclingBolt()
      ? SNIPER_BOLT_DURATION - this.sniperBoltTime
      : 0;
    const lift =
      T.MathUtils.smoothstep(t, 0.12, 0.3) *
      (1 - T.MathUtils.smoothstep(t, 0.85, 1.05));
    const pull =
      T.MathUtils.smoothstep(t, 0.3, 0.5) *
      (1 - T.MathUtils.smoothstep(t, 0.62, 0.85));
    // Unlock, draw back, feed forward, then lock the handle down.
    this.gunAction.position.z =
      this.weaponIndex === 2 ? pull * 0.14 : this.recoil * 0.65;
    this.gunAction.rotation.z = lift * 0.95;
    if (this.gunBoltHand) {
      this.gunBoltHand.position.set(
        lift * 0.09, lift * 0.25, -lift * 0.14 + pull * 0.14,
      );
      this.gunBoltHand.rotation.x = -lift * 0.2;
    }
  }
  reload() {
    if (this.isThrowingGrenade()) return;
    const w = this.getWeapon();
    if (
      this.reloadTime > 0 ||
      this.ammo[this.weaponIndex] >= w.mag ||
      this.reserve[this.weaponIndex] === 0
    )
      return;
    if (this.isCyclingBolt()) {
      this.sniperReloadQueued = true;
      return;
    }
    this.reloadTime = w.reload;
    this.reloadStart();
    this.emit();
  }
  updateHealCooldown(dt: number) {
    if (this.state.mode !== 'playing') return;
    this.state.healCooldown = Math.max(0, this.state.healCooldown - dt);
  }
  heal() {
    if (
      this.state.mode !== 'playing' ||
      this.state.healCooldown > 0 ||
      this.state.medicalKits <= 0 ||
      this.state.health >= 100
    )
      return;
    const restored = Math.min(MEDICAL_KIT.heal, 100 - this.state.health);
    this.state.health += restored;
    this.state.medicalKits--;
    this.state.healCooldown = MEDICAL_KIT.cooldown;
    this.message(`+${Math.round(restored)} HP — MEDICAL KIT`, 1.5);
    this.sound(450, 0.4, 'sine', 0.3, 900);
    this.emit();
  }
  shoot(allowEmptyReload = true) {
    if (
      this.cooldown > 0 ||
      this.isThrowingGrenade() ||
      (this.state.katana && this.meleeTime > 0) ||
      this.isCyclingBolt() ||
      this.reloadTime > 0 ||
      this.state.mode !== 'playing'
    )
      return;
    const w = this.getWeapon();
    if (this.ammo[this.weaponIndex] <= 0) {
      if (allowEmptyReload) this.reload();
      if (this.reserve[this.weaponIndex] <= 0) {
        this.cooldown = 0.4;
        this.message('OUT OF AMMO — V: MELEE / G: GRENADE', 1);
        this.dryFire();
      }
      return;
    }
    // Capture aim before cycling the bolt lowers the scope.
    const spread = this.isScoped()
      ? 0
      : this.aiming
        ? (w as { adsSpread?: number }).adsSpread ?? w.spread * 0.42
        : w.spread;
    this.ammo[this.weaponIndex]--;
    this.cooldown =
      this.weaponIndex === 2 && this.ammo[2] <= 0 ? 0 : w.rate;
    if (this.weaponIndex === 2 && this.ammo[2] > 0) this.sniperBoltTime = SNIPER_BOLT_DURATION;
    if (this.weaponIndex === 3) {
      this.launchRocket();
      if (this.reserve[3] > 0) {
        this.reload();
      }
    }
    const kick =
      this.weaponIndex === 0 && this.state.g18c
        ? G18C_RECOIL
        : RECOIL_PROFILES[this.weaponIndex];
    const kickAmount = kick.kickback * (this.aiming ? 0.45 : 1);
    this.recoil = Math.min(kick.kickback * (this.aiming ? 0.75 : 1.6), this.recoil + kickAmount);
    this.gunshot(this.weaponIndex);
    if (this.weaponIndex === 3) {
      const aimKick = this.viewRecoil.fire(kick, this.aiming);
      this.applyAimDelta(aimKick.pitch, aimKick.yaw);
      this.emit();
      return;
    }
    this.camera.updateMatrixWorld();
    const targets = [
      ...this.walls,
      ...this.enemies.filter((e) => !e.dead).flatMap((e) => e.parts),
    ];
    this.scene.updateMatrixWorld(true);
    for (let n = 0; n < w.pellets; n++) {
      this.ray.setFromCamera(
        new T.Vector2(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
        ),
        this.camera,
      );
      const hits = this.ray.intersectObjects(targets, false);
      const firstWall = hits.find((h) => !h.object.userData.enemy);
      const maxDistance = firstWall ? firstWall.distance : Infinity;
      const maxPierce = (w as { pierce?: number }).pierce ?? 1;
      const hitEnemies = new Set<Enemy>();
      let headshotGiven = false;

      for (const hit of hits) {
        if (hit === firstWall) {
          // Stop penetration when colliding with walls or cover
          this.burst(hit.point, 0xd9b98e, 3, 0.8);
          break;
        }
        if (hit.distance > maxDistance) break;

        const e = hit.object.userData.enemy as Enemy | undefined;
        if (!e) continue;
        if (hitEnemies.has(e)) continue;

        // If multiple body parts of the same enemy are hit along this ray before the wall,
        // prioritize a headshot hit over protruding arms/body.
        const headHit = hits.find(
          (h) =>
            h.object.userData.enemy === e &&
            h.object.userData.hitZone === 'head' &&
            h.distance <= maxDistance,
        );
        const chosenHit = headHit ?? hit;
        hitEnemies.add(e);

        const head = chosenHit.object.userData.hitZone === 'head';
        this.damageEnemy(
          e,
          w.damage * (1 + this.state.level * 0.35) * (head ? 3.0 : 1),
          chosenHit.point,
        );
        if (head) headshotGiven = true;
        if (hitEnemies.size >= maxPierce) break;
      }

      if (headshotGiven) {
        this.headshotSound();
        this.message(
          hitEnemies.size > 1 ? `HEADSHOT + PIERCE (${hitEnemies.size} KILLS)` : 'HEADSHOT',
          0.7,
        );
      } else if (hitEnemies.size > 1) {
        this.message(`PIERCING HIT — ${hitEnemies.size} TARGETS`, 0.7);
      }
    }
    // This shot uses the current sight picture; recoil affects the following shots.
    const aimKick = this.viewRecoil.fire(kick, this.aiming);
    this.applyAimDelta(aimKick.pitch, aimKick.yaw);
    this.emit();
  }
  burst(position: T.Vector3, color: number, count = 8, force = 2) {
    const mat = this.mat(color, 0.15, 0.75);
    count = Math.min(count, 40, Math.max(0, 140 - this.particles.length));
    for (let n = 0; n < count; n++) {
      const mesh = new T.Mesh(BOX, mat);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.035 + Math.random() * 0.06);
      this.scene.add(mesh);
      const life = 0.2 + Math.random() * 0.4;
      this.particles.push({
        mesh,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * force,
          Math.random() * force,
          (Math.random() - 0.5) * force,
        ),
        life,
        max: life,
      });
    }
  }
  damageEnemy(e: Enemy, amount: number, point: T.Vector3) {
    if (e.dead) return;
    if (e.kind === HANS.kind && this.hans) amount *= this.hans.damageMultiplier();
    e.hp -= amount;
    this.state.hit = 0.16;
    this.burst(point, 0x8b2520, 6, 2);
    if (e.hp <= 0) {
      e.dead = true;
      e.siren?.cancel();
      if (e.kind === HANS.kind) this.clearEnemyProjectiles();
      if (e.cannonCharge) e.cannonCharge.visible = false;
      if (e.rageIndicator) e.rageIndicator.visible = false;
      this.state.kills++;
      this.state.remaining--;
      this.state.cash += ENEMIES[e.kind].reward;
      this.corpses.push({ enemy: e, age: 0 });
      if (this.corpses.length > 6) {
        const old = this.corpses.shift()!;
        this.scene.remove(old.enemy.root, old.enemy.shadow);
      }
      this.sound(80, 0.13, 'triangle', 0.16, 35);
    } else if (e.kind === 2 && !e.scrakeEnraged && e.hp <= e.maxHp * SCRAKE_RAGE.hpRatio) {
      e.scrakeEnraged = true;
      // Keep the spawn's wave/difficulty speed scaling; transition only once.
      e.speed *= SCRAKE_RAGE.speedMultiplier;
    }
  }
  melee() {
    if (this.state.mode !== 'playing' || this.meleeTime > 0 || this.isThrowingGrenade()) return;
    const katana = this.state.katana;
    const range = katana ? KATANA.range : 2.9;
    this.meleeTime = katana ? KATANA.rate : 0.65;
    this.recoil = katana ? 0.08 : 0.23;
    this.meleeSound();
    this.scene.updateMatrixWorld(true);
    const forward = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    for (const e of this.enemies) {
      const v = e.root.position.clone().sub(this.camera.position);
      v.y = 0;
      if (!e.dead && v.length() < range && v.normalize().dot(forward) > (katana ? 0.15 : 0.35)) {
        const point = e.torso.getWorldPosition(new T.Vector3());
        const targetDistance = this.camera.position.distanceTo(point);
        this.ray.set(
          this.camera.position,
          point.clone().sub(this.camera.position).normalize(),
        );
        const wall = this.ray.intersectObjects(this.walls, false)[0];
        if (
          !wall ||
          wall.distance > targetDistance
        )
          this.damageEnemy(
            e,
            (katana ? KATANA.damage : 42) * (1 + this.state.level * 0.35),
            point,
          );
      }
    }
    this.emit();
  }
  grenade() {
    if (this.state.mode !== 'playing' || this.state.grenades <= 0 || this.grenadeTime > 0 || this.meleeTime > 0 || this.isThrowingGrenade()) return;
    this.state.grenades--;
    this.grenadeTime = 1.2;
    this.grenadeThrowTime = GRENADE.throwDuration;
    this.reloadTime = this.state.reload = 0;
    this.sniperReloadQueued = false;
    if (!this.grenadeHand) {
      this.grenadeHand = this.graphics.createGrenadeHand();
      this.heldGrenade = this.grenadeHand.getObjectByName('held-grenade');
      this.camera.add(this.grenadeHand);
    }
    this.heldGrenade!.visible = true;
    this.poseGrenadeThrow(0);
    this.sound(1500, 0.06, 'triangle', 0.08, 750);
    this.message('FRAG OUT', 0.7);
    this.emit();
  }
  isThrowingGrenade() {
    return this.grenadeThrowTime > 0;
  }
  poseGrenadeThrow(elapsed: number) {
    if (!this.grenadeHand) return;
    const windup = T.MathUtils.smoothstep(elapsed, 0, 0.10);
    const release = T.MathUtils.smoothstep(elapsed, 0.10, GRENADE.release);
    const recover = T.MathUtils.smoothstep(elapsed, GRENADE.release, GRENADE.throwDuration);
    this.grenadeHand.visible = this.isThrowingGrenade();
    this.grenadeHand.position.set(
      -0.36 - windup * 0.06 + release * 0.24 - recover * 0.18,
      -0.42 + windup * 0.26 + release * 0.11 - recover * 0.65,
      -0.5 + windup * 0.12 - release * 0.44 + recover * 0.37,
    );
    this.grenadeHand.rotation.set(-windup * 0.5 + release * 0.7, 0.1, -0.2 - release * 0.2);
  }
  releaseGrenade() {
    this.updateCameraAim();
    this.scene.updateMatrixWorld(true);
    const mesh = this.graphics.createGrenade();
    this.heldGrenade!.getWorldPosition(mesh.position);
    this.heldGrenade!.getWorldQuaternion(mesh.quaternion);
    // Keep the release point on the player's side of nearby cover.
    const reach = mesh.position.clone().sub(this.camera.position);
    this.ray.set(this.camera.position, reach.clone().normalize());
    const wall = this.ray.intersectObjects(this.walls, false)[0];
    if (wall && wall.distance < reach.length() + GRENADE.radius)
      mesh.position.copy(this.camera.position).addScaledVector(this.ray.ray.direction, Math.max(0, wall.distance - GRENADE.radius - 0.01));
    mesh.position.y = Math.max(GRENADE.radius, mesh.position.y);
    const velocity = this.camera.getWorldDirection(new T.Vector3()).multiplyScalar(GRENADE.speed);
    velocity.y += 2.8;
    this.scene.add(mesh);
    this.thrownGrenades.push({ mesh, velocity, fuse: GRENADE.fuse });
    this.heldGrenade!.visible = false;
    this.sound(320, 0.12, 'triangle', 0.07, 100);
  }
  clearRockets() {
    if (this.rockets) {
      for (const r of this.rockets) this.scene.remove(r.mesh);
      this.rockets = [];
    }
  }
  launchRocket() {
    const mesh = this.graphics.createRocket();
    const origin = this.camera.position.clone();
    const dir = new T.Vector3();
    this.camera.getWorldDirection(dir);
    if (Math.abs(dir.x) < 1e-12) dir.x = 0;
    if (Math.abs(dir.y) < 1e-12) dir.y = 0;
    if (Math.abs(dir.z) < 1e-12) dir.z = 0;
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    this.scene.add(mesh);
    this.rockets.push({ mesh, velocity: dir.multiplyScalar(RPG.speed), life: RPG.life });
    if (this.gun) {
      const loaded = this.gun.getObjectByName('loaded-rocket');
      if (loaded) loaded.visible = false;
    }
  }
  explode(point: T.Vector3, baseDamage: number, headshotEnemy?: Enemy | null) {
    this.scene.updateMatrixWorld(true);
    this.burst(point, 0xffa347, 18, 4);
    this.explosionSound();
    if (headshotEnemy) {
      this.headshotSound();
      this.message('HEADSHOT', 0.7);
    }
    for (const e of this.enemies) {
      const center = e.root.position.clone().add(new T.Vector3(0, 1, 0));
      const d = center.distanceTo(point);
      if (!e.dead && d < 7) {
        this.ray.set(point, center.clone().sub(point).normalize());
        const isHead = e === headshotEnemy;
        const obstruction = isHead ? null : this.ray.intersectObjects(this.walls, false)[0];
        if (isHead || !obstruction || obstruction.distance >= d) {
          const dmg = baseDamage * (1 - d / 9) * (isHead ? 3.0 : 1);
          this.damageEnemy(e, dmg, isHead ? point : center);
        }
      }
    }
    const playerDist = this.camera.position.distanceTo(point);
    if (playerDist < 7) {
      let obstructed = false;
      if (playerDist > 0.001) {
        this.ray.set(point, this.camera.position.clone().sub(point).normalize());
        const obstruction = this.ray.intersectObjects(this.walls, false)[0];
        if (obstruction && obstruction.distance < playerDist) {
          obstructed = true;
        }
      }
      if (!obstructed) {
        const playerDamage = Math.round(75 * (1 - playerDist / 7));
        if (playerDamage > 0) {
          this.damagePlayer(playerDamage);
          if ((this.state.mode as string) === 'dead') this.clearRockets();
        }
      }
    }
  }
  updateRockets(dt: number) {
    if (this.state.mode !== 'playing' || !this.rockets.length) return;
    this.scene.updateMatrixWorld(true);
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      const speed = r.velocity.length();
      const dir = r.velocity.clone().normalize();
      let step = speed * dt;
      let hitPoint: T.Vector3 | null = null;
      let hitEnemy: Enemy | null = null;
      let isHeadshot = false;

      // Check lifetime expiry first: if expires this step, clamp step to remaining travel
      if (r.life <= dt) {
        const remainingTravel = speed * r.life;
        if (remainingTravel < step) step = remainingTravel;
      }

      // Check ground collision
      if (r.mesh.position.y <= 0.02) {
        hitPoint = r.mesh.position.clone().setY(0);
        step = 0;
      } else if (dir.y < 0) {
        const groundDist = r.mesh.position.y / -dir.y;
        if (groundDist <= step) {
          hitPoint = r.mesh.position.clone().addScaledVector(dir, groundDist).setY(0);
          step = groundDist;
        }
      }

      this.ray.set(r.mesh.position, dir);
      const wall = this.ray.intersectObjects(this.walls, false)[0];
      if (wall && wall.distance <= step) {
        step = wall.distance;
        hitPoint = r.mesh.position.clone().addScaledVector(dir, Math.max(0, wall.distance - 0.01));
        hitEnemy = null;
        isHeadshot = false;
      }
      for (const box of this.obstacles) {
        const hit = this.ray.ray.intersectBox(box, new T.Vector3());
        if (hit && r.mesh.position.distanceTo(hit) <= step) {
          step = r.mesh.position.distanceTo(hit);
          hitPoint = hit;
          hitEnemy = null;
          isHeadshot = false;
        }
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        const hits = this.ray.intersectObjects(e.parts, false);
        if (hits[0] && hits[0].distance <= step) {
          step = hits[0].distance;
          hitPoint = hits[0].point;
          hitEnemy = e;
          const headHit = hits.find((h) => h.object.userData.hitZone === 'head');
          if (
            headHit &&
            (hits[0].object.userData.hitZone === 'head' ||
              headHit.distance - hits[0].distance < 0.65)
          ) {
            isHeadshot = true;
            hitPoint = headHit.point;
          } else {
            isHeadshot = false;
          }
        }
      }

      if (hitPoint) {
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        this.explode(hitPoint, RPG.damage, isHeadshot ? hitEnemy : null);
        if ((this.state.mode as string) === 'dead') break;
      } else {
        const travelTime = Math.min(dt, r.life);
        r.mesh.position.addScaledVector(r.velocity, travelTime);
        r.life -= dt;
        if (r.life <= 0) {
          const p = r.mesh.position.clone();
          this.scene.remove(r.mesh);
          this.rockets.splice(i, 1);
          this.explode(p, RPG.damage, null);
        }
      }
    }
  }
  updateGrenades(dt: number) {
    if (this.state.mode !== 'playing' || (!this.isThrowingGrenade() && this.thrownGrenades.length === 0)) return;
    this.scene.updateMatrixWorld(true);
    const direction = new T.Vector3();
    const normal = new T.Vector3();
    const normalMatrix = new T.Matrix3();
    // Small simulation steps and swept rays keep fast throws from skipping thin cover.
    for (let remaining = dt; remaining > 1e-8; ) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      if (this.isThrowingGrenade()) {
        const before = GRENADE.throwDuration - this.grenadeThrowTime;
        this.grenadeThrowTime = Math.max(0, this.grenadeThrowTime - step);
        const after = GRENADE.throwDuration - this.grenadeThrowTime;
        if (before < GRENADE.release && after >= GRENADE.release) {
          this.poseGrenadeThrow(GRENADE.release);
          this.releaseGrenade();
        }
        this.poseGrenadeThrow(after);
      }
      for (let i = this.thrownGrenades.length - 1; i >= 0; i--) {
        const p = this.thrownGrenades[i];
        p.velocity.y -= GRENADE.gravity * step;
        const distance = p.velocity.length() * step;
        direction.copy(p.velocity).normalize();
        this.ray.set(p.mesh.position, direction);
        const wall = this.ray.intersectObjects(this.walls, false)[0];
        if (wall?.face && wall.distance <= distance + GRENADE.radius) {
          p.mesh.position.addScaledVector(direction, Math.max(0, wall.distance - GRENADE.radius - 0.002));
          normal.copy(wall.face.normal).applyMatrix3(normalMatrix.getNormalMatrix(wall.object.matrixWorld)).normalize();
          p.velocity.reflect(normal).multiplyScalar(0.48);
        } else {
          p.mesh.position.addScaledVector(p.velocity, step);
        }
        if (p.mesh.position.y < GRENADE.radius) {
          p.mesh.position.y = GRENADE.radius;
          p.velocity.y = Math.abs(p.velocity.y) > 1 ? Math.abs(p.velocity.y) * 0.38 : 0;
          const friction = Math.exp(-5 * step);
          p.velocity.x *= friction;
          p.velocity.z *= friction;
        }
        p.mesh.rotation.x += step * p.velocity.length() * 0.8;
        p.mesh.rotation.z += step * p.velocity.length() * 0.35;
        p.fuse -= step;
        if (p.fuse <= 0) {
          this.scene.remove(p.mesh);
          this.thrownGrenades.splice(i, 1);
          this.explodeGrenade(p.mesh.position);
        }
      }
    }
  }
  clearGrenades() {
    for (const p of this.thrownGrenades) this.scene.remove(p.mesh);
    this.thrownGrenades = [];
    this.grenadeThrowTime = 0;
    this.grenadeTime = 0;
    if (this.grenadeHand) this.grenadeHand.visible = false;
  }
  explodeGrenade(point: T.Vector3) {
    this.scene.updateMatrixWorld(true);
    this.burst(point, 0xffa347, 50, 12);
    this.explosionSound();
    for (const e of this.enemies) {
      const center = e.root.position.clone().add(new T.Vector3(0, 1, 0));
      const d = center.distanceTo(point);
      if (!e.dead && d < 7) {
        this.ray.set(point, center.clone().sub(point).normalize());
        const obstruction = this.ray.intersectObjects(this.walls, false)[0];
        if (!obstruction || obstruction.distance >= d)
          this.damageEnemy(e, 300 * (1 - d / 9), center);
      }
    }
    const playerDist = this.camera.position.distanceTo(point);
    if (playerDist < 7) {
      let obstructed = false;
      if (playerDist > 0.001) {
        this.ray.set(point, this.camera.position.clone().sub(point).normalize());
        const obstruction = this.ray.intersectObjects(this.walls, false)[0];
        if (obstruction && obstruction.distance < playerDist) {
          obstructed = true;
        }
      }
      if (!obstructed) {
        const playerDamage = Math.round(75 * (1 - playerDist / 7));
        if (playerDamage > 0) {
          this.damagePlayer(playerDamage);
        }
      }
    }
  }
  isHansWave() { return this.state.wave === HANS.wave; }
  completeWave() {
    const finalWave = HANS.wave;
    this.finish(this.state.wave >= finalWave ? 'won' : 'cleared');
  }
  chooseEnemyKind() {
    if (this.isHansWave()) return HANS.kind;
    const totalWavePending =
      (6 + this.state.wave * 3) * (this.difficultyMode === 'hard' ? 2 : 1);
    const order = totalWavePending - this.pending;
    if (this.state.wave < 4 || this.state.wave > 6) return this.chooseBaseEnemyKind(order, totalWavePending);
    const key = `${this.state.wave}/${this.difficultyMode}`;
    if (this.enemySpawnPlan?.key !== key) {
      const base = Array.from({ length: totalWavePending }, (_, i) => this.chooseBaseEnemyKind(i, totalWavePending));
      this.enemySpawnPlan = { key, kinds: replaceSirenSlots(base, this.state.wave, this.difficultyMode) };
    }
    return this.enemySpawnPlan.kinds[order] ?? this.chooseBaseEnemyKind(order, totalWavePending);
  }
  private chooseBaseEnemyKind(order: number, totalWavePending: number) {
    // Freshpound (3): 1 appears in Wave 5, 2 appear in Wave 6 (opening and midpoint).
    if (this.state.wave === 5 && order === 0) return 3;
    if (
      this.state.wave >= 6 &&
      (order === 0 || order === Math.floor(totalWavePending / 2))
    )
      return 3;
    if (this.state.wave >= 2 && order === 1) return 4; // Bloat
    if (order === 2) return 5; // Crawler
    if (this.state.wave >= 3 && order === 3) return 6; // Husk
    if (order === 4) return 1; // Gorefast
    const roll = Math.random();
    if (this.state.wave === 1) {
      if (roll < 0.25) return 5; // Crawler
      if (roll < 0.50) return 1; // Gorefast
      return 0; // Clot
    }
    if (this.state.wave >= 2 && roll < 0.17) return 4; // Bloat
    if (roll < 0.32) return 5; // Crawler
    if (this.state.wave >= 3 && roll < 0.46) return 6; // Husk
    if (this.state.wave >= 3 && roll < 0.61) return 2; // Scrake
    if (this.state.wave >= 2 && roll < 0.78) return 1; // Gorefast
    return 0; // Clot
  }
  spawn() {
    const kind = this.chooseEnemyKind();
    const stats = ENEMIES[kind];
    const rig = this.graphics.createEnemy(kind);
    const { root, parts } = rig;
    let x = 0,
      z = 0;
    for (let i = 0; i < 100; i++) {
      const edge = Math.floor(Math.random() * 4);
      x = edge < 2 ? (edge === 0 ? -28 : 28) : (Math.random() - 0.5) * 55;
      z = edge >= 2 ? (edge === 2 ? -28 : 28) : (Math.random() - 0.5) * 55;
      if (
        !this.blocked(x, z, 0.6) &&
        Math.hypot(x - this.camera.position.x, z - this.camera.position.z) > 14
      )
        break;
    }
    root.position.set(x, 0, z);
    this.scene.add(root);
    const maxHp = kind === HANS.kind ? (this.difficultyMode === 'hard' ? HANS.hpHard : HANS.hp) :
      stats.hp * (1 + (this.state.wave - 1) * 0.1) * this.difficulty;
    const e: Enemy = {
      ...rig,
      shadow: this.contactShadow(x, z, root.scale.x * 1.3, root.scale.x * 0.9),
      hp: maxHp,
      maxHp,
      scrakeEnraged: false,
      speed: kind === HANS.kind ? HANS.speed :
        stats.speed *
        (1 + (this.state.wave - 1) * 0.045) *
        (this.difficulty === 1.35 ? 1.1 : 1),
      damage: kind === HANS.kind ? HANS.clawDamage : stats.damage * this.difficulty,
      kind,
      phase: Math.random() * 6,
      attack: 0.8,
      meleeSwing: 0,
      ragePhase: 'calm',
      rageTime: FRESHPOUND_RAGE.interval,
      chargeDirection: new T.Vector3(),
      rangedWindup: 0,
      rangedCooldown: 1.2,
      rangedAim: null,
      dead: false,
    };
    for (const p of parts) p.userData.enemy = e;
    if (kind === SIREN.kind) e.siren = new SirenAttack(this, e);
    this.enemies.push(e);
    if (kind === HANS.kind) {
      this.hans?.dispose();
      this.hans = new HansEncounter(this, e);
      this.emit();
    }
    this.pending--;
  }
  updateNavigation() {
    this.nav.fill(-1);
    const blocked = new Uint8Array(61 * 61);
    for (let z = 0; z < 61; z++)
      for (let x = 0; x < 61; x++)
        if (this.blocked(x - 30, z - 30, 0.5)) blocked[z * 61 + x] = 1;
    const px = T.MathUtils.clamp(
        Math.round(this.camera.position.x) + 30,
        0,
        60,
      ),
      pz = T.MathUtils.clamp(Math.round(this.camera.position.z) + 30, 0, 60),
      start = pz * 61 + px;
    const q = [start];
    this.nav[start] = 0;
    for (let h = 0; h < q.length; h++) {
      const n = q[h],
        x = n % 61,
        z = Math.floor(n / 61);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          j = nz * 61 + nx;
        if (
          nx < 0 ||
          nx > 60 ||
          nz < 0 ||
          nz > 60 ||
          blocked[j] ||
          this.nav[j] >= 0
        )
          continue;
        this.nav[j] = this.nav[n] + 1;
        q.push(j);
      }
    }
  }
  clearEnemyProjectiles() {
    this.hans?.clearHazards();
    for (const e of this.enemies) e.siren?.cancel();
    this.enemySpawnPlan = undefined;
    for (const p of this.enemyProjectiles) this.scene.remove(p.mesh);
    this.enemyProjectiles = [];
  }
  damagePlayer(amount: number, bypassArmor = false) {
    if (this.state.mode !== 'playing') return;
    const currentArmor = this.state.armor ?? 0;
    const absorb = bypassArmor ? 0 : Math.min(currentArmor, amount);
    this.state.armor = currentArmor - absorb;
    const minHp = this.state.debugMinHp ? 1 : 0;
    this.state.health = Math.max(minHp, this.state.health - amount + absorb);
    this.state.hurt = 0.85;
    this.hurtSound();
    if (this.state.health <= 0) this.finish('dead');
  }
  updateRangedEnemy(e: Enemy, dt: number, distance: number) {
    const husk = e.kind === 6;
    e.rangedCooldown = Math.max(0, e.rangedCooldown - dt);
    if (e.rangedWindup > 0) {
      e.rangedWindup = Math.max(0, e.rangedWindup - dt);
      if (e.rangedWindup === 0) {
        if (husk) this.fireCannon(e);
        else this.spitBile(e);
        e.rangedAim = null;
        e.rangedCooldown = husk ? 3 : 3.4;
      }
      return true;
    }
    if (distance < (husk ? 4 : 3) || distance > (husk ? 27 : 19)) return false;
    e.root.updateMatrixWorld(true);
    const mouth = e.cannonMuzzle?.getWorldPosition(new T.Vector3())
      ?? e.neck.localToWorld(new T.Vector3(0, 0.02, 0.22));
    const aim = this.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
    this.ray.set(mouth, aim.clone().sub(mouth).normalize());
    const wall = this.ray.intersectObjects(this.walls, false)[0];
    if (wall && wall.distance < mouth.distanceTo(aim)) return false;
    if (e.rangedCooldown === 0) {
      // Lock the target before the windup so the player can dodge sideways.
      e.rangedAim = aim;
      e.rangedWindup = husk ? 0.9 : 0.8;
      if (husk) this.sound(180, 0.65, 'sawtooth', 0.06, 520);
      else this.sound(90, 0.3, 'triangle', 0.1, 45);
    }
    return true;
  }
  spitBile(e: Enemy) {
    if (e.dead || !e.rangedAim || this.enemyProjectiles.length > 21) return;
    e.root.updateMatrixWorld(true);
    const mouth = e.neck.localToWorld(new T.Vector3(0, 0.02, 0.24));
    const direction = e.rangedAim.clone().sub(mouth).normalize();
    const side = direction.clone().cross(new T.Vector3(0, 1, 0)).normalize();
    this.bileMaterial ??= this.graphics.material(new T.MeshStandardMaterial({
      color: 0xa2bf35, emissive: 0x567a0a, emissiveIntensity: 0.8,
      roughness: 0.35,
    }));
    for (let i = -1; i <= 1; i++) {
      const mesh = new T.Mesh(SPHERE, this.bileMaterial);
      const dir = direction.clone().addScaledVector(side, i * 0.045).normalize();
      mesh.position.copy(mouth).addScaledVector(dir, (i + 1) * 0.16);
      mesh.scale.set(0.13, 0.13, 0.28);
      mesh.lookAt(mesh.position.clone().add(dir));
      this.scene.add(mesh);
      this.enemyProjectiles.push({ mesh, velocity: dir.multiplyScalar(20), life: 2, damage: e.damage * 0.65, kind: 'bile' });
    }
    if (this.audio && this.master) {
      this.playNoise(0.28, 0.24, {
        type: 'lowpass', freqStart: 850, freqEnd: 160, q: 0.8,
      }, this.audio.currentTime);
    }
    e.rangedAim = null;
  }
  fireCannon(e: Enemy) {
    if (e.dead || !e.rangedAim || !e.cannonMuzzle || this.enemyProjectiles.length >= 24) return;
    e.root.updateMatrixWorld(true);
    const muzzle = e.cannonMuzzle.getWorldPosition(new T.Vector3());
    const direction = e.rangedAim.clone().sub(muzzle).normalize();
    this.cannonMaterial ??= this.graphics.material(new T.MeshBasicMaterial({ color: 0xffb34d }));
    const mesh = new T.Mesh(SPHERE, this.cannonMaterial);
    mesh.position.copy(muzzle);
    mesh.scale.set(0.16, 0.16, 0.48);
    mesh.lookAt(muzzle.clone().add(direction));
    this.scene.add(mesh);
    this.enemyProjectiles.push({ mesh, velocity: direction.multiplyScalar(60), life: 2, damage: e.damage, kind: 'cannon' });
    this.burst(muzzle, 0xff9b32, 5, 1.4);
    this.sound(140, 0.22, 'sawtooth', 0.18, 35);
    if (this.audio && this.master) {
      this.playNoise(0.24, 0.3, {
        type: 'lowpass', freqStart: 1600, freqEnd: 90, q: 0.7,
      }, this.audio.currentTime);
    }
    e.rangedAim = null;
  }
  updateEnemyProjectiles(dt: number) {
    if (this.state.mode !== 'playing' || this.enemyProjectiles.length === 0) return;
    this.scene.updateMatrixWorld(true);
    const player = new T.Box3(
      this.camera.position.clone().add(new T.Vector3(-0.44, -1.6, -0.44)),
      this.camera.position.clone().add(new T.Vector3(0.44, 0.2, 0.44)),
    );
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= dt;
      const step = p.velocity.length() * dt;
      const origin = p.mesh.position;
      this.ray.set(origin, p.velocity.clone().normalize());
      const wall = this.ray.intersectObjects(this.walls, false)[0];
      let obstacleDistance = wall?.distance ?? Infinity;
      let insideObstacle = false;
      for (const box of this.obstacles) {
        if (box.containsPoint(origin)) {
          insideObstacle = true;
          obstacleDistance = 0;
          break;
        }
        const hit = this.ray.ray.intersectBox(box, new T.Vector3());
        if (hit) {
          const d = origin.distanceTo(hit);
          if (d < obstacleDistance) obstacleDistance = d;
        }
      }
      const body = this.ray.ray.intersectBox(player, new T.Vector3());
      const bodyDistance = player.containsPoint(origin) ? 0 : body ? origin.distanceTo(body) : Infinity;
      const wallDistance = obstacleDistance;
      const hitsPlayer = !insideObstacle && bodyDistance <= step && bodyDistance < wallDistance;
      const hitsWall = insideObstacle || wallDistance <= step;
      if (hitsPlayer || hitsWall || p.life <= 0 || origin.y < 0) {
        this.enemyProjectiles.splice(i, 1);
        this.scene.remove(p.mesh);
        if (hitsPlayer || hitsWall) {
          const point = insideObstacle
            ? origin.clone()
            : this.ray.ray.at(hitsPlayer ? bodyDistance : wallDistance, new T.Vector3());
          const cannon = p.kind === 'cannon';
          this.burst(point, cannon ? 0xff9b32 : p.kind === 'rifle' ? 0xffd58a : 0x91ab28, cannon ? 10 : p.kind === 'rifle' ? 2 : 4, cannon ? 2.8 : 1.2);
          if (cannon) this.sound(90, 0.18, 'triangle', 0.12, 25);
        }
        if (hitsPlayer) this.damagePlayer(p.damage);
        if (this.state.mode !== 'playing') return;
      } else {
        origin.addScaledVector(p.velocity, dt);
      }
    }
  }
  hasEnemyMeleeSight(e: Enemy) {
    const origin = e.root.position.clone().add(new T.Vector3(0, 1.2 * e.root.scale.y, 0));
    const target = this.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
    this.ray.set(origin, target.clone().sub(origin).normalize());
    const wall = this.ray.intersectObjects(this.walls, false)[0];
    return !wall || wall.distance >= origin.distanceTo(target);
  }
  enemyMelee(e: Enemy) {
    if (e.kind === SIREN.kind) return;
    e.attack = e.kind === 1 ? 0.8 : 1.15;
    if (e.chainsaw || e.drill || e.blade) {
      e.meleeSwing = e.chainsaw ? SCRAKE_MELEE.swingDuration : 0.42;
      if (e.chainsaw) this.sound(65, 0.32, 'sawtooth', 0.1, 155);
      else if (e.drill) this.sound(110, 0.3, 'sawtooth', 0.13, 240);
      else this.sound(360, 0.12, 'triangle', 0.07, 90);
    }
    this.damagePlayer(e.damage);
  }
  endFreshpoundCharge(e: Enemy) {
    e.ragePhase = 'calm';
    e.rageTime = FRESHPOUND_RAGE.interval;
    e.chargeDirection.set(0, 0, 0);
  }
  updateFreshpoundRage(e: Enemy, dt: number) {
    e.rageTime = Math.max(0, e.rageTime - dt);
    if (e.ragePhase === 'calm') {
      if (e.rageTime > 0) return false;
      e.ragePhase = 'windup';
      e.rageTime = FRESHPOUND_RAGE.windup;
      this.sound(65, 0.85, 'sawtooth', 0.18, 155);
      this.message('FRESHPOUND ENRAGED', 1.2);
      return true;
    }
    const pos = e.root.position;
    if (e.ragePhase === 'windup') {
      e.root.rotation.y = Math.atan2(this.camera.position.x - pos.x, this.camera.position.z - pos.z);
      if (e.rageTime === 0) {
        e.ragePhase = 'charging';
        e.rageTime = FRESHPOUND_RAGE.duration;
        // Lock the direction when the roar ends, leaving room for a sideways dodge.
        e.chargeDirection.copy(this.camera.position).sub(pos).setY(0).normalize();
        this.sound(160, 0.25, 'sawtooth', 0.16, 320);
      }
      return true;
    }
    if (e.rageTime === 0) {
      this.endFreshpoundCharge(e);
      return true;
    }
    const travel = e.speed * FRESHPOUND_RAGE.speedMultiplier * dt;
    const steps = Math.max(1, Math.ceil(travel / 0.2));
    const step = e.chargeDirection.clone().multiplyScalar(travel / steps);
    for (let i = 0; i <= steps; i++) {
      const playerDist = Math.hypot(pos.x - this.camera.position.x, pos.z - this.camera.position.z);
      if (playerDist <= 2.8 && this.feet < 2.5 && this.hasEnemyMeleeSight(e)) {
        this.enemyMelee(e);
        this.endFreshpoundCharge(e);
        return true;
      }
      if (i === steps) break;
      // Freshpound charges through other enemies, knocking them outward so only solid cover or the player stops the charge.
      for (const other of this.enemies) {
        if (other === e || other.dead) continue;
        const ox = other.root.position.x - (pos.x + step.x);
        const oz = other.root.position.z - (pos.z + step.z);
        const odist = Math.hypot(ox, oz);
        if (odist < 1.7) {
          const push = new T.Vector3(ox, 0, oz).normalize();
          if (push.lengthSq() === 0) push.set(-step.z, 0, step.x).normalize();
          const force = (1.7 - odist) + 0.6;
          this.move(other.root.position, push.x * force, push.z * force, 0.45);
        }
      }
      if (this.blocked(pos.x + step.x, pos.z + step.z, 0.5)) {
        this.endFreshpoundCharge(e);
        return true;
      }
      pos.x += step.x;
      pos.z += step.z;
    }
    return true;
  }
  updateEnemies(dt: number) {
    if (this.state.mode !== 'playing') {
      for (const e of this.enemies) e.siren?.silence();
      return;
    }
    this.navTime -= dt;
    if (this.navTime <= 0) {
      this.updateNavigation();
      this.navTime = 0.55;
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.kind === HANS.kind) {
        this.hans?.update(dt);
        if (this.state.mode !== 'playing') return;
        continue;
      }
      const pos = e.root.position;
      e.attack -= dt;
      e.meleeSwing = Math.max(0, e.meleeSwing - dt);
      const scrakeRaging = e.kind === 2 && e.scrakeEnraged;
      const raging = e.kind === 3 && this.updateFreshpoundRage(e, dt);
      if (this.state.mode !== 'playing') return;
      let dx = this.camera.position.x - pos.x,
        dz = this.camera.position.z - pos.z;
      const distance = Math.hypot(dx, dz);
      const meleeRange = e.chainsaw ? SCRAKE_MELEE.range : e.drill ? FRESHPOUND_DRILL.range : 1.35;
      let canMelee = e.kind !== SIREN.kind && distance <= meleeRange;
      if (canMelee && (e.chainsaw || e.drill || e.blade)) {
        canMelee = this.hasEnemyMeleeSight(e);
      }
      e.phase += dt * e.speed * (e.ragePhase === 'charging' ? 18 : 4);
      const sirenHolding = e.siren?.update(dt, distance) ?? false;
      if (this.state.mode !== 'playing') return;
      const ranged = sirenHolding || ((e.kind === 4 || e.kind === 6) && this.updateRangedEnemy(e, dt, distance));
      if (!raging && (!canMelee || scrakeRaging) && !ranged) {
        let clear = true;
        for (let t = 0.5; t < distance; t += 0.6)
          if (
            this.blocked(
              pos.x + (dx / distance) * t,
              pos.z + (dz / distance) * t,
              0.45,
            )
          ) {
            clear = false;
            break;
          }
        if (!clear) {
          const gx = Math.round(pos.x) + 30,
            gz = Math.round(pos.z) + 30;
          let best = 9999,
            target: T.Vector2 | null = null;
          for (let oz = -1; oz <= 1; oz++)
            for (let ox = -1; ox <= 1; ox++) {
              if (!ox && !oz) continue;
              const nx = gx + ox,
                nz = gz + oz;
              if (nx < 0 || nx > 60 || nz < 0 || nz > 60) continue;
              const value = this.nav[nz * 61 + nx];
              if (
                value >= 0 &&
                value < best &&
                !this.blocked(nx - 30, pos.z, 0.45) &&
                !this.blocked(pos.x, nz - 30, 0.45)
              ) {
                best = value;
                target = new T.Vector2(nx - 30, nz - 30);
              }
            }
          if (target) {
            dx = target.x - pos.x;
            dz = target.y - pos.z;
          }
        }
        const len = Math.hypot(dx, dz) || 1;
        let vx = dx / len,
          vz = dz / len;
        for (const other of this.enemies) {
          if (other === e || other.dead) continue;
          const sx = pos.x - other.root.position.x,
            sz = pos.z - other.root.position.z,
            d = Math.hypot(sx, sz);
          if (d > 0 && d < 0.85) {
            vx += (sx / d) * (0.85 - d) * 1.5;
            vz += (sz / d) * (0.85 - d) * 1.5;
          }
        }
        let travel = e.speed * dt;
        if (scrakeRaging) {
          // Bound the entire step, including separation, so it cannot cross the player.
          travel = Math.min(travel, Math.max(0, distance - SCRAKE_RAGE.contactDistance) / (Math.hypot(vx, vz) || 1));
        }
        this.move(pos, vx * travel, vz * travel, 0.45);
        e.root.rotation.y = Math.atan2(dx, dz);
      }
      if (scrakeRaging) {
        dx = this.camera.position.x - pos.x;
        dz = this.camera.position.z - pos.z;
        canMelee = Math.hypot(dx, dz) <= meleeRange && this.hasEnemyMeleeSight(e);
      }
      if (!raging && canMelee && e.attack <= 0 && this.feet < 1.0) {
        this.enemyMelee(e);
        if (this.state.mode !== 'playing') return;
      }
      if (ranged) {
        const aim = e.rangedAim ?? this.camera.position;
        e.root.rotation.y = Math.atan2(aim.x - pos.x, aim.z - pos.z);
      }
      if (canMelee && !raging) e.root.rotation.y = Math.atan2(dx, dz);
      const stride = ranged || e.ragePhase === 'windup' ? 0 : scrakeRaging ? 1.6 : canMelee ? 0.22 : 1;
      const reach = distance < 2.4 ? -1.18 : -0.45;
      e.root.position.y = Math.sin(e.phase * 2) * 0.018;
      e.torso.rotation.z = Math.sin(e.phase) * 0.05;
      e.torso.rotation.x = e.kind === 5 ? 1.1 : e.rangedWindup > 0 ? -0.18 : e.kind === 1 ? 0.18 : 0.08;
      e.neck.rotation.z = Math.sin(e.phase * 0.47) * 0.12;
      e.neck.rotation.x = (e.kind === 5 ? -1.05 : e.rangedWindup > 0 ? -0.3 : -0.06) + Math.sin(e.phase * 0.31) * 0.06;
      for (let i = 0; i < 2; i++) {
        const gait = Math.sin(e.phase + i * Math.PI);
        e.elbows[i].rotation.x = e.kind === 5 ? -1.1 - Math.max(0, gait) * 0.25 : -0.35 - Math.max(0, gait) * 0.35;
        if (e.knees[i]) e.knees[i].rotation.x = Math.max(0, -gait) * 0.65 * stride;
      }
      e.shadow.position.set(pos.x, 0.025, pos.z);
      e.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(e.phase + i * Math.PI) * 0.38 * stride; });
      e.arms[0].rotation.x = e.kind === 5 ? -0.8 + Math.sin(e.phase) * 0.35 : reach + Math.sin(e.phase) * 0.18;
      e.arms[1].rotation.x = e.kind === 5 ? -0.8 - Math.sin(e.phase) * 0.35 : reach - 0.15 - Math.sin(e.phase) * 0.18;
      if (e.chainsaw && e.sawChain) {
        if (scrakeRaging) {
          // Continuous sweeping is visual only; enemyMelee owns damage and cooldown.
          const sweep = Math.sin(e.phase);
          e.arms[1].rotation.x = -1.4 - Math.cos(e.phase) * 0.35;
          e.arms[1].rotation.y = sweep * 0.8;
          e.arms[1].rotation.z = sweep * 1.05;
          e.elbows[1].rotation.x = -0.3;
          e.arms[0].rotation.x = -1.1 - sweep * 0.35;
          e.torso.rotation.y = sweep * 0.4;
          e.torso.rotation.x = 0.38;
          e.chainsaw.rotation.z = -sweep * 0.2;
        } else {
          const progress = 1 - e.meleeSwing / SCRAKE_MELEE.swingDuration;
          const raise = T.MathUtils.smoothstep(progress, 0, 0.25);
          const cut = T.MathUtils.smoothstep(progress, 0.25, 0.7);
          const weight = 1 - T.MathUtils.smoothstep(progress, 0.7, 1);
          // Raise the saw overhead, sweep it across the body, then recover the stance.
          e.arms[1].rotation.x = -0.65 + (-1.8 * raise + 0.9 * cut) * weight;
          e.arms[1].rotation.z = (0.65 * raise - 1.4 * cut) * weight;
          e.elbows[1].rotation.x = -0.45 + (0.25 * raise - 0.15 * cut) * weight;
          e.arms[0].rotation.x = -0.55 - 0.8 * raise * weight;
          e.torso.rotation.y = (0.38 * raise - 0.76 * cut) * weight;
          e.torso.rotation.x += 0.22 * cut * weight;
          e.chainsaw.rotation.z = (-0.15 * raise + 0.3 * cut) * weight;
        }
        const phase = Math.floor(e.phase * 9) % 2;
        e.sawChain.children.forEach((teeth, i) => { teeth.visible = i === phase; });
      }
      if (e.blade) {
        const swing = Math.sin((1 - e.meleeSwing / 0.42) * Math.PI);
        e.arms[1].rotation.x = reach - swing * 0.75;
        e.arms[1].rotation.z = -swing * 0.45;
      }
      if (e.drill && e.drillBit) {
        const charging = e.ragePhase === 'charging';
        const swing = Math.sin((1 - e.meleeSwing / 0.42) * Math.PI);
        const rotDelta = dt * (charging ? 65 : 22);
        e.drillBit.rotation.y = (e.drillBit.rotation.y + rotDelta) % (Math.PI * 2);
        if (e.drillBitLeft) {
          e.drillBitLeft.rotation.y = (e.drillBitLeft.rotation.y + rotDelta) % (Math.PI * 2);
        }
        e.torso.rotation.x = charging ? 0.32 : e.ragePhase === 'windup' ? -0.15 : 0.08;
        e.arms[0].rotation.x = charging ? -1.72 : -0.75 - swing * 0.8;
        e.elbows[0].rotation.x = charging ? -0.15 : -0.4;
        e.arms[1].rotation.x = charging ? -1.72 : -0.75 - swing * 0.8;
        e.elbows[1].rotation.x = charging ? -0.15 : -0.4;
        if (e.rageIndicator) {
          e.rageIndicator.visible = e.ragePhase !== 'calm';
          e.rageIndicator.scale.setScalar(1 + Math.sin(e.phase * 9) * 0.2);
        }
      }
      if (e.kind === 6) {
        // The arm cannon points forward; its charge is independent per clone.
        e.arms[1].rotation.x = -Math.PI / 2 - e.torso.rotation.x;
        e.elbows[1].rotation.x = 0;
        if (e.cannonCharge) {
          e.cannonCharge.visible = e.rangedWindup > 0;
          e.cannonCharge.scale.setScalar(0.5 + (1 - e.rangedWindup / 0.9) * 1.5);
        }
      }
      e.siren?.pose(sirenHolding);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }
  finish(mode: 'dead' | 'won' | 'cleared' | 'shop') {
    this.clearEnemyProjectiles();
    this.clearGrenades();
    this.clearRockets();
    this.state.mode = mode;
    this.shooting = false;
    this.aiming = false;
    this.keys.clear();
    this.reloadTime = 0;
    this.state.reload = 0;
    this.state.message = '';
    this.sniperReloadQueued = false;
    if (mode === 'cleared' || mode === 'shop' || mode === 'won')
      this.state.health = 100;
    if (mode === 'cleared' || mode === 'shop') {
      this.state.cash += 250 + this.state.wave * 50;
      this.sound(350, 0.8, 'sine', 0.35, 700);
    }
    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.renderer?.domElement
    )
      document.exitPointerLock();
    this.emit();
  }
  frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;
    const rawDt = (now - (this.previousFrame || now)) / 1000;
    this.previousFrame = now;
    if (rawDt > 0 && rawDt < 0.25) {
      this.frameSamples++;
      this.frameTotal += rawDt;
      if (this.frameTotal >= 0.6) {
        this.fps = Math.round(this.frameSamples / this.frameTotal);
        this.frameSamples = 0;
        this.frameTotal = 0;
      }
    }
    const s = this.state;
    if (s.mode === 'playing') {
      s.time += dt;
      this.waveTime += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.updateBolt(dt);
      this.updateHealCooldown(dt);
      this.meleeTime = Math.max(0, this.meleeTime - dt);
      this.grenadeTime = Math.max(0, this.grenadeTime - dt);
      s.hit = Math.max(0, s.hit - dt);
      s.hurt = Math.max(0, s.hurt - dt * 1.8);
      this.messageTime -= dt;
      if (this.messageTime <= 0) s.message = '';
      let forward =
          Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')),
        strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const moving = forward !== 0 || strafe !== 0;
      const sprint =
        this.keys.has('ShiftLeft') && moving && s.stamina > 2 && !this.aiming;
      const speed = sprint ? 6.2 : this.aiming ? 2.3 : 3.7;
      const norm = Math.hypot(forward, strafe) || 1;
      forward /= norm;
      strafe /= norm;
      this.move(
        this.camera.position,
        (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) *
          dt *
          speed,
        (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) *
          dt *
          speed,
      );
      s.stamina = T.MathUtils.clamp(
        s.stamina + dt * (sprint ? -STAMINA.drain : STAMINA.recover),
        0,
        STAMINA.max,
      );
      this.vertical -= 14 * dt;
      this.feet = Math.max(0, this.feet + this.vertical * dt);
      if (this.feet === 0) this.vertical = 0;
      this.camera.position.y =
        1.7 +
        this.feet +
        (moving ? Math.sin(this.elapsed * (sprint ? 12 : 8)) * 0.018 : 0);
      this.viewRecoil.update(dt);
      this.updateCameraAim();
      this.camera.fov = T.MathUtils.lerp(
        this.camera.fov,
        this.isThrowingGrenade() ? 76 : this.isScoped() ? 18 : this.isCyclingBolt() ? 76 : this.aiming ? 51 : sprint ? 80 : 76,
        1 - Math.exp(-10 * dt),
      );
      this.camera.updateProjectionMatrix();
      this.updateReload(dt);
      if (
        this.shooting &&
        (this.weaponIndex === 1 || (this.weaponIndex === 0 && this.state.g18c))
      ) {
        // Held fire stops at an empty magazine; a fresh click may reload.
        this.shoot(false);
        this.updateCameraAim();
      }
      this.spawnTime -= dt;
      if (this.pending > 0 && this.spawnTime <= 0) {
        this.spawn();
        const baseInterval = Math.max(0.42, 1.5 - this.state.wave * 0.13);
        this.spawnTime =
          this.difficultyMode === 'hard'
            ? Math.max(0.32, baseInterval * 0.75)
            : baseInterval;
      }
      this.updateEnemies(dt);
      this.updateEnemyProjectiles(dt);
      this.hans?.updateHazards(dt);
      this.updateGrenades(dt);
      this.updateRockets(dt);
      if (
        s.mode === 'playing' &&
        s.remaining === 0 &&
        this.pending === 0 &&
        this.waveTime > 2 &&
        this.corpses.length === 0
      )
        this.completeWave();
    } else if (s.mode === 'menu') {
      this.camera.position.set(
        4 + Math.sin(this.elapsed * 0.09) * 1.1,
        2.7,
        20,
      );
      this.camera.lookAt(0, 3, -15);
    }
    this.flashlight.intensity = s.mode === 'playing' || s.mode === 'paused' ? 18 : 0;
    this.katana.visible = (s.mode === 'playing' || s.mode === 'paused') && s.katana && this.meleeTime > 0;
    this.gun.visible = (s.mode === 'playing' || s.mode === 'paused') && !this.isScoped() && !this.katana.visible;
    const throwing = this.isThrowingGrenade();
    const ads = this.aiming && !this.isCyclingBolt() && !throwing;
    if (s.mode !== 'paused') {
      this.recoil *= Math.exp(-(ads ? 24 : 14) * dt);
      if (this.recoil < 0.0005) this.recoil = 0;
    }
    const targetX = ads ? 0 : 0.27;
    const targetY =
      (ads ? (this.weaponIndex === 1 ? -0.106 : -0.120) : -0.25) -
      (throwing ? 0.45 : 0) -
      (this.reloadTime > 0 ? Math.sin(s.reload * Math.PI) * 0.35 : 0) +
      Math.sin(this.elapsed * 1.5) * (ads ? 0.0008 : 0.003);
    const targetZ = (ads ? -0.38 : -0.42) + this.recoil * (ads ? 0.45 : 1);
    this.gun.position.x = T.MathUtils.lerp(this.gun.position.x, targetX, 0.2);
    this.gun.position.y = T.MathUtils.lerp(this.gun.position.y, targetY, 0.2);
    this.gun.position.z = T.MathUtils.lerp(this.gun.position.z, targetZ, 0.25);
    this.gun.rotation.set(
      this.recoil * (ads ? 0.32 : 1.8),
      this.meleeTime > 0.35 ? -0.6 : this.viewRecoil.modelYaw * (ads ? 0.12 : 0.7),
      this.reloadTime > 0 ? -0.4 : this.isCyclingBolt() ? -0.12 : ads ? 0 : this.viewRecoil.modelYaw * 0.4,
    );
    if (this.katana.visible) {
      const swing = 1 - this.meleeTime / KATANA.rate;
      evaluateKatanaMotion(swing, _katanaPos, _katanaQuat);
      this.katana.position.copy(_katanaPos);
      this.katana.quaternion.copy(_katanaQuat);
    }
    this.flash.visible =
      !throwing &&
      !this.katana.visible &&
      this.recoil > (ads ? 0.012 : 0.045) &&
      this.cooldown >
        this.getWeapon().rate -
          Math.min(this.getWeapon().rate * 0.55, ads ? 0.038 : 0.055);
    this.flash.scale.setScalar(ads ? 0.45 : 1);
    this.animateBolt();
    this.flash.rotation.z = Math.random() * 6;
    this.flashLight.intensity = this.flash.visible ? (ads ? 1.8 : 8) : 0;
    if (s.mode !== 'paused') {
      for (let i = this.corpses.length - 1; i >= 0; i--) {
        const c = this.corpses[i];
        c.age += dt;
        c.enemy.root.rotation.x = -Math.min(1, c.age * 3) * 1.45;
        c.enemy.root.position.y = -Math.max(0, c.age - 0.65) * 1.8;
        if (c.age > 1.2) {
          this.scene.remove(c.enemy.root, c.enemy.shadow);
          this.corpses.splice(i, 1);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
          continue;
        }
        p.velocity.y -= dt * 7;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.scale.multiplyScalar(1 - dt * 1.5);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.uiTime += dt;
    if (this.uiTime > 0.06) {
      this.emit();
      this.uiTime = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  dispose() {
    this.clearEnemyProjectiles();
    this.hans?.dispose();
    this.clearGrenades();
    this.disposed = true;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    for (const off of this.events) off();
    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.renderer?.domElement
    )
      document.exitPointerLock();
    this.bgmStarted = false;
    this.pauseBgm();
    if (this.bgmAudio) {
      try {
        this.bgmAudio.currentTime = 0;
        this.bgmAudio.src = '';
        this.bgmAudio.load();
      } catch {
        // Safe swallow
      }
    }
    this.bgmSource?.disconnect();
    this.bgmGain?.disconnect();
    this.bgmAudio = null;
    this.bgmSource = null;
    this.bgmGain = null;
    void this.audio?.close();
    const geometry = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(this.materials);
    this.scene.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
      if (o instanceof T.Mesh || o instanceof T.Points) {
        if (
          o.geometry !== BOX &&
          o.geometry !== SPHERE &&
          !this.graphics.geometries.has(o.geometry)
        )
          geometry.add(o.geometry);
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((x) => {
          if (!this.graphics.materials.has(x)) materials.add(x);
        });
      }
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.graphics.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

import * as T from 'three';
import type { Enemy, Game } from './game.ts';

export const HANS = {
  kind: 7, wave: 7, hp: 15000, hpHard: 20000, speed: 6.0, energy: 100, energyDrain: 1,
  stunDuration: 4, vulnerability: 1.5,
  rifleDamage: 5, rifleSpeed: 80, rifleRange: 32, rifleCost: 18,
  clawDamage: 30, clawRange: 3.5, leapRange: 25, leapSpeed: 15, leapCost: 20, dashCost: 12,
  gasRadius: 4.2, gasDuration: 6, gasDamagePerSecond: 24, gasFuse: 1.4, gasCost: 22,
} as const;
export type HansAction = 'approach' | 'rifle-windup' | 'rifle' | 'gas-windup' |
  'dash-windup' | 'dash' | 'leap-windup' | 'leap' | 'recover' | 'stunned';
export type BossSnapshot = {
  name: string; health: number; maxHealth: number; energy: number;
  phase: number; action: HansAction;
};
type GasGrenade = { mesh: T.Group; velocity: T.Vector3; fuse: number; damage: number };
type GasCloud = { mesh: T.Group; life: number; damage: number };

/** One Hard finale encounter. Its clock only advances through the playing update. */
export class HansEncounter {
  game: Game;
  enemy: Enemy;
  action: HansAction = 'approach';
  energy: number = HANS.energy;
  timer = 1.5;
  sequence = 0;
  direction = new T.Vector3();
  aim = new T.Vector3();
  motionDuration = 0;
  shotTimer = 0;
  shots = 0;
  clawHit = false;
  flashes = [0, 0];
  grenades: GasGrenade[] = [];
  clouds: GasCloud[] = [];
  gasTick = 0;
  leapVelocity: number = HANS.leapSpeed;
  leapHeight = 1.1;
  private static readonly boxHit = new T.Vector3();
  private disposed = false;
  private grenadeModel: T.Group;
  private cloudModel: T.Group;
  private ownedMaterials: T.Material[] = [];
  maxHealth: number;
  private bulletMaterial: T.MeshBasicMaterial;

  constructor(game: Game, enemy: Enemy) {
    this.game = game; this.enemy = enemy;
    this.maxHealth = enemy.hp;
    const green = new T.MeshStandardMaterial({ color: 0x91ce36, emissive: 0x5ca814, emissiveIntensity: 1.3 });
    this.bulletMaterial = new T.MeshBasicMaterial({ color: 0xffdf99 });
    this.ownedMaterials.push(green, this.bulletMaterial);
    this.grenadeModel = new T.Group();
    const can = new T.Mesh(game.graphics.cylinder, green);
    can.scale.set(0.16, 0.3, 0.16); this.grenadeModel.add(can);
    const cap = new T.Mesh(game.graphics.box, game.graphics.enemyMaterials.surface('corroded-metal', 0x666e5d));
    cap.scale.set(0.12, 0.08, 0.12); cap.position.y = 0.17; this.grenadeModel.add(cap);
    this.cloudModel = game.graphics.createAreaEffect(HANS.gasRadius, 0x8ab83c, 0xc1ee54);
  }

  get phase() { return this.enemy.hp > this.maxHealth * 0.65 ? 1 : this.enemy.hp > this.maxHealth * 0.3 ? 2 : 3; }
  snapshot(): BossSnapshot {
    return { name: 'HANS VOLTER', health: Math.max(0, this.enemy.hp), maxHealth: this.maxHealth,
      energy: this.energy, phase: this.phase, action: this.action };
  }
  damageMultiplier() { return this.action === 'stunned' ? HANS.vulnerability : 1; }
  private setAction(action: HansAction, time: number) { this.action = action; this.timer = time; }
  private spend(energy: number) { this.energy = Math.max(0, this.energy - energy); }
  private recover() { this.enemy.root.position.y = 0; this.leapHeight = 1.1; this.setAction('recover', 0.9 - this.phase * 0.12); }
  private stun() {
    this.enemy.root.position.y = 0; this.leapHeight = 1.1; this.setAction('stunned', HANS.stunDuration);
    this.game.message('HANS: CHARGE DEPLETED — ATTACK NOW', HANS.stunDuration);
    this.game.sound(320, 0.7, 'sawtooth', 0.12, 40);
  }
  hasCoverBetween(from: T.Vector3, to: T.Vector3): boolean {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.001) return false;
    this.game.ray.set(from, dir.normalize());
    const wall = this.game.ray.intersectObjects(this.game.walls, false)[0];
    if (wall && wall.distance < dist) return true;
    for (const box of this.game.obstacles) {
      if (box.containsPoint(from)) return true;
      const hit = this.game.ray.ray.intersectBox(box, HansEncounter.boxHit);
      if (hit && from.distanceTo(hit) < dist - 0.05) return true;
    }
    return false;
  }
  canSeePlayer() {
    this.game.scene.updateMatrixWorld(true);
    const e = this.enemy;
    const origin = e.root.position.clone().add(new T.Vector3(0, 1.2 * e.root.scale.y, 0));
    const target = this.game.camera.position.clone().add(new T.Vector3(0, -0.65, 0));
    return !this.hasCoverBetween(origin, target);
  }
  chooseNextAction(distance: number) {
    this.aim.copy(this.game.camera.position);
    const next = this.sequence++ % 4;
    if (distance < 3 || (next === 3 && distance <= HANS.leapRange)) this.setAction('leap-windup', 0.7);
    else if (next === 0) this.setAction('rifle-windup', 0.85);
    else if (next === 1 && distance <= 26) this.setAction('gas-windup', 1);
    else this.setAction('dash-windup', 0.5);
    this.game.sound(170, 0.25, 'triangle', 0.07, 340);
  }
  startLeap() {
    const e = this.enemy, pos = e.root.position;
    this.spend(HANS.leapCost);
    this.clawHit = false;
    this.direction.copy(this.aim).sub(pos).setY(0);
    const lockedDist = this.direction.length();
    if (lockedDist > 0.001) {
      this.direction.normalize();
    } else {
      this.direction.set(0, 0, 1);
    }
    const currentDelta = this.game.camera.position.clone().sub(pos).setY(0);
    const distAlong = Math.max(0, currentDelta.dot(this.direction));
    const targetDist = Math.max(lockedDist, distAlong);
    const followThrough = T.MathUtils.lerp(1.2, 1.8, T.MathUtils.clamp((targetDist - 3) / 22, 0, 1));
    const leapDist = Math.min(29.0, Math.max(targetDist + followThrough, 3.8));
    if (leapDist <= 18.5) {
      this.motionDuration = T.MathUtils.clamp(leapDist / 22, 0.26, 0.68);
    } else {
      this.motionDuration = 0.68 + ((leapDist - 18.5) / (29.0 - 18.5)) * (0.88 - 0.68);
    }
    this.leapVelocity = leapDist / this.motionDuration;
    this.leapHeight = T.MathUtils.clamp(1.1 + ((leapDist - 3.8) / (29.0 - 3.8)) * 2.4, 1.1, 3.5);
    this.setAction('leap', this.motionDuration);
    e.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.game.meleeSound();
  }
  updateLeap(dt: number) {
    const pos = this.enemy.root.position;
    pos.y = Math.sin((1 - this.timer / this.motionDuration) * Math.PI) * this.leapHeight;
    const speed = this.leapVelocity || HANS.leapSpeed;
    const open = this.travel(speed, dt, true);
    if (!open || this.timer === 0) this.recover();
  }

  update(dt: number) {
    if (this.disposed || this.enemy.dead || this.game.state.mode !== 'playing') return;
    // Substeps keep dashes, windups, and burst cadence stable across frame rates.
    for (let left = dt; left > 0.000001 && this.game.state.mode === 'playing'; left -= Math.min(left, 0.05))
      this.step(Math.min(left, 0.05));
  }
  private step(dt: number) {
    const e = this.enemy, pos = e.root.position;
    const delta = this.game.camera.position.clone().sub(pos).setY(0);
    const distance = delta.length();
    this.timer = Math.max(0, this.timer - dt);
    this.flashes = this.flashes.map((time) => Math.max(0, time - dt));
    if (this.action === 'stunned') {
      if (this.timer === 0) { this.energy = HANS.energy; this.setAction('approach', 0.9); }
      this.pose(dt); return;
    }
    this.energy = Math.max(0, this.energy - HANS.energyDrain * dt);
    if (this.energy === 0 && (this.action === 'approach' || this.action === 'recover')) {
      this.stun(); this.pose(dt); return;
    }
    if (this.action !== 'leap' && this.action !== 'dash') {
      const aimDelta = this.action === 'leap-windup' ? this.aim.clone().sub(pos).setY(0) : delta;
      if (aimDelta.lengthSq() > 0.0001) e.root.rotation.y = Math.atan2(aimDelta.x, aimDelta.z);
    }
    if (this.action === 'approach') {
      if (distance > 4 || !this.canSeePlayer()) this.chase(dt);
      if (this.timer === 0 && distance <= HANS.rifleRange && this.canSeePlayer()) {
        this.chooseNextAction(distance);
      }
    } else if (this.action === 'rifle-windup') {
      this.aim.copy(this.game.camera.position);
      if (this.timer === 0) {
        this.spend(HANS.rifleCost); this.shots = 0; this.shotTimer = 0; this.setAction('rifle', 2.4);
      }
    } else if (this.action === 'rifle') {
      this.aim.copy(this.game.camera.position);
      this.shotTimer -= dt;
      if (this.shotTimer <= 0 && this.shots < 18 + (this.phase - 1) * 2) {
        this.pose(0); this.fireRifle(this.shots++ % 2);
        this.shotTimer += 0.14 - this.phase * 0.015;
      }
      if (this.timer === 0) this.recover();
    } else if (this.action === 'gas-windup' && this.timer === 0) {
      this.spend(HANS.gasCost); this.throwGas(); this.recover();
    } else if (this.action === 'dash-windup' && this.timer === 0) {
      this.spend(HANS.dashCost);
      this.direction.copy(this.aim).sub(pos).setY(0).normalize();
      if (distance < 10) {
        this.direction.set(this.direction.z, 0, -this.direction.x).multiplyScalar(this.sequence % 2 ? 1 : -1);
      }
      this.setAction('dash', 0.65);
    } else if (this.action === 'dash') {
      if (!this.travel(16.2 + this.phase * 1.8, dt) || this.timer === 0) this.recover();
    } else if (this.action === 'leap-windup' && this.timer === 0) {
      this.startLeap();
    } else if (this.action === 'leap') {
      this.updateLeap(dt);
    } else if (this.action === 'recover' && this.timer === 0) {
      this.setAction('approach', 0.3);
    }
    this.pose(dt);
  }

  private chase(dt: number) {
    const g = this.game, pos = this.enemy.root.position;
    const dir = g.camera.position.clone().sub(pos).setY(0).normalize();
    let clear = true;
    const distance = Math.hypot(g.camera.position.x - pos.x, g.camera.position.z - pos.z);
    for (let s = 0.4; s < distance; s += 0.5)
      if (g.blocked(pos.x + dir.x * s, pos.z + dir.z * s, 0.5)) { clear = false; break; }
    if (!clear) {
      const gx = Math.round(pos.x) + 30, gz = Math.round(pos.z) + 30;
      let best = Infinity;
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        if (!x && !z) continue;
        const nx = gx + x, nz = gz + z;
        if (nx < 0 || nz < 0 || nx > 60 || nz > 60) continue;
        const value = g.nav[nz * 61 + nx];
        if (value >= 0 && value < best && !g.blocked(nx - 30, pos.z, 0.5) && !g.blocked(pos.x, nz - 30, 0.5)) {
          best = value; dir.set(nx - 30 - pos.x, 0, nz - 30 - pos.z).normalize();
        }
      }
    }
    g.move(pos, dir.x * (HANS.speed + this.phase * 0.24) * dt, dir.z * (HANS.speed + this.phase * 0.24) * dt, 0.5);
  }
  private travel(speed: number, dt: number, slash = false) {
    const g = this.game, e = this.enemy, pos = e.root.position;
    const steps = Math.max(1, Math.ceil(speed * dt / 0.15));
    for (let i = 0; i <= steps; i++) {
      if (slash && !this.clawHit) {
        const distXZ = Math.hypot(pos.x - g.camera.position.x, pos.z - g.camera.position.z);
        const distY = Math.abs((g.feet || 0) - pos.y);
        const maxDistY = Math.max(2.2, this.leapHeight * 0.85);
        if (distXZ <= HANS.clawRange && distY < maxDistY && this.canSeePlayer()) {
          this.clawHit = true;
          g.damagePlayer(HANS.clawDamage + (this.phase - 1) * 4);
          if (g.state.mode !== 'playing') return false;
        }
      }
      if (i === steps) break;
      const x = pos.x + this.direction.x * speed * dt / steps, z = pos.z + this.direction.z * speed * dt / steps;
      if (g.blocked(x, z, 0.5)) return false;
      pos.x = x; pos.z = z;
    }
    return true;
  }
  private fireRifle(hand: number) {
    const g = this.game;
    if (this.enemy.dead || g.enemyProjectiles.length >= 64) return;
    this.enemy.root.updateMatrixWorld(true);
    const muzzle = this.enemy.hans!.muzzles[hand].getWorldPosition(new T.Vector3());
    const chest = this.enemy.root.position.clone().add(new T.Vector3(0, 1.4, 0));
    const toMuzzle = muzzle.clone().sub(chest);
    const reach = toMuzzle.length();
    const spawnPos = muzzle.clone();
    g.ray.set(chest, toMuzzle.clone().normalize());
    const wall = g.ray.intersectObjects(g.walls, false)[0];
    if (wall && wall.distance < reach) {
      spawnPos.copy(chest).addScaledVector(g.ray.ray.direction, Math.max(0, wall.distance - 0.05));
    } else {
      for (const box of g.obstacles) {
        if (box.containsPoint(spawnPos)) {
          const dirFromChest = spawnPos.clone().sub(chest).normalize();
          g.ray.set(chest, dirFromChest);
          const boxHit = g.ray.ray.intersectBox(box, new T.Vector3());
          if (boxHit) {
            spawnPos.copy(boxHit).addScaledVector(dirFromChest, -0.05);
          } else {
            spawnPos.copy(chest);
          }
          break;
        }
      }
    }
    const dir = this.aim.clone().sub(spawnPos).normalize();
    dir.x += (Math.random() - 0.5) * 0.04; dir.y += (Math.random() - 0.5) * 0.025; dir.normalize();
    const mesh = new T.Mesh(g.graphics.sphere, this.bulletMaterial);
    mesh.position.copy(spawnPos); mesh.scale.set(0.035, 0.035, 0.6); mesh.lookAt(spawnPos.clone().add(dir));
    g.scene.add(mesh);
    g.enemyProjectiles.push({ mesh, velocity: dir.multiplyScalar(HANS.rifleSpeed), life: 0.65, damage: HANS.rifleDamage, kind: 'rifle' });
    this.flashes[hand] = 0.07;
    g.sound(110 + hand * 18, 0.06, 'sawtooth', 0.07, 45);
  }
  private throwGas() {
    const g = this.game, e = this.enemy;
    e.root.updateMatrixWorld(true);
    const origin = e.elbows[0].localToWorld(new T.Vector3(0, -0.4, 0));
    const count = this.phase === 3 ? 3 : 2;
    for (let i = 0; i < count && this.grenades.length < 6; i++) {
      const target = this.aim.clone().setY(0.18);
      const side = new T.Vector3(target.z - origin.z, 0, origin.x - target.x).normalize();
      target.addScaledVector(side, (i - (count - 1) / 2) * 3.6);
      const flight = 1.1;
      const velocity = target.clone().sub(origin).multiplyScalar(1 / flight);
      velocity.y += 0.5 * 12 * flight;
      const mesh = this.grenadeModel.clone(true); mesh.position.copy(origin); g.scene.add(mesh);
      this.grenades.push({ mesh, velocity, fuse: HANS.gasFuse, damage: HANS.gasDamagePerSecond + (this.phase - 1) * 6 });
    }
    g.sound(280, 0.2, 'triangle', 0.09, 70);
  }

  updateHazards(dt: number) {
    const g = this.game;
    if (this.disposed || g.state.mode !== 'playing' || (!this.grenades.length && !this.clouds.length)) return;
    g.scene.updateMatrixWorld(true);
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const p = this.grenades[i];
      const steps = Math.max(1, Math.ceil(p.velocity.length() * dt / 0.15));
      for (let j = 0; j < steps; j++) {
        const step = dt / steps;
        p.velocity.y -= 12 * step;
        const direction = p.velocity.clone().normalize(), distance = p.velocity.length() * step;
        g.ray.set(p.mesh.position, direction);
        const wall = g.ray.intersectObjects(g.walls, false)[0];
        if (wall?.face && wall.distance <= distance + 0.1) {
          p.mesh.position.addScaledVector(direction, Math.max(0, wall.distance - 0.11));
          const normal = wall.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(wall.object.matrixWorld)).normalize();
          p.velocity.reflect(normal).multiplyScalar(0.35);
        } else p.mesh.position.addScaledVector(p.velocity, step);
        if (p.mesh.position.y < 0.16) {
          p.mesh.position.y = 0.16; p.velocity.y = Math.abs(p.velocity.y) * 0.25;
          p.velocity.x *= Math.exp(-5 * step); p.velocity.z *= Math.exp(-5 * step);
        }
      }
      p.mesh.rotation.z += dt * 5; p.fuse -= dt;
      if (p.fuse <= 0) {
        g.scene.remove(p.mesh); this.grenades.splice(i, 1);
        if (this.clouds.length >= 9) g.scene.remove(this.clouds.shift()!.mesh);
        const mesh = this.cloudModel.clone(true); mesh.position.copy(p.mesh.position).setY(0);
        g.scene.add(mesh); this.clouds.push({ mesh, life: HANS.gasDuration, damage: p.damage });
        g.sound(200, 0.35, 'sawtooth', 0.045, 60);
      }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i]; cloud.life -= dt;
      g.graphics.updateAreaEffect(cloud.mesh, cloud.life);
      if (cloud.life <= 0) { g.scene.remove(cloud.mesh); this.clouds.splice(i, 1); }
    }
    this.gasTick += dt;
    if (this.gasTick >= 0.25) {
      const ticks = Math.floor(this.gasTick / 0.25); this.gasTick %= 0.25;
      let damage = 0;
      for (const cloud of this.clouds) {
        const p = cloud.mesh.position;
        if (Math.hypot(p.x - g.camera.position.x, p.z - g.camera.position.z) > HANS.gasRadius || g.camera.position.y > 3.4) continue;
        const source = p.clone().setY(0.8), target = g.camera.position.clone().add(new T.Vector3(0, -0.7, 0));
        g.ray.set(source, target.clone().sub(source).normalize());
        const wall = g.ray.intersectObjects(g.walls, false)[0];
        if (!wall || wall.distance >= source.distanceTo(target)) damage = Math.max(damage, cloud.damage);
      }
      if (damage > 0) g.damagePlayer(damage * ticks * 0.25);
    }
  }
  private pose(dt: number) {
    const e = this.enemy, rig = e.hans!;
    const firing = this.action === 'rifle' || this.action === 'rifle-windup';
    const stunned = this.action === 'stunned', leap = this.action === 'leap';
    const moving = this.action === 'approach' || this.action === 'dash';
    if (!stunned) e.phase += dt * (this.action === 'dash' ? 25 : 8);
    e.torso.rotation.set(stunned ? 0.6 : this.action === 'leap-windup' ? 0.32 : leap ? 0.16 : 0.03, 0, 0);
    e.neck.rotation.x = stunned ? 0.4 : -e.torso.rotation.x * 0.6;
    rig.reactor.scale.setScalar(stunned ? 0.7 : 0.9 + this.energy / 100 * 0.1 + Math.sin(e.phase * 3) * 0.025);
    for (let i = 0; i < 2; i++) {
      const gait = Math.sin(e.phase + i * Math.PI), side = i === 0 ? -1 : 1;
      e.arms[i].rotation.set(stunned ? 0.2 : firing ? -1.35 - this.flashes[i] : leap ? -1.6 + (1 - this.timer / this.motionDuration) * 1.3 :
        this.action === 'leap-windup' ? -1.9 : this.action === 'gas-windup' ? -2.3 : -0.1 + gait * 0.35, 0, leap ? side * 0.6 : side * 0.07);
      e.elbows[i].rotation.x = firing ? -0.25 : stunned ? -0.1 : -0.3;
      e.legs[i].rotation.x = moving ? gait * 0.45 : leap ? -0.5 : 0;
      e.knees[i].rotation.x = moving ? Math.max(0, -gait) * 0.7 : leap ? 1 : stunned ? 0.25 : 0;
      rig.rifles[i].visible = firing; rig.holsters[i].visible = !firing;
      rig.rifles[i].rotation.x = Math.PI / 2;
      rig.flashes[i].visible = this.flashes[i] > 0 && this.action === 'rifle';
    }
    e.shadow.position.set(e.root.position.x, 0.025, e.root.position.z);
  }
  clearHazards() {
    for (const p of this.grenades) this.game.scene.remove(p.mesh);
    for (const p of this.clouds) this.game.scene.remove(p.mesh);
    this.grenades = []; this.clouds = []; this.gasTick = 0;
    this.enemy.hans?.flashes.forEach((flash) => { flash.visible = false; });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clearHazards();
    this.ownedMaterials.forEach((material) => material.dispose());
  }
}

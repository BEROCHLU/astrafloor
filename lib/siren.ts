import * as T from 'three';
import type { Enemy, Game } from './game.ts';

export const SIREN = {
  kind: 8, hp: 150, speed: 1.15, reward: 120,
  radius: 8.4, windup: 0.8, duration: 1.5, cooldown: 3, tick: 0.25,
  damagePerSecond: { normal: 12, hard: 16 },
  counts: { normal: [2, 3, 4], hard: [2, 4, 4] },
} as const;

/** Rotate replacement across Bloat (4) -> Husk (6) -> Scrake (2) -> Other (Clot/Gorefast/Crawler), protecting Freshpound (3). */
export function replaceSirenSlots(base: readonly number[], wave: number, difficulty: 'normal' | 'hard'): number[] {
  const roster = [...base];
  if (wave < 4 || wave > 6) return roster;
  const count = SIREN.counts[difficulty][wave - 4];
  if (count <= 0) return roster;

  const isOther = (k: number) => k === 0 || k === 1 || k === 5;
  const categories = [4, 6, 2, 'other'] as const;

  const findCandidate = (pred: (k: number, i: number) => boolean) => roster.findIndex(pred);

  for (let step = 0; step < count; step++) {
    const target = categories[step % categories.length];
    let idx = -1;

    if (target === 'other') {
      idx = findCandidate((k, i) => i !== 2 && isOther(k));
      if (idx === -1) idx = findCandidate((k) => isOther(k));
    } else {
      idx = findCandidate((k) => k === target);
    }

    // Fallback: if targeted slot is unavailable, replace an Other slot (protecting Freshpound 3)
    if (idx === -1) {
      idx = findCandidate((k, i) => i !== 2 && isOther(k));
      if (idx === -1) idx = findCandidate((k) => isOther(k));
    }
    // Last-resort fallback: any non-Freshpound and non-Siren slot
    if (idx === -1) {
      idx = findCandidate((k) => k !== 3 && k !== SIREN.kind);
    }

    if (idx !== -1) {
      roster[idx] = SIREN.kind;
    }
  }

  return roster;
}

export class SirenAttack {
  game: Game;
  enemy: Enemy;
  action: 'approach' | 'windup' | 'screaming' | 'cooldown' = 'approach';
  timer = 0;
  private tickTime = 0;
  private pendingDamage = 0;
  private stopVoice?: () => void;
  readonly effect: T.Group;
  private origin = new T.Vector3();
  private target = new T.Vector3();
  private hit = new T.Vector3();

  constructor(game: Game, enemy: Enemy) {
    this.game = game; this.enemy = enemy;
    this.effect = game.graphics.createAreaEffect(SIREN.radius, 0xff3030, 0xff6060);
    this.effect.name = 'siren-scream';
  }

  private canHit(distance: number) {
    const g = this.game, e = this.enemy;
    if (distance > SIREN.radius || g.camera.position.y > 3.4) return false;
    this.origin.copy(e.root.position).setY(1.2);
    this.target.copy(g.camera.position); this.target.y -= 0.65;
    const length = this.origin.distanceTo(this.target);
    if (length < 0.001) return true;
    g.ray.set(this.origin, this.hit.copy(this.target).sub(this.origin).normalize());
    const wall = g.ray.intersectObjects(g.walls, false)[0];
    if (wall && wall.distance < length) return false;
    for (const box of g.obstacles) {
      if (box.containsPoint(this.origin)) return false;
      if (g.ray.ray.intersectBox(box, this.hit) && this.origin.distanceTo(this.hit) < length) return false;
    }
    return true;
  }

  /** Returns whether navigation should hold position for this frame. */
  update(dt: number, distance: number): boolean {
    const g = this.game, e = this.enemy;
    if (e.dead) { this.cancel(); return true; }
    if (g.state.mode !== 'playing') { this.silence(); return true; }
    const inRange = this.canHit(distance);
    let remaining = Math.max(0, dt);
    let holding = inRange || this.action === 'windup' || this.action === 'screaming';
    while (remaining > 1e-9) {
      if (this.action === 'approach') {
        if (!inRange) break;
        this.action = 'windup'; this.timer = SIREN.windup; holding = true;
      }
      if (this.action === 'screaming') {
        this.stopVoice ??= g.sirenScreamSound(this.timer);
        const step = Math.min(remaining, this.timer, SIREN.tick - this.tickTime);
        if (inRange) this.pendingDamage += e.damage * step;
        this.tickTime += step; this.timer -= step; remaining -= step;
        if (this.tickTime >= SIREN.tick - 1e-9 || this.timer <= 1e-9) {
          const damage = this.pendingDamage;
          this.pendingDamage = 0; this.tickTime = 0;
          if (damage > 0) g.damagePlayer(damage, true);
          if (e.dead || g.state.mode !== 'playing') { this.cancel(); return true; }
        }
        if (this.timer <= 1e-9) {
          this.endScream(); this.action = 'cooldown'; this.timer = SIREN.cooldown;
        }
      } else {
        const step = Math.min(remaining, this.timer);
        this.timer -= step; remaining -= step;
        if (this.timer <= 1e-9) {
          if (this.action === 'windup') {
            this.action = 'screaming'; this.timer = SIREN.duration;
            this.effect.position.copy(e.root.position).setY(0);
            g.scene.add(this.effect);
            this.stopVoice = g.sirenScreamSound(this.timer);
          } else this.action = 'approach';
        }
      }
    }
    if (this.action === 'screaming') {
      this.effect.position.copy(e.root.position).setY(0);
      g.graphics.updateAreaEffect(this.effect, this.timer);
    }
    return holding;
  }

  pose(holding: boolean) {
    const e = this.enemy;
    const windup = this.action === 'windup' ? 1 - this.timer / SIREN.windup : 0;
    const screaming = this.action === 'screaming';
    e.torso.rotation.x = screaming ? -0.10 : -0.07 * windup + 0.04;
    e.neck.rotation.x = screaming ? -0.28 : -0.22 * windup;
    e.neck.rotation.z = Math.sin(e.phase * (screaming ? 7 : 0.45)) * (screaming ? 0.025 : 0.07);
    if (e.sirenJaw) e.sirenJaw.rotation.x = screaming ? 0.65 : 0.10 + windup * 0.45;
    if (e.sirenThroat) {
      e.sirenThroat.visible = screaming || windup > 0.3;
      e.sirenThroat.scale.setScalar(screaming ? 1 + Math.sin(e.phase * 12) * 0.14 : 0.4 + windup * 0.6);
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      e.arms[i].rotation.set(screaming ? -0.24 : -0.10, 0, side * (screaming ? 0.29 : 0.18));
      e.elbows[i].rotation.x = screaming ? -1.38 : -1.17;
      if (holding) { e.legs[i].rotation.x = 0; e.knees[i].rotation.x = 0; }
    }
  }

  silence() { this.stopVoice?.(); this.stopVoice = undefined; }
  private endScream() {
    this.effect.removeFromParent(); this.silence();
    if (this.enemy.sirenThroat) this.enemy.sirenThroat.visible = false;
  }
  cancel() {
    this.endScream(); this.tickTime = 0; this.pendingDamage = 0;
    this.action = 'cooldown'; this.timer = SIREN.cooldown;
    if (this.enemy.sirenJaw) this.enemy.sirenJaw.rotation.x = 0.1;
  }
}

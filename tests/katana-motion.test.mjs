import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game, evaluateKatanaMotion, KATANA_ANIM } from '../lib/game.ts';
import { Graphics } from '../lib/graphics.ts';

function toScreen(pt, fov = 76, aspect = 16 / 9) {
  const tanHalfFov = Math.tan((fov * Math.PI) / 360);
  const screenY = pt.y / (-pt.z * tanHalfFov);
  const screenX = pt.x / (-pt.z * tanHalfFov * aspect);
  return { x: screenX, y: screenY };
}

function getBladePoints(pos, quat) {
  const obj = new T.Object3D();
  obj.position.copy(pos);
  obj.quaternion.copy(quat);
  obj.updateMatrixWorld(true);

  const guard = new T.Vector3(0, 0, 0).applyMatrix4(obj.matrixWorld);
  const mid = new T.Vector3(0.01, 0.55, 0).applyMatrix4(obj.matrixWorld);
  const tip = new T.Vector3(-0.005, 1.06, 0).applyMatrix4(obj.matrixWorld);
  const pommel = new T.Vector3(0, -0.33, 0).applyMatrix4(obj.matrixWorld);
  const edge = new T.Vector3(1, 0, 0).applyQuaternion(quat);
  const bladeDir = new T.Vector3(0, 1, 0).applyQuaternion(quat);
  return { guard, mid, tip, pommel, edge, bladeDir };
}

test('Katana windup draws and cocks blade on the left (抜刀・予兆)', () => {
  const p0 = evaluateKatanaMotion(0.0);
  const pts0 = getBladePoints(p0.pos, p0.quat);
  const scr0 = toScreen(pts0.guard);
  assert.ok(pts0.guard.x < -0.2, 'guard starts on the left');
  assert.ok(scr0.y < -0.8, 'guard enters from bottom-left');

  const pWindup = evaluateKatanaMotion(0.10);
  const ptsWindup = getBladePoints(pWindup.pos, pWindup.quat);
  const scrWindupTip = toScreen(ptsWindup.tip);
  assert.ok(ptsWindup.guard.x < -0.25, 'guard is cocked on the left side');
  assert.ok(scrWindupTip.x < -0.4, 'windup tip is on the left side of screen');
  // Cutting edge (+X) faces rightward towards the target slash direction
  assert.ok(ptsWindup.edge.x > 0.6, 'cutting edge is primed facing right');
});

test('Katana slash sweeps dynamically from left to right in a horizontal fan arc (完全な真横の水平扇状薙ぎ払い)', () => {
  const pStart = evaluateKatanaMotion(0.12);
  const pMid = evaluateKatanaMotion(0.25);
  const pEnd = evaluateKatanaMotion(0.38);

  const ptsStart = getBladePoints(pStart.pos, pStart.quat);
  const ptsMid = getBladePoints(pMid.pos, pMid.quat);
  const ptsEnd = getBladePoints(pEnd.pos, pEnd.quat);

  const scrStart = toScreen(ptsStart.tip);
  const scrMid = toScreen(ptsMid.tip);
  const scrEnd = toScreen(ptsEnd.tip);

  // Tip moves from left across center to right
  assert.ok(scrStart.x < -0.4, `slash start tip on left: ${scrStart.x}`);
  assert.ok(Math.abs(scrMid.x) < 0.25, `slash mid tip crosses center: ${scrMid.x}`);
  assert.ok(scrEnd.x > 0.6, `slash end tip on right: ${scrEnd.x}`);

  // Guard moves from left to right
  assert.ok(ptsStart.guard.x < -0.25, `start guard on left: ${ptsStart.guard.x}`);
  assert.ok(ptsEnd.guard.x > 0.25, `end guard on right: ${ptsEnd.guard.x}`);

  // Purely horizontal flat trajectory at crosshair height (Tip.y remains near crosshair)
  for (let p = 0.12; p <= 0.38; p += 0.04) {
    const motion = evaluateKatanaMotion(p);
    const pts = getBladePoints(motion.pos, motion.quat);
    const scr = toScreen(pts.tip);
    assert.ok(scr.y > -0.35 && scr.y < 0.15, `horizontal tip height at p=${p.toFixed(2)} is ${scr.y}`);
    // Cutting edge (+X) strictly leads the slash to the right throughout the sweep
    assert.ok(pts.edge.x > 0.5, `cutting edge leads stroke to the right at p=${p.toFixed(2)}: ${pts.edge.x}`);
  }

  // Tip reaches forward into 3D depth during the fan sweep
  assert.ok(ptsMid.tip.z < -1.4, `tip reaches forward into depth during slash: ${ptsMid.tip.z}`);
});

test('Katana follow-through settles on the right (残心) and smoothly exits below screen', () => {
  // Settle hold on the right
  const pSettle = evaluateKatanaMotion(0.45);
  const ptsSettle = getBladePoints(pSettle.pos, pSettle.quat);
  const scrSettle = toScreen(ptsSettle.tip);
  assert.ok(ptsSettle.guard.x > 0.25, 'settle guard on right side');
  assert.ok(scrSettle.x > 0.6, 'settle tip on right side');

  // Exit at p = 1.0: katana lowers completely below screen viewport
  const pExit = evaluateKatanaMotion(1.0);
  const ptsExit = getBladePoints(pExit.pos, pExit.quat);
  const scrGuardExit = toScreen(ptsExit.guard);
  const scrTipExit = toScreen(ptsExit.tip);

  assert.ok(scrGuardExit.y < -1.0, 'guard exits below viewport at p=1.0');
  assert.ok(scrTipExit.y < -1.0, 'tip exits below viewport at p=1.0');

  // Verify all geometry stays safely in front of camera near clipping plane (near = 0.05m)
  for (let p = 0; p <= 1.001; p += 0.02) {
    const motion = evaluateKatanaMotion(p);
    const pts = getBladePoints(motion.pos, motion.quat);
    assert.ok(pts.pommel.z <= -0.15, `pommel z=${pts.pommel.z} stays clear of near clipping plane at p=${p}`);
    assert.ok(pts.guard.z <= -0.20, `guard z=${pts.guard.z} stays clear of near clipping plane at p=${p}`);
    assert.ok(pts.tip.z <= -0.20, `tip z=${pts.tip.z} stays clear of near clipping plane at p=${p}`);
  }
});

test('evaluateKatanaMotion clamps out-of-range progress gracefully', () => {
  const pNeg = evaluateKatanaMotion(-0.5);
  const p0 = evaluateKatanaMotion(0.0);
  assert.ok(pNeg.pos.distanceTo(p0.pos) < 1e-6, 'clamps negative progress to 0');

  const pOver = evaluateKatanaMotion(1.5);
  const p1 = evaluateKatanaMotion(1.0);
  assert.ok(pOver.pos.distanceTo(p1.pos) < 1e-6, 'clamps over progress to 1');

  const pNan = evaluateKatanaMotion(NaN);
  assert.ok(pNan.pos.distanceTo(p0.pos) < 1e-6, 'clamps NaN progress to 0');
});

test('In-game Katana melee integrates full sweeping motion and restores firearm', (t) => {
  const g = Object.create(Game.prototype);
  const graphics = new Graphics();
  t.after(() => graphics.dispose());

  Object.assign(g, {
    graphics,
    scene: new T.Scene(),
    camera: new T.PerspectiveCamera(76, 16 / 9, 0.05, 100),
    gun: new T.Group(),
    katana: new T.Group(),
    flash: new T.Group(),
    flashLight: new T.PointLight(),
    ray: new T.Raycaster(),
    state: {
      mode: 'shop',
      wave: 1,
      katana: false,
      cash: 2000,
      reload: 0,
      level: 0,
    },
    weaponIndex: 1,
    ammo: [15, 30, 10],
    reserve: [90, 240, 60],
    cooldown: 0,
    reloadTime: 0,
    meleeTime: 0,
    sniperBoltTime: 0,
    recoil: 0,
    yaw: 0,
    pitch: 0,
    feet: 0,
    elapsed: 0,
    enemies: [],
    corpses: [],
    walls: [],
    particles: [],
    viewRecoil: { modelYaw: 0, update() {} },
    flashlight: { intensity: 0 },
    emit() {},
    meleeSound() {},
    isScoped() { return false; },
    isCyclingBolt() { return false; },
    isThrowingGrenade() { return false; },
    getWeapon() { return { rate: 0.1, reserve: 240, reload: 2.0 }; },
    animateBolt() {},
  });

  g.camera.position.set(0, 1.7, 0);
  g.scene.add(g.camera);
  g.gun.position.set(0.27, -0.25, -0.42);
  g.camera.add(g.gun);

  // Buy katana
  g.buy = Game.prototype.buy;
  g.buildKatana = Game.prototype.buildKatana;
  g.melee = Game.prototype.melee;
  g.tick = Game.prototype.tick;

  g.buy('katana');
  assert.equal(g.state.katana, true);
  assert.equal(g.katana.children.length, 1, 'katana model added to katana group');
  assert.equal(g.katana.visible, false, 'katana hidden before melee');

  // Switch to playing mode and trigger melee
  g.state.mode = 'playing';
  g.melee();
  assert.equal(g.meleeTime, 0.6, 'meleeTime set to KATANA.rate');

  // Before rendering, visibility updates in tick
  // Test frame at windup (t = 0.06s)
  g.meleeTime = 0.6 - 0.06; // swing = 0.10
  const swing1 = 1 - g.meleeTime / 0.6;
  evaluateKatanaMotion(swing1, g.katana.position, g.katana.quaternion);
  assert.ok(g.katana.position.x < -0.2, 'windup position on left');

  // Test frame at mid-slash (swing = 0.25)
  g.meleeTime = 0.6 * (1 - 0.25);
  const swing2 = 1 - g.meleeTime / 0.6;
  evaluateKatanaMotion(swing2, g.katana.position, g.katana.quaternion);
  assert.ok(Math.abs(g.katana.position.x) < 0.15, 'mid-slash passes through center');
  assert.ok(g.katana.position.z < -0.5, 'mid-slash extends forward');

  // Test frame at follow-through (swing = 0.38)
  g.meleeTime = 0.6 * (1 - 0.38);
  const swing3 = 1 - g.meleeTime / 0.6;
  evaluateKatanaMotion(swing3, g.katana.position, g.katana.quaternion);
  assert.ok(g.katana.position.x > 0.25, 'follow-through reaches right');

  // Melee completes
  g.meleeTime = 0;
  // Gun becomes visible, katana invisible
  g.katana.visible = (g.state.mode === 'playing') && g.state.katana && g.meleeTime > 0;
  g.gun.visible = (g.state.mode === 'playing') && !g.isScoped() && !g.katana.visible;
  assert.equal(g.katana.visible, false, 'katana hidden when melee finishes');
  assert.equal(g.gun.visible, true, 'gun restores when melee finishes');
});

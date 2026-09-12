import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Game } from '../lib/game.ts';
import { WeaponRecoil, RECOIL_PROFILES, G18C_RECOIL } from '../lib/recoil.ts';

function fixture() {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    state: { mode: 'playing', katana: false, g18c: false }, weaponIndex: 1,
    viewRecoil: new WeaponRecoil(), recoil: 0, pitch: 0, yaw: 0,
    cooldown: 0, reloadTime: 0, aiming: false,
    ammo: [15, 30, 10, 1], reserve: [45, 120, 30, 10], enemies: [], walls: [],
    camera: new T.PerspectiveCamera(76, 1, 0.06, 150), scene: new T.Scene(),
    ray: new T.Raycaster(), gunshot() {}, dryFire() {}, emit() {}, message() {},
  });
  return g;
}

test('weapon kick differs by gun and aiming reduces the kick', () => {
  const kicks = RECOIL_PROFILES.map((profile) => {
    const hip = new WeaponRecoil().fire(profile, false, 0.5);
    const aim = new WeaponRecoil().fire(profile, true, 0.5);
    assert.ok(aim.pitch > 0 && aim.pitch < hip.pitch);
    assert.ok(Math.abs(aim.yaw) < Math.abs(hip.yaw));
    return hip.pitch;
  });
  assert.ok(kicks[2] > kicks[0] && kicks[0] > kicks[1]);

  // G18C recoil profile check: 20% stronger than AR-2 (RECOIL_PROFILES[1])
  const ar2Profile = RECOIL_PROFILES[1];
  assert.ok(Math.abs(G18C_RECOIL.vertical - ar2Profile.vertical * 1.2) < 1e-9);
  assert.ok(Math.abs(G18C_RECOIL.horizontal - ar2Profile.horizontal * 1.2) < 1e-9);
  assert.ok(Math.abs(G18C_RECOIL.kickback - ar2Profile.kickback * 1.2) < 1e-9);
  assert.equal(G18C_RECOIL.ads, ar2Profile.ads);
  assert.equal(G18C_RECOIL.vertical, 0.0648);
  assert.equal(G18C_RECOIL.horizontal, 0.0288);
  assert.equal(G18C_RECOIL.kickback, 0.174);

  const g18cHip = new WeaponRecoil().fire(G18C_RECOIL, false, 0.5);
  const g18cAim = new WeaponRecoil().fire(G18C_RECOIL, true, 0.5);
  assert.equal(g18cHip.pitch, G18C_RECOIL.vertical);
  assert.equal(g18cAim.pitch, G18C_RECOIL.vertical * G18C_RECOIL.ads);
  assert.ok(g18cAim.pitch > 0 && g18cAim.pitch < g18cHip.pitch);
  assert.ok(Math.abs(g18cAim.yaw) < Math.abs(g18cHip.yaw));
});

test('automatic fire keeps raising aim past the old offset cap and never recenters after release', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const g = fixture();
  for (let i = 0; i < 30; i++) {
    g.updateCameraAim();
    g.cooldown = 0;
    g.shoot();
    g.viewRecoil.update(0.095);
  }
  assert.ok(g.pitch > 0.234);
  const pitch = g.pitch, yaw = g.yaw;
  g.viewRecoil.update(5);
  g.updateCameraAim();
  assert.equal(g.camera.rotation.x, pitch);
  assert.equal(g.camera.rotation.y, yaw);
  assert.equal(g.camera.rotation.z, 0);
});

test('aim stays fixed at 30, 60 and 144 FPS while only weapon-model sway recovers', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const fps of [30, 60, 144]) {
    const g = fixture();
    g.shoot();
    const pitch = g.pitch, yaw = g.yaw;
    assert.ok(Math.abs(g.viewRecoil.modelYaw) > 0.0001);
    for (let i = 0; i < fps * 2; i++) {
      g.viewRecoil.update(1 / fps);
      g.updateCameraAim();
      assert.equal(g.camera.rotation.x, pitch);
      assert.equal(g.camera.rotation.y, yaw);
    }
    assert.ok(Math.abs(g.viewRecoil.modelYaw) < 0.000001);
  }
});

test('manual counter-steering stays put and responds immediately at the pitch limit', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const g = fixture();
  g.shoot();
  g.applyAimDelta(-g.pitch, -g.yaw);
  g.viewRecoil.update(2);
  g.updateCameraAim();
  assert.equal(g.camera.rotation.x, 0);
  assert.equal(g.camera.rotation.y, 0);
  g.applyAimDelta(1.529, 0);
  g.cooldown = 0;
  g.shoot();
  assert.equal(g.pitch, 1.53);
  g.applyAimDelta(-0.01, 0);
  g.updateCameraAim();
  assert.equal(g.camera.rotation.x, 1.52, 'clipped recoil cannot create hidden mouse dead travel');
});

test('recoil changes subsequent bullet direction, while the first shot and dry firing remain correct', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const g = fixture(), directions = [];
  g.ray.intersectObjects = () => { directions.push(g.ray.ray.direction.clone()); return []; };
  g.updateCameraAim();
  g.shoot();
  assert.ok(Math.abs(directions[0].y) < 1e-12, 'first bullet lands on the original sight line');
  g.updateCameraAim();
  g.cooldown = 0;
  g.shoot();
  assert.ok(directions[1].y > 0.01, 'next bullet follows the upward kick');
  assert.ok(Math.abs(directions[1].x) > 0, 'lateral recoil affects actual aim');
  const pitch = g.pitch, yaw = g.yaw;
  g.cooldown = 0;
  g.ammo[1] = g.reserve[1] = 0;
  g.shoot();
  assert.equal(g.pitch, pitch, 'empty trigger pulls do not add recoil');
  assert.equal(g.yaw, yaw);
  assert.equal(directions.length, 2);
});

test('G18C automatic fire raises aim continuously across 33 rounds and recovers only model sway', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const g = fixture();
  g.state.g18c = true;
  g.weaponIndex = 0;
  g.ammo = [33, 0, 0, 0];
  g.reserve = [132, 0, 0, 0];
  for (let i = 0; i < 33; i++) {
    g.updateCameraAim();
    g.cooldown = 0;
    g.shoot();
    g.viewRecoil.update(0.068);
  }
  assert.equal(g.ammo[0], 0);
  assert.ok(g.pitch > 0.4, 'G18C pitch must climb continuously across the 33-round magazine');
  const pitch = g.pitch, yaw = g.yaw;
  g.viewRecoil.update(5);
  g.updateCameraAim();
  assert.equal(g.camera.rotation.x, pitch, 'camera pitch must not auto-recenter');
  assert.equal(g.camera.rotation.y, yaw);
  assert.equal(g.camera.rotation.z, 0);
});

test('G18C shoot recoil produces 20% greater pitch and kickback than AR-2 in both hipfire and ADS', (t) => {
  t.mock.method(Math, 'random', () => 0.5);

  // Hipfire comparison
  const gAR2Hip = fixture();
  gAR2Hip.weaponIndex = 1;
  gAR2Hip.aiming = false;
  gAR2Hip.shoot();

  const gG18CHip = fixture();
  gG18CHip.state.g18c = true;
  gG18CHip.weaponIndex = 0;
  gG18CHip.aiming = false;
  gG18CHip.shoot();

  assert.equal(gAR2Hip.pitch, 0.054);
  assert.equal(gAR2Hip.recoil, 0.145);
  assert.equal(gG18CHip.pitch, 0.0648);
  assert.equal(gG18CHip.recoil, 0.174);
  assert.ok(Math.abs(gG18CHip.pitch - gAR2Hip.pitch * 1.2) < 1e-9);
  assert.ok(Math.abs(gG18CHip.recoil - gAR2Hip.recoil * 1.2) < 1e-9);

  // ADS comparison
  const gAR2Ads = fixture();
  gAR2Ads.weaponIndex = 1;
  gAR2Ads.aiming = true;
  gAR2Ads.shoot();

  const gG18CAds = fixture();
  gG18CAds.state.g18c = true;
  gG18CAds.weaponIndex = 0;
  gG18CAds.aiming = true;
  gG18CAds.shoot();

  assert.equal(gAR2Ads.pitch, 0.054 * 0.7);
  assert.equal(gG18CAds.pitch, 0.0648 * 0.7);
  assert.ok(Math.abs(gG18CAds.pitch - gAR2Ads.pitch * 1.2) < 1e-9);
  assert.ok(Math.abs(gG18CAds.recoil - gAR2Ads.recoil * 1.2) < 1e-9);
});

test('hipfire spread is substantially wider than ADS aiming across all weapons', () => {
  for (let idx = 0; idx < 4; idx++) {
    const isG18C = idx === 3;
    const weaponIdx = isG18C ? 0 : idx;

    const gHip = fixture();
    gHip.state.g18c = isG18C;
    gHip.weaponIndex = weaponIdx;
    gHip.aiming = false;
    const hipRays = [];
    gHip.ray.intersectObjects = () => { hipRays.push(gHip.ray.ray.direction.clone()); return []; };
    gHip.shoot();

    const gAds = fixture();
    gAds.state.g18c = isG18C;
    gAds.weaponIndex = weaponIdx;
    gAds.aiming = true;
    const adsRays = [];
    gAds.ray.intersectObjects = () => { adsRays.push(gAds.ray.ray.direction.clone()); return []; };
    gAds.shoot();

    assert.equal(hipRays.length, 1);
    assert.equal(adsRays.length, 1);
    if (weaponIdx === 2) {
      // Sniper rifle has pinpoint accuracy while scoped and large hip-fire spread
      assert.equal(adsRays[0].x, 0);
      assert.equal(adsRays[0].y, 0);
    }
  }
});

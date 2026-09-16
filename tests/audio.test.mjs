import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../lib/game.ts';
import { WeaponRecoil } from '../lib/recoil.ts';

class MockAudioParam {
  constructor(initial = 1) {
    this.value = initial;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.events.push({ type: 'setValueAtTime', val, time });
    this.value = val;
  }
  exponentialRampToValueAtTime(val, time) {
    if (val <= 0) {
      throw new RangeError(
        'The float target value provided must be non-negative and non-zero: ' +
          val,
      );
    }
    this.events.push({ type: 'exponentialRampToValueAtTime', val, time });
    this.value = val;
  }
  linearRampToValueAtTime(val, time) {
    this.events.push({ type: 'linearRampToValueAtTime', val, time });
    this.value = val;
  }
}

class MockAudioNode {
  constructor(ctx) {
    this.context = ctx;
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.gain = new MockAudioParam(1);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }
  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }
  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.buffer = null;
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }
  start(when = 0, offset = 0, duration) {
    this.started = true;
    this.startTime = when;
    this.offset = offset;
    this.duration = duration;
  }
  stop(when = 0) {
    this.stopped = true;
    this.stopTime = when;
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
  }
}

class MockMediaElementAudioSourceNode extends MockAudioNode {
  constructor(ctx, mediaElement) {
    super(ctx);
    this.mediaElement = mediaElement;
  }
}

class MockAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.currentTime = 0;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this._hasSourceNode = false;
  }
  play() {
    this.paused = false;
    this.playCalls++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.pauseCalls++;
  }
  load() {}
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = new Float32Array(length);
  }
  getChannelData() {
    return this._data;
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
    this.createdNodes = [];
  }
  createGain() {
    const n = new MockGainNode(this);
    this.createdNodes.push(n);
    return n;
  }
  createOscillator() {
    const n = new MockOscillatorNode(this);
    this.createdNodes.push(n);
    return n;
  }
  createBiquadFilter() {
    const n = new MockBiquadFilterNode(this);
    this.createdNodes.push(n);
    return n;
  }
  createBufferSource() {
    const n = new MockAudioBufferSourceNode(this);
    this.createdNodes.push(n);
    return n;
  }
  createMediaElementSource(mediaElement) {
    if (mediaElement?._hasSourceNode) {
      throw new DOMException('HTMLMediaElement already connected', 'InvalidStateError');
    }
    if (mediaElement) mediaElement._hasSourceNode = true;
    const n = new MockMediaElementAudioSourceNode(this, mediaElement);
    this.createdNodes.push(n);
    return n;
  }
  createDynamicsCompressor() {
    const n = new MockDynamicsCompressorNode(this);
    this.createdNodes.push(n);
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

function createAudioFixture() {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    audio: null,
    master: null,
    compressor: null,
    noiseBuffer: null,
    bgmAudio: null,
    bgmSource: null,
    bgmGain: null,
    bgmEnabled: true,
    bgmStarted: false,
    muted: false,
    weaponIndex: 0,
    ammo: [12, 30, 5, 1],
    reserve: [120, 240, 60, 10],
    cooldown: 0,
    reloadTime: 0,
    recoil: 0,
    pitch: 0,
    yaw: 0,
    keys: new Set(),
    viewRecoil: new WeaponRecoil(),
    state: { mode: 'playing', bgm: true, owned: [true, false, false, false] },
    camera: { updateMatrixWorld() {}, position: { set() {} } },
    scene: { updateMatrixWorld() {}, remove() {}, traverse() {} },
    materials: [],
    textures: new Map(),
    graphics: { geometries: new Set(), materials: new Set(), dispose() {} },
    renderer: { dispose() {}, domElement: { remove() {} } },
    walls: [],
    enemies: [],
    corpses: [],
    particles: [],
    ray: { setFromCamera() {}, intersectObjects() { return []; } },
    clearEnemyProjectiles() {},
    clearGrenades() {},
    clearRockets() {},
    buildGun() {},
    nextWave() {},
    events: [],
    emit() {
      this.callback?.({ ...this.state });
    },
  });
  return g;
}

test('Siren voice is cancellable, uses the shared master, and disconnects on cancel or natural completion', () => {
  const g = createAudioFixture();
  assert.equal(g.sirenScreamSound(1.5), undefined);
  g.audio = new MockAudioContext(); g.master = g.audio.createGain(); g.initNoiseBuffer();
  const first = g.audio.createdNodes.length;
  const cancel = g.sirenScreamSound(1.5);
  const nodes = g.audio.createdNodes.slice(first);
  const sources = nodes.filter(n => n instanceof MockOscillatorNode || n instanceof MockAudioBufferSourceNode);
  assert.ok(nodes.some(n => n.connections.includes(g.master)));
  assert.ok(sources.every(n => n.started && n.stopTime === 1.5));
  g.audio.currentTime = 0.4; cancel(); cancel();
  assert.ok(sources.every(n => n.stopTime === 0.4));
  assert.ok(nodes.every(n => n.connections.length === 0));
  const next = g.audio.createdNodes.length; g.sirenScreamSound(1);
  const nextNodes = g.audio.createdNodes.slice(next);
  nextNodes.filter(n => n instanceof MockOscillatorNode || n instanceof MockAudioBufferSourceNode).forEach(n => n.onended());
  assert.ok(nextNodes.every(n => n.connections.length === 0));
});

test('audio initialization wires master -> dynamics compressor -> destination and precomputes pink noise buffer', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;

  g.initAudio();
  assert.ok(g.audio);
  assert.ok(g.master);
  assert.ok(g.compressor);
  assert.ok(g.noiseBuffer);

  // Check wiring
  assert.equal(g.master.connections[0], g.compressor);
  assert.equal(g.compressor.connections[0], g.audio.destination);

  // Check pink noise buffer duration (>= 2 seconds)
  assert.ok(g.noiseBuffer.duration >= 2.0);

  // Check compressor parameters for dynamics control and peak clipping prevention
  assert.equal(g.compressor.threshold.value, -10);
  assert.equal(g.compressor.knee.value, 8);
  assert.equal(g.compressor.ratio.value, 8);

  delete globalThis.AudioContext;
});

test('mute toggles master gain without breaking audio graph', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  assert.equal(g.master.gain.value, 0.27);
  g.mute(true);
  assert.equal(g.master.gain.value, 0);
  assert.equal(g.muted, true);
  g.mute(false);
  assert.equal(g.master.gain.value, 0.27);
  assert.equal(g.muted, false);

  delete globalThis.AudioContext;
});

test('gunshot(0) [Pistol] generates transient snap, pitch transient, low-mid thump, and filtered muzzle blast', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  const initialCount = g.audio.createdNodes.length;
  g.gunshot(0);
  const shotNodes = g.audio.createdNodes.slice(initialCount);

  // Oscillators: crack transient + low-mid thump
  const oscs = shotNodes.filter((n) => n instanceof MockOscillatorNode);
  assert.equal(oscs.length, 2);

  // Filters: bandpass transient + lowpass muzzle expansion + bandpass slide click
  const filters = shotNodes.filter((n) => n instanceof MockBiquadFilterNode);
  assert.ok(filters.length >= 3);
  assert.ok(filters.some((f) => f.type === 'bandpass'));
  assert.ok(filters.some((f) => f.type === 'lowpass'));

  // Ensure all frequency events are strictly positive and bounded below laser-chirp frequencies (<= 350Hz)
  for (const osc of oscs) {
    const startFreq = osc.frequency.events[0]?.val ?? osc.frequency.value;
    assert.ok(startFreq <= 350, `Osc frequency ${startFreq} must be <= 350Hz to avoid laser chirps`);
    for (const ev of osc.frequency.events) {
      assert.ok(ev.val > 0, `Osc frequency must be > 0, got ${ev.val}`);
    }
  }

  delete globalThis.AudioContext;
});

test('gunshot(1) [Assault Rifle] produces compact duration (<=0.08s) suitable for high rate of fire (0.095s)', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  const initialCount = g.audio.createdNodes.length;
  g.gunshot(1);
  const shotNodes = g.audio.createdNodes.slice(initialCount);

  // Oscillators and noise buffers should have compact duration to prevent muddy overlap
  const oscs = shotNodes.filter((n) => n instanceof MockOscillatorNode);
  for (const osc of oscs) {
    const dur = osc.stopTime - osc.startTime;
    assert.ok(dur <= 0.08, `Assault rifle osc duration ${dur} exceeds 0.08s`);
    const startFreq = osc.frequency.events[0]?.val ?? osc.frequency.value;
    assert.ok(startFreq <= 350, `Assault rifle osc start frequency ${startFreq} must be <= 350Hz`);
  }

  const buffers = shotNodes.filter((n) => n instanceof MockAudioBufferSourceNode);
  for (const buf of buffers) {
    assert.ok(buf.duration <= 0.08, `Assault rifle noise duration ${buf.duration} exceeds 0.08s`);
  }

  // Rapid fire simulation: fire 5 successive shots without error or negative ramps
  for (let i = 0; i < 5; i++) {
    g.audio.currentTime += 0.095;
    g.gunshot(1);
  }

  delete globalThis.AudioContext;
});

test('gunshot(0) with G18C active produces rapid-fire compact duration (<=0.055s) for 900 RPM full auto', () => {
  const g = createAudioFixture();
  g.state.g18c = true;
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  const initialCount = g.audio.createdNodes.length;
  g.gunshot(0);
  const shotNodes = g.audio.createdNodes.slice(initialCount);

  // Oscillators and noise buffers should have ultra-compact duration (<=0.055s) to prevent muddy overlap at 0.068s rate
  const oscs = shotNodes.filter((n) => n instanceof MockOscillatorNode);
  for (const osc of oscs) {
    const dur = osc.stopTime - osc.startTime;
    assert.ok(dur <= 0.055, `G18C osc duration ${dur} exceeds 0.055s`);
    const startFreq = osc.frequency.events[0]?.val ?? osc.frequency.value;
    assert.ok(startFreq <= 350, `G18C osc start frequency ${startFreq} must be <= 350Hz`);
  }

  const buffers = shotNodes.filter((n) => n instanceof MockAudioBufferSourceNode);
  for (const buf of buffers) {
    assert.ok(buf.duration <= 0.055, `G18C noise duration ${buf.duration} exceeds 0.055s`);
  }

  // Rapid full-auto spray simulation (10 successive shots at 0.068s interval)
  for (let i = 0; i < 10; i++) {
    g.audio.currentTime += 0.068;
    g.gunshot(0);
  }

  delete globalThis.AudioContext;
});

test('gunshot(2) [Sniper] produces a low rifle report and delayed bolt sounds without high-pitched chirps', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  const initialCount = g.audio.createdNodes.length;
  g.gunshot(2);
  const shotNodes = g.audio.createdNodes.slice(initialCount);

  const oscs = shotNodes.filter((n) => n instanceof MockOscillatorNode);
  // Rifle report: crack transient, body, and low tail.
  assert.equal(oscs.length, 3);

  // The tail decays into the low range.
  const minFreq = Math.min(...oscs.map((o) => o.frequency.value));
  assert.ok(minFreq <= 35, `Sniper tail frequency should be <= 35Hz, got ${minFreq}`);
  for (const osc of oscs) {
    const startFreq = osc.frequency.events[0]?.val ?? osc.frequency.value;
    assert.ok(startFreq <= 350, `Sniper osc start frequency ${startFreq} must be <= 350Hz`);
  }

  // Resonant lowpass blast filter has Q > 2 for warm acoustic body
  const filters = shotNodes.filter((n) => n instanceof MockBiquadFilterNode);
  const lowpassFilters = filters.filter((f) => f.type === 'lowpass');
  assert.ok(lowpassFilters.some((f) => f.Q.value >= 2.0));

  const initialBoltCount = g.audio.createdNodes.length;
  g.weaponIndex = 2;
  g.sniperBoltTime = 1.1;
  g.audio.currentTime += 0.35;
  g.updateBolt(0.35);
  g.audio.currentTime += 0.55;
  g.updateBolt(0.55);
  const boltSounds = g.audio.createdNodes.slice(initialBoltCount)
    .filter((n) => n instanceof MockAudioBufferSourceNode);
  assert.equal(boltSounds.length, 2);
  assert.ok(boltSounds[0].startTime < boltSounds[1].startTime);
  assert.ok(boltSounds.every((n) => n.startTime <= g.audio.currentTime));

  delete globalThis.AudioContext;
});

test('RPG launch produces a low thump and filtered propellant noise distinct from rifle fire', (t) => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  t.after(() => { delete globalThis.AudioContext; });
  g.initAudio();
  const before = g.audio.createdNodes.length;
  g.gunshot(3);
  const nodes = g.audio.createdNodes.slice(before);
  const oscs = nodes.filter((n) => n instanceof MockOscillatorNode);
  assert.equal(oscs.length, 2);
  assert.ok(oscs.every((osc) => osc.started && osc.frequency.events[0].val <= 110));
  assert.ok(nodes.some((n) => n instanceof MockBiquadFilterNode && n.type === 'lowpass'));
  assert.ok(nodes.some((n) => n instanceof MockAudioBufferSourceNode && n.started));
});

test('headshotSound produces crisp high-frequency metallic pings', (t) => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  t.after(() => { delete globalThis.AudioContext; });
  g.initAudio();
  const before = g.audio.createdNodes.length;
  g.headshotSound();
  const nodes = g.audio.createdNodes.slice(before);
  const oscs = nodes.filter((n) => n instanceof MockOscillatorNode);
  assert.equal(oscs.length, 2);
  assert.ok(oscs.some((osc) => osc.type === 'sine' && osc.frequency.events[0].val === 1760));
  assert.ok(oscs.some((osc) => osc.type === 'triangle' && osc.frequency.events[0].val === 2640));
});

test('combat and weapon sound methods execute cleanly with safe non-zero exponential ramps and anti-click envelopes', () => {
  const g = createAudioFixture();
  globalThis.AudioContext = MockAudioContext;
  g.initAudio();

  // Dry fire
  g.dryFire();

  // Reload start & complete
  g.reloadStart();
  g.reloadComplete();
  g.boltSound(false);
  g.boltSound(true);

  // Grenade explosion
  g.explosionSound();

  // Melee whoosh
  g.meleeSound();

  // Player hurt
  g.hurtSound();

  // Wave alert
  g.waveAlertSound();

  // Headshot ping
  g.headshotSound();

  // Backward-compatible sound() and noise()
  g.sound(200, 0.1, 'sine', 0.2, 50);
  g.sound(150, 0.1, 'sawtooth', 0.2, 40);
  g.noise(0.1, 0.5);

  // Verify every gain and frequency ramp in all created nodes had strictly positive targets
  for (const node of g.audio.createdNodes) {
    if (node instanceof MockGainNode) {
      for (const ev of node.gain.events) {
        if (ev.type === 'exponentialRampToValueAtTime') {
          assert.ok(ev.val > 0, `Gain target must be > 0: ${ev.val}`);
        }
      }
    }
    if (node instanceof MockOscillatorNode) {
      for (const ev of node.frequency.events) {
        if (ev.type === 'exponentialRampToValueAtTime') {
          assert.ok(ev.val > 0, `Frequency target must be > 0: ${ev.val}`);
        }
      }
    }
  }

  // Verify anti-click envelope: gain nodes for sounds have >= 2 exponential ramps (attack + decay)
  const soundGainNodes = g.audio.createdNodes.filter(
    (n) => n instanceof MockGainNode && n !== g.master,
  );
  assert.ok(soundGainNodes.length > 0);
  for (const gn of soundGainNodes) {
    const rampEvents = gn.gain.events.filter(
      (e) => e.type === 'exponentialRampToValueAtTime',
    );
    assert.ok(
      rampEvents.length >= 2,
      `Gain node should have attack and decay ramps, got ${rampEvents.length}`,
    );
  }

  delete globalThis.AudioContext;
});

test('audio methods safely no-op when AudioContext is null or uninitialized', () => {
  const g = createAudioFixture();
  // audio is null
  assert.doesNotThrow(() => g.gunshot(0));
  assert.doesNotThrow(() => g.gunshot(1));
  assert.doesNotThrow(() => g.gunshot(2));
  assert.doesNotThrow(() => g.gunshot(3));
  assert.doesNotThrow(() => g.headshotSound());
  assert.doesNotThrow(() => g.dryFire());
  assert.doesNotThrow(() => g.reloadStart());
  assert.doesNotThrow(() => g.reloadComplete());
  assert.doesNotThrow(() => g.explosionSound());
  assert.doesNotThrow(() => g.meleeSound());
  assert.doesNotThrow(() => g.hurtSound());
  assert.doesNotThrow(() => g.waveAlertSound());
  assert.doesNotThrow(() => g.sound(100, 0.1));
  assert.doesNotThrow(() => g.noise(0.1, 0.5));
  assert.doesNotThrow(() => g.mute(true));
});

test('BGM audio graph initializes: single Audio instance (/audio/zombgm.ogg), loop=true, bgmSource -> bgmGain(0.5) -> master, and avoids duplicate createMediaElementSource on repeat initAudio', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();

  g.initAudio();
  assert.ok(g.bgmAudio instanceof MockAudio);
  assert.equal(g.bgmAudio.src, '/audio/zombgm.ogg');
  assert.equal(g.bgmAudio.loop, true);
  assert.ok(g.bgmSource instanceof MockMediaElementAudioSourceNode);
  assert.ok(g.bgmGain instanceof MockGainNode);
  assert.equal(g.bgmGain.gain.value, 0.5);

  // Check audio graph routing
  assert.equal(g.bgmSource.connections[0], g.bgmGain);
  assert.equal(g.bgmGain.connections[0], g.master);
  assert.equal(g.master.connections[0], g.compressor);

  // Calling initAudio() again should not recreate bgmAudio or throw InvalidStateError
  const audioRef = g.bgmAudio;
  const sourceRef = g.bgmSource;
  const gainRef = g.bgmGain;
  assert.doesNotThrow(() => g.initAudio());
  assert.equal(g.bgmAudio, audioRef);
  assert.equal(g.bgmSource, sourceRef);
  assert.equal(g.bgmGain, gainRef);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('title screen: setBgm alters enabled setting and snapshot, but does not start playback before DEPLOY', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.bgmStarted = false;
  let lastSnapshot = null;
  g.callback = (s) => { lastSnapshot = s; };

  g.initAudio();
  assert.equal(g.bgmEnabled, true);
  assert.equal(g.bgmAudio.playCalls, 0);

  // Toggle OFF on title screen
  g.setBgm(false);
  assert.equal(g.bgmEnabled, false);
  assert.equal(g.state.bgm, false);
  assert.equal(lastSnapshot?.bgm, false);
  assert.equal(g.bgmAudio.playCalls, 0);

  // Toggle ON on title screen
  g.setBgm(true);
  assert.equal(g.bgmEnabled, true);
  assert.equal(g.state.bgm, true);
  assert.equal(lastSnapshot?.bgm, true);
  assert.equal(g.bgmAudio.playCalls, 0);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('DEPLOY (start): triggers BGM playback from beginning (0s); restarting game starts from 0s', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.bgmStarted = false;

  // First DEPLOY
  g.start('normal');
  assert.equal(g.bgmStarted, true);
  assert.equal(g.bgmAudio.currentTime, 0);
  assert.equal(g.bgmAudio.playCalls, 1);
  assert.equal(g.bgmAudio.paused, false);

  // Advance time during combat
  g.bgmAudio.currentTime = 45.2;

  // Starting a new game rewinds to 0 and plays from top
  g.start('normal');
  assert.equal(g.bgmAudio.currentTime, 0);
  assert.equal(g.bgmAudio.playCalls, 2);
  assert.equal(g.bgmAudio.paused, false);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('if BGM is toggled OFF before DEPLOY, starting game respects setting and does not play', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.bgmStarted = false;
  g.initAudio();

  g.setBgm(false);
  g.start('normal');
  assert.equal(g.bgmStarted, true);
  assert.equal(g.bgmEnabled, false);
  assert.equal(g.bgmAudio.playCalls, 0);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('modes (playing, paused, shop, cleared, dead, won) keep BGM looping without duplicate nodes or playback restarts', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');

  assert.equal(g.bgmAudio.playCalls, 1);
  g.bgmAudio.currentTime = 12.3;

  // Esc pause
  g.pause();
  assert.equal(g.state.mode, 'paused');
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.currentTime, 12.3);
  assert.equal(g.bgmAudio.playCalls, 1);

  // Resume combat
  g.resume();
  assert.equal(g.state.mode, 'playing');
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.playCalls, 1);

  // Wave clear / shop
  g.finish('shop');
  assert.equal(g.state.mode, 'shop');
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.playCalls, 1);

  // Player dead (game over)
  g.finish('dead');
  assert.equal(g.state.mode, 'dead');
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.playCalls, 1);

  // Player won
  g.finish('won');
  assert.equal(g.state.mode, 'won');
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.playCalls, 1);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('toMenu stops BGM and rewinds to 0; preserves BGM on/off setting', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');
  g.bgmAudio.currentTime = 25.0;

  g.toMenu();
  assert.equal(g.state.mode, 'menu');
  assert.equal(g.bgmStarted, false);
  assert.equal(g.bgmAudio.paused, true);
  assert.equal(g.bgmAudio.currentTime, 0);
  assert.equal(g.bgmEnabled, true);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('BGM toggle during gameplay: setBgm(false) pauses and preserves position, setBgm(true) resumes from current position', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');
  assert.equal(g.bgmAudio.playCalls, 1);

  g.bgmAudio.currentTime = 37.8;

  // Toggle OFF during game
  g.setBgm(false);
  assert.equal(g.bgmEnabled, false);
  assert.equal(g.bgmAudio.paused, true);
  assert.equal(g.bgmAudio.currentTime, 37.8);

  // Toggle ON resumes from current position
  g.setBgm(true);
  assert.equal(g.bgmEnabled, true);
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.currentTime, 37.8);
  assert.equal(g.bgmAudio.playCalls, 2);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('mute(true) silences master gain without altering BGM state or playback position', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');
  g.bgmAudio.currentTime = 18.0;

  g.mute(true);
  assert.equal(g.muted, true);
  assert.equal(g.master.gain.value, 0);
  // BGM element itself remains running at its position
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.currentTime, 18.0);
  assert.equal(g.bgmEnabled, true);

  g.mute(false);
  assert.equal(g.muted, false);
  assert.equal(g.master.gain.value, 0.27);
  assert.equal(g.bgmAudio.paused, false);
  assert.equal(g.bgmAudio.currentTime, 18.0);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('play failure handling and retry: game and SFX continue unharmed, retry succeeds on next user BGM On', async () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';

  // Simulate play rejection (e.g. autoplay policy)
  let rejectPlay = true;
  class FlakyAudio extends MockAudio {
    play() {
      if (rejectPlay) {
        return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      }
      return super.play();
    }
  }
  globalThis.Audio = FlakyAudio;

  // Starting game should not throw or crash despite play rejection
  assert.doesNotThrow(() => g.start('normal'));
  assert.equal(g.bgmStarted, true);

  // SFX continues to work without issue
  assert.doesNotThrow(() => g.gunshot(0));
  assert.doesNotThrow(() => g.explosionSound());

  // Player clicks BGM ON again (user interaction) - allows play
  rejectPlay = false;
  assert.doesNotThrow(() => g.setBgm(true));
  assert.equal(g.bgmAudio.paused, false);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('dispose halts BGM playback, clears source, disconnects audio nodes, and resets references', () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');

  const bgmSource = g.bgmSource;
  const bgmGain = g.bgmGain;

  g.dispose();
  assert.equal(g.disposed, true);
  assert.equal(g.bgmAudio, null);
  assert.equal(g.bgmSource, null);
  assert.equal(g.bgmGain, null);
  assert.equal(bgmSource.connections.length, 0);
  assert.equal(bgmGain.connections.length, 0);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('initAudio failure during createMediaElementSource cleanly rolls back and leaves all BGM nodes null, allowing subsequent retry', () => {
  let shouldFail = true;
  class FailingMockAudioContext extends MockAudioContext {
    createMediaElementSource(mediaElement) {
      if (shouldFail) {
        throw new DOMException('Failed to create MediaElementAudioSourceNode', 'InvalidStateError');
      }
      return super.createMediaElementSource(mediaElement);
    }
  }

  globalThis.AudioContext = FailingMockAudioContext;
  globalThis.Audio = MockAudio;
  const g = createAudioFixture();

  // initAudio should not throw, and should roll back completely so unrouted audio is not played
  assert.doesNotThrow(() => g.initAudio());
  assert.equal(g.bgmAudio, null);
  assert.equal(g.bgmSource, null);
  assert.equal(g.bgmGain, null);

  // Subsequent call after failure condition resolves should successfully initialize
  shouldFail = false;
  assert.doesNotThrow(() => g.initAudio());
  assert.ok(g.bgmAudio instanceof MockAudio);
  assert.ok(g.bgmSource instanceof MockMediaElementAudioSourceNode);
  assert.ok(g.bgmGain instanceof MockGainNode);
  assert.equal(g.bgmSource.connections[0], g.bgmGain);
  assert.equal(g.bgmGain.connections[0], g.master);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('async loading delay: toggling BGM OFF while play() is pending prevents delayed playback upon promise resolution', async () => {
  globalThis.AudioContext = MockAudioContext;

  let resolvePlayPromise = null;
  class AsyncLoadAudio extends MockAudio {
    play() {
      this.playCalls++;
      return new Promise((resolve) => {
        resolvePlayPromise = () => {
          this.paused = false; // simulates browser starting playback when buffered
          resolve();
        };
      });
    }
  }
  globalThis.Audio = AsyncLoadAudio;

  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');

  assert.equal(g.bgmAudio.playCalls, 1);
  assert.ok(resolvePlayPromise !== null);

  // User toggles BGM OFF while audio is still loading asynchronously
  g.setBgm(false);
  assert.equal(g.bgmEnabled, false);
  assert.equal(g.bgmAudio.paused, true);

  // Media finish loading and browser resolves the pending play() promise
  resolvePlayPromise();
  await new Promise((r) => setTimeout(r, 0));

  // The post-resolution state guard ensures audio is paused and not playing belatedly
  assert.equal(g.bgmAudio.paused, true);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('async loading delay: returning to title (toMenu) while play() is pending prevents delayed playback on title screen and rewinds to 0s', async () => {
  globalThis.AudioContext = MockAudioContext;

  let resolvePlayPromise = null;
  class AsyncLoadAudio extends MockAudio {
    play() {
      this.playCalls++;
      return new Promise((resolve) => {
        resolvePlayPromise = () => {
          this.paused = false;
          resolve();
        };
      });
    }
  }
  globalThis.Audio = AsyncLoadAudio;

  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');

  assert.equal(g.bgmAudio.playCalls, 1);
  assert.ok(resolvePlayPromise !== null);

  // User returns to Title while audio is still loading asynchronously
  g.toMenu();
  assert.equal(g.state.mode, 'menu');
  assert.equal(g.bgmStarted, false);
  assert.equal(g.bgmAudio.paused, true);

  // Media finish loading and browser resolves the pending play() promise
  resolvePlayPromise();
  await new Promise((r) => setTimeout(r, 0));

  // Audio MUST remain paused and rewound to 0s on title screen
  assert.equal(g.bgmAudio.paused, true);
  assert.equal(g.bgmAudio.currentTime, 0);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});

test('async loading delay: disposing game while play() is pending prevents playback on disposed instance', async () => {
  globalThis.AudioContext = MockAudioContext;

  let resolvePlayPromise = null;
  let audioInstance = null;
  class AsyncLoadAudio extends MockAudio {
    constructor(src) {
      super(src);
      audioInstance = this;
    }
    play() {
      this.playCalls++;
      return new Promise((resolve) => {
        resolvePlayPromise = () => {
          this.paused = false;
          resolve();
        };
      });
    }
  }
  globalThis.Audio = AsyncLoadAudio;

  const g = createAudioFixture();
  g.state.mode = 'menu';
  g.start('normal');

  assert.equal(audioInstance.playCalls, 1);
  assert.ok(resolvePlayPromise !== null);

  // Dispose game while audio is still loading asynchronously
  g.dispose();
  assert.equal(g.disposed, true);
  assert.equal(g.bgmAudio, null);

  // Media finishes loading and browser resolves pending play() promise
  resolvePlayPromise();
  await new Promise((r) => setTimeout(r, 0));

  // Disposed instance must remain paused
  assert.equal(audioInstance.paused, true);

  delete globalThis.AudioContext;
  delete globalThis.Audio;
});


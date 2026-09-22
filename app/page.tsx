'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Shield,
  Skull,
  Heart,
  Target,
  Pause,
  Swords,
  Package,
  Music,
} from 'lucide-react';

function MusicOff({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-music-off"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
import { Button } from '@/components/ui/button';
import { Game, MEDICAL_KIT, type Snapshot } from '@/lib/game';
import { registerGameTools, type Registry } from '@/lib/game-tools';
import type { HansAction } from '@/lib/hans';
const bossActions: Record<HansAction, string> = {
  approach: 'PURSUING', 'rifle-windup': 'RIFLES READY — TAKE COVER', rifle: 'DUAL MKb42 FIRE',
  'gas-windup': 'GAS GRENADES — KEEP MOVING', 'dash-windup': 'DASH INCOMING', dash: 'SPRINTING',
  'leap-windup': 'CLAW LEAP — DODGE SIDEWAYS', leap: 'CLAW ATTACK', recover: 'RECOVERING',
  stunned: 'CHARGE DEPLETED — DAMAGE ×1.5',
};
const initial: Snapshot = {
  bossDebug: false,
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
  weapon: 'H1 SERVICE PISTOL',
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
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Game | null>(null);
  const [s, setS] = useState(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [muted, setMuted] = useState(false),
    [difficulty, setDifficulty] = useState<'normal' | 'hard'>('normal'),
    [confirmReturnToTitle, setConfirmReturnToTitle] = useState(false),
    [debugWave, setDebugWave] = useState<number>(1),
    [debugCash, setDebugCash] = useState<number>(20000),
    [debugMinHp, setDebugMinHp] = useState<boolean>(false);
  const maxWave = 7;
  const currentDebugWave = Math.min(debugWave, maxWave);
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    setReady(false);
    setError('');
    try {
      const g = new Game(host.current, setS);
      const cleanup = registerGameTools(
        g,
        (document as Document & { modelContext?: Registry }).modelContext,
      );
      engine.current = g;
      void g.prepareResources().then(() => {
        if (!cancelled) setReady(true);
      }).catch(() => {
        if (!cancelled) setError('Failed to prepare weapons. Please reload the page.');
      });
      return () => {
        cancelled = true;
        cleanup();
        g.dispose();
        engine.current = null;
      };
    } catch {
      setError(
        'Failed to initialize 3D display. Please open in a WebGL-compatible browser like Chrome or Edge.',
      );
    }
  }, []);
  const start = () => {
    if (!ready || error) return;
    engine.current?.start(difficulty, {
      bossDebug: s.bossDebug,
      debugWave: s.bossDebug ? currentDebugWave : undefined,
      debugCash: s.bossDebug ? debugCash : undefined,
      debugMinHp: s.bossDebug ? debugMinHp : undefined,
    });
  };
  const active = s.mode === 'playing';
  return (
    <main className={`game-shell mode-${s.mode}`}>
      <div ref={host} className="world" aria-label="3D Zombie Survival Game" />
      <div className="vignette" />
      <div className="damage" style={{ opacity: s.hurt * 0.7 }} />
      <header className="topbar">
        <div className="wordmark">
          <Crosshair size={21} />
          <span>
            Astra Floor<span className="wordmark-dot"> / </span>
          </span>
        </div>
        {!(active && s.boss) && (
          <div className="location">
            <span className="live-dot" /> QUARANTINE ZONE <b>07</b>
          </div>
        )}
        <div className="top-actions">
          {s.mode !== 'menu' && (
            <span className="solo">
              {(s.difficulty || difficulty).toUpperCase()}
            </span>
          )}
          <button
            className="bgm-toggle"
            aria-pressed={s.bgm}
            aria-label={s.bgm ? 'Mute BGM' : 'Unmute BGM'}
            onClick={() => engine.current?.setBgm(!s.bgm)}
          >
            {s.bgm ? <Music size={18} /> : <MusicOff size={18} />}
          </button>
          <button
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            onClick={() => {
              setMuted(!muted);
              engine.current?.mute(!muted);
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {active && (
            <button
              aria-label="Pause game"
              onClick={() => engine.current?.pause()}
            >
              <Pause size={18} />
            </button>
          )}
        </div>
      </header>
      {s.mode === 'menu' && (
        <section className="start-screen">
          <div className="intro">
            <div className="eyebrow">
              <span /> OUTBREAK PROTOCOL / 001
            </div>
            <h1>
              Astra
              <br />
              <span>Floor</span>
              <i>QUARANTINE ZONE</i>
            </h1>
            <p className="intro-copy">HOLD THE TRIGGER UNTIL DAWN.</p>
            <p className="intro-detail">
              Infected inbound. Limited ammunition.
              <br />
              Survive the waves, then defeat Final Boss.
            </p>
            <div className="difficulty" aria-label="Difficulty">
              {(
                [
                  ['normal', 'NORMAL'],
                  ['hard', 'HARD'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setDifficulty(id);
                  }}
                  aria-pressed={difficulty === id}
                  className={difficulty === id ? 'selected' : ''}
                >
                  {label}
                </button>
              ))}
            </div>
            {!s.bossDebug && (
              <Button
                className="deploy-button"
                onClick={start}
                disabled={!ready || !!error}
              >
                {error
                  ? 'UNAVAILABLE'
                  : !ready
                  ? 'INITIALIZING...'
                  : 'DEPLOY'}
                <ArrowUpRight />
              </Button>
            )}
            {!s.bossDebug && (
              <div className="start-caption">
                SINGLE PLAYER <span>•</span> 6 WAVES + BOSS <span>•</span> SURVIVE
              </div>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
          <footer className="control-strip">
            <span>
              <kbd>W A S D</kbd> MOVE
            </span>
            <span>
              <kbd>MOUSE</kbd> AIM / SHOOT
            </span>
            <span>
              <kbd>R</kbd> RELOAD
            </span>
            <span>
              <kbd>SHIFT</kbd> SPRINT
            </span>
            <span>
              <kbd>Q</kbd> HEAL
            </span>
            <span>
              <kbd>G</kbd> GRENADE
            </span>
          </footer>
        </section>
      )}
      {s.mode === 'menu' && s.bossDebug && (
        <div
          className="modal-scrim debug-scrim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              engine.current?.toggleBossDebug();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'F8') {
              engine.current?.toggleBossDebug();
            }
          }}
        >
          <div
            className="debug-card debug-config-panel"
            aria-label="Debug Configuration"
          >
            <div className="debug-card-header">
              <div className="eyebrow">
                <span className="debug-live-dot" /> PROTOCOL OVERRIDE // DEBUG
              </div>
              <button
                type="button"
                className="debug-close-btn"
                onClick={() => engine.current?.toggleBossDebug()}
                aria-label="Close debug configuration"
              >
                <kbd>F8</kbd> CLOSE
              </button>
            </div>
            <h2>DEBUG CONFIGURATION</h2>
            <p className="debug-card-desc">
              Configure deployment parameters and requisition credits before entering combat.
            </p>

            <div className="debug-config-row">
              <div className="debug-row-header">
                <span className="debug-label">DIFFICULTY</span>
                <span className="debug-sublabel">
                  7 waves including boss
                </span>
              </div>
              <div className="difficulty debug-difficulty-select" aria-label="Difficulty">
                {(
                  [
                    ['normal', 'NORMAL (6 WAVES + BOSS)'],
                    ['hard', 'HARD (6 WAVES + BOSS)'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setDifficulty(id);
                    }}
                    aria-pressed={difficulty === id}
                    className={difficulty === id ? 'selected' : ''}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="debug-config-row">
              <div className="debug-row-header">
                <span className="debug-label">STARTING WAVE</span>
                <span className="debug-sublabel">
                  {currentDebugWave === 7
                    ? 'Wave 7: Hans Volter Boss Fight'
                    : `Wave ${String(currentDebugWave).padStart(2, '0')} via supply shop`}
                </span>
              </div>
              <div className="debug-wave-buttons">
                {Array.from({ length: maxWave }, (_, idx) => idx + 1).map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`debug-wave-btn${currentDebugWave === w ? ' selected' : ''}`}
                    onClick={() => setDebugWave(w)}
                  >
                    {w === 7 ? '7: BOSS' : w}
                  </button>
                ))}
              </div>
            </div>

            <div className="debug-config-row">
              <div className="debug-row-header">
                <span className="debug-label">STARTING CREDITS</span>
                <span className="debug-sublabel">Max ₡999,000</span>
              </div>
              <div className="debug-cash-controls">
                <button
                  type="button"
                  className="debug-stepper-btn"
                  onClick={() => setDebugCash((c) => Math.max(0, c - 10000))}
                >
                  -10k
                </button>
                <span className="debug-cash-display">₡ {debugCash.toLocaleString()}</span>
                <button
                  type="button"
                  className="debug-stepper-btn"
                  onClick={() => setDebugCash((c) => Math.min(999000, c + 10000))}
                >
                  +10k
                </button>
                <button
                  type="button"
                  className="debug-reset-btn"
                  onClick={() => setDebugCash(20000)}
                >
                  RESET
                </button>
              </div>
            </div>

            <div className="debug-config-row">
              <div className="debug-row-header">
                <span className="debug-label">INVULNERABILITY</span>
                <span className="debug-sublabel">Cannot drop below 1 HP</span>
              </div>
              <label className={`debug-checkbox-control${debugMinHp ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={debugMinHp}
                  onChange={(e) => setDebugMinHp(e.target.checked)}
                />
                <span className="debug-checkbox-text">PREVENT DEATH (MIN HP 1)</span>
              </label>
            </div>

            <div className="debug-card-actions">
              <Button
                className="deploy-button"
                onClick={start}
                disabled={!ready || !!error}
              >
                {error
                  ? 'UNAVAILABLE'
                  : !ready
                  ? 'INITIALIZING...'
                  : `PREPARE WAVE ${String(currentDebugWave).padStart(2, '0')}`}
                <ArrowUpRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="debug-cancel-btn"
                onClick={() => engine.current?.toggleBossDebug()}
              >
                RETURN TO TITLE
              </Button>
            </div>

            <div className="start-caption debug-caption">
              DEBUG SIMULATION <span>•</span> WAVE {String(currentDebugWave).padStart(2, '0')} PREP <span>•</span> ₡{debugCash.toLocaleString()} ALLOCATED{debugMinHp ? ' • MIN HP 1' : ''}
            </div>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
      {active && (
        <>
          {s.scoped && (
            <div className="scope-overlay" aria-hidden="true">
              <div className="scope-lens">
                <i className="scope-reticle" />
                <span>SR-3 / 5×</span>
              </div>
            </div>
          )}
          <div className="wave-panel">
            <span className="eyebrow">SURVIVE THE NIGHT</span>
            <div>
              {s.wave === 7 ? 'BOSS' : 'WAVE'} <b>{String(s.wave).padStart(2, '0')}</b>
              <small> / 07</small>
            </div>
            <p>
              <Skull size={15} /> {s.remaining} REMAINING
            </p>
          </div>
          {s.boss && (
            <div className={`boss-panel ${s.boss.action === 'stunned' ? 'boss-stunned' : ''}`} aria-label="Hans Volter status">
              <div className="boss-heading">
                <b>{s.boss.name}</b>
                <span>PHASE {s.boss.phase} / 3</span>
              </div>
              <div className="boss-health" role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={s.boss.maxHealth} aria-valuenow={Math.ceil(s.boss.health)}>
                <i style={{ width: `${s.boss.health / s.boss.maxHealth * 100}%` }} />
              </div>
              <div className="boss-charge-label">
                <span>CHARGE {Math.ceil(s.boss.energy)}%</span>
                <span>{Math.ceil(s.boss.health).toLocaleString()} HP</span>
              </div>
              <div className="boss-charge" role="progressbar" aria-label="Boss charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.ceil(s.boss.energy)}>
                <i style={{ width: `${s.boss.energy}%` }} />
              </div>
              <p>{bossActions[s.boss.action]}</p>
            </div>
          )}
          <div className="cash-panel">
            <span>CREDITS</span>
            <b>₡ {s.cash.toLocaleString()}</b>
            <small>{s.kills} KILLS</small>
          </div>
          <div className={`crosshair ${s.hit > 0 ? 'hit' : ''}`} hidden={(s.aiming || s.scoped) && s.hit <= 0}>
            <i />
            <i />
            <i />
            <i />
          </div>
          {s.message && (
            <div className="game-message" role="status">
              {s.message}
            </div>
          )}
          {(s.reload > 0 || s.bolt > 0) && (
            <div className="reload-indicator">
              {s.reload > 0 ? 'RELOADING' : 'CYCLING BOLT'}
              <div>
                <i style={{ width: `${(1 - (s.reload || s.bolt)) * 100}%` }} />
              </div>
            </div>
          )}
          <div className="vitals">
            <div className="health-label">
              <Heart size={20} />
              <b>{Math.ceil(s.health)}</b>
              <span> / 100</span>
              {s.debugMinHp && <span className="debug-minhp-tag">MIN HP 1</span>}
              <Shield size={17} />
              <strong>{Math.ceil(s.armor)}</strong>
            </div>
            <div className="armor-bar">
              <i
                style={{
                  width: `${Math.min(100, Math.max(0, s.maxArmor > 0 ? (s.armor / s.maxArmor) * 100 : s.armor))}%`,
                }}
              />
            </div>
            <div className="health-bar">
              <i style={{ width: `${s.health}%` }} />
            </div>
            <div className="stamina-bar">
              <i style={{ width: `${s.stamina}%` }} />
            </div>
            <p>
              <kbd>Q</kbd>{' '}
              MEDKIT {s.medicalKits}/{MEDICAL_KIT.max}
              {s.healCooldown > 0 ? ` / ${Math.ceil(s.healCooldown)}s` : ''}
              <span>
                <kbd>G</kbd> × {s.grenades}
              </span>
            </p>
          </div>
          <div className="ammo-panel">
            <span>
              {s.weapon}
              {s.level > 0 && s.weapon !== 'RPG-7' ? ` +${s.level}` : ''}
            </span>
            <div>
              <b className={s.ammo < 4 ? 'red-text' : ''}>
                {String(s.ammo).padStart(2, '0')}
              </b>
              <small>/ {s.reserve}</small>
            </div>
            <p>
              <kbd>1</kbd> {s.g18c ? 'G18C' : 'PISTOL'} <kbd>2</kbd> RIFLE <kbd>3</kbd> SNIPER
              {s.owned?.[3] && (
                <>
                  {' '}
                  <kbd>4</kbd> RPG-7
                </>
              )}
            </p>
          </div>
          <div className="play-hint">
            RIGHT CLICK: AIM / SCOPE <span>•</span> {s.katana ? 'V: KATANA' : 'V: MELEE'} <span>•</span>{' '}
            SPACE: JUMP <span>•</span> ESC: PAUSE
          </div>
        </>
      )}
      {s.mode === 'paused' && (
        <div className="modal-scrim">
          <section className="pause-card">
            {confirmReturnToTitle ? (
              <>
                <span className="eyebrow" style={{ color: '#e65b40' }}>
                  CONFIRMATION
                </span>
                <h2>RETURN TO TITLE</h2>
                <p>
                  Current mission progress (Wave, Cash, Equipment) will be lost.
                  <br />
                  Return to title screen?
                </p>
                <Button
                  className="deploy-button"
                  style={{ background: '#e65b40' }}
                  onClick={() => {
                    setConfirmReturnToTitle(false);
                    engine.current?.toMenu();
                  }}
                >
                  RETURN TO TITLE
                  <ArrowUpRight />
                </Button>
                <Button
                  className="quiet-button"
                  onClick={() => setConfirmReturnToTitle(false)}
                >
                  CANCEL
                </Button>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {s.pointerLockError ? 'MOUSE CAPTURE FAILED' : 'SIGNAL ON HOLD'}
                </span>
                <h2>{s.pointerLockError ? 'INPUT ERROR' : 'PAUSED'}</h2>
                {s.pointerLockError ? (
                  <div role="alert" className="input-error">
                    <p>The browser could not lock the mouse. Combat is paused.</p>
                    <pre><code>{s.pointerLockError}</code></pre>
                  </div>
                ) : (
                  <p>Resume active combat operation.</p>
                )}
                <Button
                  className="deploy-button"
                  onClick={() => {
                    setConfirmReturnToTitle(false);
                    engine.current?.resume();
                  }}
                >
                  {s.pointerLockError ? 'TRY AGAIN' : 'RESUME COMBAT'}
                  <ArrowUpRight />
                </Button>
                <Button
                  className="quiet-button"
                  onClick={() => setConfirmReturnToTitle(true)}
                >
                  RETURN TO TITLE
                </Button>
                <p className="muted-copy">
                  WASD MOVE / R RELOAD / Q HEAL / G GRENADE
                  <br />
                  1・2・3 WEAPONS / V MELEE / SPACE JUMP
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {s.mode === 'cleared' && (
        <div className="modal-scrim">
          <section
            className="result-card"
            style={{ borderTopColor: '#7cd992' }}
          >
            <span className="eyebrow" style={{ color: '#7cd992' }}>
              WAVE {String(s.wave).padStart(2, '0')} COMPLETE
            </span>
            <h2>WAVE {String(s.wave).padStart(2, '0')} CLEARED</h2>
            <p>
              All hostiles neutralized in this sector.
              <br />
              Rearm and prepare for the next assault.
            </p>
            <div className="result-stats">
              <div>
                <span>WAVE REWARD</span>
                <b style={{ color: '#e6c88c' }}>
                  +₡ {(250 + s.wave * 50).toLocaleString()}
                </b>
              </div>
              <div>
                <span>TOTAL KILLS</span>
                <b>{s.kills}</b>
              </div>
            </div>
            <div className="wave-clear-prompt">
              <span>PRESS</span>
              <kbd>SPACE</kbd>
              <span>OR</span>
              <kbd>ENTER</kbd>
              <span>TO PROCEED</span>
            </div>
            <p className="muted-copy" style={{ textAlign: 'center', marginTop: '12px' }}>
              PRESS [ SPACE ] OR [ ENTER ] TO PROCEED TO SUPPLY STATION
            </p>
          </section>
        </div>
      )}
      {s.mode === 'shop' && (
        <div className="modal-scrim">
          <section className="shop-card">
            <div className="shop-heading">
              <div>
                <span className="eyebrow">
                  {s.debugTargetWave !== undefined
                    ? `WAVE ${String(s.debugTargetWave).padStart(2, '0')} PREPARATION`
                    : `WAVE ${String(s.wave).padStart(2, '0')} CLEARED`}
                </span>
                <h2>SUPPLY STATION</h2>
                <p>
                  {s.debugTargetWave !== undefined
                    ? `Equip supplies before entering Wave ${s.debugTargetWave}.`
                    : 'Rearm equipment and prepare for the next wave.'}
                </p>
              </div>
              <b>₡ {s.cash.toLocaleString()}</b>
            </div>
            <div className="shop-items">
              {[
                {
                  id: 'ammo',
                  icon: <Target />,
                  name: 'Ammo Resupply',
                  desc: s.ammoFull
                    ? 'AMMO FULL'
                    : 'Refill reserve ammo for all weapons',
                  price: 100,
                },
                {
                  id: 'health',
                  icon: <Heart />,
                  name: 'Medical Kit',
                  desc: `+1 kit / Q: +${MEDICAL_KIT.heal} HP / ${MEDICAL_KIT.cooldown}s cooldown / ${s.medicalKits}/${MEDICAL_KIT.max} held`,
                  price: 50,
                },
                {
                  id: 'armor',
                  icon: <Shield />,
                  name: 'Body Armor',
                  desc: `Reinforce armor to ${s.maxArmor}`,
                  price: 150,
                },
                {
                  id: 'g18c',
                  icon: <Crosshair />,
                  name: 'G18C — Handgun Auto Upgrade',
                  desc: s.g18c
                    ? 'INSTALLED — 1 KEY / 33-RND FULL-AUTO'
                    : 'Replaces Pistol / 33 rounds / Full-Auto / 1 KEY',
                  price: 750,
                },
                {
                  id: 'rifle',
                  icon: <Crosshair />,
                  name: 'AR-2 Assault Rifle',
                  desc: s.owned[1] ? 'EQUIPPED — 2 KEY' : '30 rounds / Full-Auto / 2 KEY',
                  price: 800,
                },
                {
                  id: 'rpg',
                  icon: <Target />,
                  name: 'RPG-7 Rocket Launcher',
                  desc: s.owned[3]
                    ? 'EQUIPPED — 4 KEY'
                    : '1 rocket / 600 blast damage / 4 KEY',
                  price: 4000,
                },
                {
                  id: 'sniper',
                  icon: <Target />,
                  name: 'SR-3 Sniper Rifle',
                  desc:
                    s.owned[2]
                      ? 'EQUIPPED — 3 KEY'
                      : '5 rounds / Bolt-Action / 5x Scope / Piercing / 3 KEY',
                  price: 1100,
                },
                {
                  id: 'katana',
                  icon: <Swords />,
                  name: 'Katana — Melee Upgrade',
                  desc: s.katana
                    ? 'INSTALLED — V: KATANA'
                    : 'Replaces V / Longer reach & power',
                  price: 1000,
                },
                {
                  id: 'pouch',
                  icon: <Package />,
                  name: 'Ammo Pouch — Capacity Upgrade',
                  desc: s.pouch
                    ? 'INSTALLED — +50% RESERVE / +2 GRENADES'
                    : '+50% reserve / +2 grenade capacity / Full ammo & grenade refill',
                  price: 1000,
                },
                {
                  id: 'upgrade',
                  icon: <ArrowUpRight />,
                  name: 'Weapon Upgrade',
                  desc:
                    s.level >= 2
                      ? 'MAX LEVEL'
                      : '+35% all weapon damage (Up to Lv.2, except explosive)',
                  price: 1000 + s.level * 1000,
                },
                {
                  id: 'grenade',
                  icon: <Target />,
                  name: 'Frag Grenade',
                  desc:
                    s.grenades >= s.maxGrenades
                      ? `MAX CAPACITY (${s.maxGrenades})`
                      : `Carrying ${s.grenades}/${s.maxGrenades} / Add +1`,
                  price: 50,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  className="shop-item"
                  disabled={
                    s.cash < item.price ||
                    (item.id === 'rifle' && s.owned[1]) ||
                    (item.id === 'rpg' && s.owned[3]) ||
                    (item.id === 'sniper' && s.owned[2]) ||
                    (item.id === 'katana' && s.katana) ||
                    (item.id === 'g18c' && s.g18c) ||
                    (item.id === 'pouch' && s.pouch) ||
                    (item.id === 'upgrade' && s.level >= 2) ||
                    (item.id === 'health' && s.medicalKits >= MEDICAL_KIT.max) ||
                    (item.id === 'armor' && s.armor >= s.maxArmor) ||
                    (item.id === 'ammo' && s.ammoFull) ||
                    (item.id === 'grenade' && s.grenades >= s.maxGrenades)
                  }
                  onClick={() => engine.current?.buy(item.id)}
                >
                  {item.icon}
                  <div>
                    <b>{item.name}</b>
                    <small>{item.desc}</small>
                  </div>
                  <strong>₡ {item.price}</strong>
                </button>
              ))}
            </div>
            <div className="shop-bottom">
              <span>{s.message || 'Take your time to resupply'}</span>
              <Button
                className="deploy-button"
                onClick={() => engine.current?.nextWave()}
              >
                {(s.debugTargetWave === 7 || s.wave === 6)
                  ? 'FACE FINAL BOSS'
                  : s.debugTargetWave !== undefined
                  ? `START WAVE ${s.debugTargetWave}`
                  : 'NEXT WAVE'}
                <ArrowUpRight />
              </Button>
            </div>
          </section>
        </div>
      )}
      {(s.mode === 'dead' || s.mode === 'won') && (
        <div className="modal-scrim">
          <section className="result-card">
            <span className="eyebrow">
              {s.mode === 'won' ? 'EXTRACTION COMPLETE' : 'SIGNAL LOST'}
            </span>
            <h2>{s.mode === 'won' ? 'SURVIVED.' : 'MISSION FAILED.'}</h2>
            <p>
              {s.mode === 'won' ? (
                <>
                  Hans Volter eliminated. The foundry is secured.
                  <br />
                  Press <kbd>F8</kbd> on the title screen to access Debug Mode and start from any wave.
                </>
              ) : (
                'The quarantine zone claims another soul.'
              )}
            </p>
            <div className="result-stats">
              <div>
                <b>
                  {s.wave}
                  <small>/7</small>
                </b>
                <span>WAVE</span>
              </div>
              <div>
                <b>{s.kills}</b>
                <span>KILLS</span>
              </div>
              <div>
                <b>
                  {Math.floor(s.time / 60)}:
                  {String(Math.floor(s.time % 60)).padStart(2, '0')}
                </b>
                <span>TIME</span>
              </div>
            </div>
            {s.mode === 'won' ? (
              <Button
                className="deploy-button"
                onClick={() => engine.current?.toMenu()}
              >
                RETURN TO TITLE
                <ArrowUpRight />
              </Button>
            ) : (
              <>
                <Button className="deploy-button" onClick={start}>
                  DEPLOY AGAIN
                  <ArrowUpRight />
                </Button>
                <Button
                  className="quiet-button"
                  onClick={() => engine.current?.toMenu()}
                >
                  RETURN TO TITLE
                </Button>
              </>
            )}
          </section>
        </div>
      )}
      <div className="mobile-warning">
        Playable with PC keyboard and mouse.
      </div>
    </main>
  );
}

'use client';
import { memo, useMemo, useSyncExternalStore } from 'react';
import { Heart, Shield, Skull } from 'lucide-react';
import { MEDICAL_KIT, type Snapshot } from '@/lib/game';
import type { GameUiStore } from '@/lib/game-ui-store';
import type { HansAction } from '@/lib/hans';

type Props = { store: GameUiStore };
const bossActions: Record<HansAction, string> = {
  approach: 'PURSUING', 'rifle-windup': 'RIFLES READY — TAKE COVER', rifle: 'DUAL MKb42 FIRE',
  'gas-windup': 'GAS GRENADES — KEEP MOVING', 'dash-windup': 'DASH INCOMING', dash: 'SPRINTING',
  'leap-windup': 'CLAW LEAP — DODGE SIDEWAYS', leap: 'CLAW ATTACK', recover: 'RECOVERING',
  stunned: 'CHARGE DEPLETED — DAMAGE ×1.5',
};

function useHud<K extends keyof Snapshot>(store: GameUiStore, keys: readonly K[]) {
  const selection = useMemo(() => store.select(keys), [store, keys]);
  return useSyncExternalStore(store.subscribe, selection.getSnapshot, selection.getServerSnapshot);
}

const damageKeys = ['hurt'] as const;
export const DamageOverlay = memo(function DamageOverlay({ store }: Props) {
  const { hurt } = useHud(store, damageKeys);
  return <div className="damage" style={{ opacity: hurt * 0.7 }} />;
});

const scopeKeys = ['scoped'] as const;
const ScopeOverlay = memo(function ScopeOverlay({ store }: Props) {
  const { scoped } = useHud(store, scopeKeys);
  return scoped ? (
    <div className="scope-overlay" aria-hidden="true">
      <div className="scope-lens">
        <i className="scope-reticle" />
        <span>SR-3 / 5×</span>
      </div>
    </div>
  ) : null;
});

const waveKeys = ['wave', 'remaining'] as const;
const WavePanel = memo(function WavePanel({ store }: Props) {
  const s = useHud(store, waveKeys);
  return (
    <div className="wave-panel">
      <span className="eyebrow">SURVIVE THE NIGHT</span>
      <div>
        {s.wave === 7 ? 'BOSS' : 'WAVE'} <b>{String(s.wave).padStart(2, '0')}</b>
        <small> / 07</small>
      </div>
      <p><Skull size={15} /> {s.remaining} REMAINING</p>
    </div>
  );
});

const bossKeys = ['boss'] as const;
const BossPanel = memo(function BossPanel({ store }: Props) {
  const { boss } = useHud(store, bossKeys);
  if (!boss) return null;
  return (
    <div className={`boss-panel ${boss.action === 'stunned' ? 'boss-stunned' : ''}`} aria-label="Hans Volter status">
      <div className="boss-heading"><b>{boss.name}</b><span>PHASE {boss.phase} / 3</span></div>
      <div className="boss-health" role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={boss.maxHealth} aria-valuenow={Math.ceil(boss.health)}>
        <i style={{ width: `${boss.health / boss.maxHealth * 100}%` }} />
      </div>
      <div className="boss-charge-label"><span>CHARGE {Math.ceil(boss.energy)}%</span><span>{Math.ceil(boss.health).toLocaleString()} HP</span></div>
      <div className="boss-charge" role="progressbar" aria-label="Boss charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.ceil(boss.energy)}>
        <i style={{ width: `${boss.energy}%` }} />
      </div>
      <p>{bossActions[boss.action]}</p>
    </div>
  );
});

const cashKeys = ['cash', 'kills'] as const;
const CashPanel = memo(function CashPanel({ store }: Props) {
  const s = useHud(store, cashKeys);
  return <div className="cash-panel"><span>CREDITS</span><b>₡ {s.cash.toLocaleString()}</b><small>{s.kills} KILLS</small></div>;
});

const aimKeys = ['hit', 'aiming', 'scoped'] as const;
const Crosshair = memo(function Crosshair({ store }: Props) {
  const s = useHud(store, aimKeys);
  return <div className={`crosshair ${s.hit > 0 ? 'hit' : ''}`} hidden={(s.aiming || s.scoped) && s.hit <= 0}><i /><i /><i /><i /></div>;
});

const messageKeys = ['message'] as const;
const GameMessage = memo(function GameMessage({ store }: Props) {
  const { message } = useHud(store, messageKeys);
  return message ? <div className="game-message" role="status">{message}</div> : null;
});

const reloadKeys = ['reload', 'bolt'] as const;
const ReloadIndicator = memo(function ReloadIndicator({ store }: Props) {
  const s = useHud(store, reloadKeys);
  return s.reload > 0 || s.bolt > 0 ? (
    <div className="reload-indicator">
      {s.reload > 0 ? 'RELOADING' : 'CYCLING BOLT'}
      <div><i style={{ width: `${(1 - (s.reload || s.bolt)) * 100}%` }} /></div>
    </div>
  ) : null;
});

const vitalsKeys = ['health', 'armor', 'maxArmor', 'stamina', 'debugMinHp', 'medicalKits', 'healCooldown', 'grenades'] as const;
const Vitals = memo(function Vitals({ store }: Props) {
  const s = useHud(store, vitalsKeys);
  return (
    <div className="vitals">
      <div className="health-label">
        <Heart size={20} /><b>{Math.ceil(s.health)}</b><span> / 100</span>
        {s.debugMinHp && <span className="debug-minhp-tag">MIN HP 1</span>}
        <Shield size={17} /><strong>{Math.ceil(s.armor)}</strong>
      </div>
      <div className="armor-bar"><i style={{ width: `${Math.min(100, Math.max(0, s.maxArmor > 0 ? (s.armor / s.maxArmor) * 100 : s.armor))}%` }} /></div>
      <div className="health-bar"><i style={{ width: `${s.health}%` }} /></div>
      <div className="stamina-bar"><i style={{ width: `${s.stamina}%` }} /></div>
      <p>
        <kbd>Q</kbd>{' '}
        MEDKIT {s.medicalKits}/{MEDICAL_KIT.max}
        {s.healCooldown > 0 ? ` / ${Math.ceil(s.healCooldown)}s` : ''}
        <span><kbd>G</kbd> × {s.grenades}</span>
      </p>
    </div>
  );
});

const ammoKeys = ['weapon', 'level', 'ammo', 'reserve', 'g18c', 'owned'] as const;
const AmmoPanel = memo(function AmmoPanel({ store }: Props) {
  const s = useHud(store, ammoKeys);
  return (
    <div className="ammo-panel">
      <span>{s.weapon}{s.level > 0 && s.weapon !== 'RPG-7' ? ` +${s.level}` : ''}</span>
      <div><b className={s.ammo < 4 ? 'red-text' : ''}>{String(s.ammo).padStart(2, '0')}</b><small>/ {s.reserve}</small></div>
      <p>
        <kbd>1</kbd> {s.g18c ? 'G18C' : 'PISTOL'} <kbd>2</kbd> RIFLE <kbd>3</kbd> SNIPER
        {s.owned?.[3] && <>{' '}<kbd>4</kbd> RPG-7</>}
      </p>
    </div>
  );
});

const hintKeys = ['katana'] as const;
const PlayHint = memo(function PlayHint({ store }: Props) {
  const { katana } = useHud(store, hintKeys);
  return (
    <div className="play-hint">
      RIGHT CLICK: AIM / SCOPE <span>•</span> {katana ? 'V: KATANA' : 'V: MELEE'} <span>•</span>{' '}
      SPACE: JUMP <span>•</span> ESC: PAUSE
    </div>
  );
});

export const CombatHud = memo(function CombatHud({ store }: Props) {
  return <>
    <ScopeOverlay store={store} />
    <WavePanel store={store} />
    <BossPanel store={store} />
    <CashPanel store={store} />
    <Crosshair store={store} />
    <GameMessage store={store} />
    <ReloadIndicator store={store} />
    <Vitals store={store} />
    <AmmoPanel store={store} />
    <PlayHint store={store} />
  </>;
});

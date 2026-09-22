import type { Snapshot } from './game.ts';

function sameValue(key: keyof Snapshot, a: Snapshot[keyof Snapshot], b: Snapshot[keyof Snapshot]) {
  if (Object.is(a, b)) return true;
  if (key === 'owned') {
    const left = a as boolean[], right = b as boolean[];
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  if (key === 'boss' && a && b) {
    const left = a as NonNullable<Snapshot['boss']>, right = b as NonNullable<Snapshot['boss']>;
    return left.name === right.name && left.health === right.health &&
      left.maxHealth === right.maxHealth && left.energy === right.energy &&
      left.phase === right.phase && left.action === right.action;
  }
  return false;
}

function sameMenuSnapshot(a: Snapshot, b: Snapshot) {
  if (a.mode !== b.mode) return false;
  // During combat, the page shell only renders the header; HUD panels subscribe separately.
  if (b.mode === 'playing') {
    return a.difficulty === b.difficulty && a.bgm === b.bgm && Boolean(a.boss) === Boolean(b.boss);
  }
  const equal = (key: keyof Snapshot) => key === 'fps' ||
    (key === 'time' && b.mode !== 'dead' && b.mode !== 'won') || sameValue(key, a[key], b[key]);
  for (const key in a) if (!equal(key as keyof Snapshot)) return false;
  for (const key in b) if (!(key in a) && !equal(key as keyof Snapshot)) return false;
  return true;
}

/** UI-only subscriptions. Game snapshots and their notification frequency stay unchanged. */
export class GameUiStore {
  private readonly initial: Snapshot;
  private current: Snapshot;
  private menu: Snapshot;
  private readonly listeners = new Set<() => void>();

  constructor(initial: Snapshot) {
    this.initial = initial;
    this.current = this.menu = initial;
  }

  publish = (snapshot: Snapshot) => {
    this.current = snapshot;
    for (const listener of this.listeners) listener();
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getMenuSnapshot = () => {
    if (!sameMenuSnapshot(this.menu, this.current)) this.menu = this.current;
    return this.menu;
  };

  getServerSnapshot = () => this.initial;

  select<K extends keyof Snapshot>(keys: readonly K[]) {
    const pick = (snapshot: Snapshot) => {
      const values = {} as Pick<Snapshot, K>;
      for (const key of keys) values[key] = snapshot[key];
      return values;
    };
    const initial = pick(this.initial);
    let selected = initial;
    return {
      getSnapshot: () => {
        if (keys.some((key) => !sameValue(key, selected[key], this.current[key])))
          selected = pick(this.current);
        return selected;
      },
      getServerSnapshot: () => initial,
    };
  }
}

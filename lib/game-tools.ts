import type { BossSnapshot } from './hans.ts';
export type Registry = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
type GamePort = {
  state: {
    boss?: BossSnapshot | null;
    mode: string;
    cash: number;
    wave: number;
    health: number;
    medicalKits: number;
    healCooldown: number;
    armor: number;
    maxArmor?: number;
    grenades?: number;
    maxGrenades?: number;
    difficulty?: string;
    kills: number;
    remaining: number;
    owned: boolean[];
    katana: boolean;
    g18c: boolean;
    pouch: boolean;
    level: number;
  };
  buy: (id: string) => void;
  pause: () => void;
};
export function registerGameTools(game: GamePort, context?: Registry) {
  const lifecycle = new AbortController();
  if (context?.registerTool) {
    const register = (tool: Parameters<Registry['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    };
    register({
      name: 'read_survival_status',
      description:
        'Read the current Astra Floor wave, health, equipment, credits, and final boss health, charge and attack state when present.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({ ...game.state, owned: [...game.state.owned] }),
    });
    register({
      name: 'purchase_survival_supply',
      description:
        'Purchase one item from the between-wave supply shop using the same credits and rules as the game UI. Only available while the shop is open. The health item adds one Medical Kit (maximum 3), consumed with Q to recover 50 HP with a 10-second cooldown.',
      inputSchema: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            enum: [
              'ammo',
              'health',
              'armor',
              'rifle',
              'sniper',
              'rpg',
              'katana',
              'g18c',
              'pouch',
              'upgrade',
              'grenade',
            ],
          },
        },
        required: ['item'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (
          typeof input !== 'object' ||
          input === null ||
          !('item' in input) ||
          typeof input.item !== 'string' ||
          ![
            'ammo',
            'health',
            'armor',
            'rifle',
            'sniper',
            'rpg',
            'katana',
            'g18c',
            'pouch',
            'upgrade',
            'grenade',
          ].includes(input.item)
        )
          throw new Error('Invalid supply item');
        if (game.state.mode !== 'shop')
          throw new Error('The supply shop is not open');
        const before = game.state.cash;
        game.buy(input.item);
        if (game.state.cash === before)
          throw new Error('Insufficient credits or item already full / owned');
        return { purchased: input.item, credits: game.state.cash };
      },
    });
  }
  return () => lifecycle.abort();
}

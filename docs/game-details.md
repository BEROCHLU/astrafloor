# Astra Floor — Detailed Rules & Developer Specifications

English | [日本語](game-details.jp.md) | [Basic Rules](../README.md)

A single-player 3D zombie survival FPS set in an apocalyptic quarantined industrial complex. Earn credits (₡) by eliminating enemies and clearing waves, then use them in the prep shop between waves to purchase and upgrade firearms, armor, and consumables.

## Objectives & Progression

- Eliminating all enemies in a wave clears the wave and fully restores player HP to 100.
- On both Normal and Hard difficulties, clearing Waves 1–6 awards **₡250 + (Wave Number × ₡50)**. Players advance from the victory screen into the preparation shop (Hard skips Wave 1 combat and starts directly in the Wave 2 shop).
- The shop has no timer. Press **NEXT WAVE** to begin the next wave.
- On both difficulties, clearing Wave 6 opens a preparation shop, leading into Wave 7 against the **Final Boss**. Defeating the boss wins the run. You lose when HP drops to 0.
- Credits, owned weapons, upgrade levels, ammunition, armor, grenades, and Medical Kits carry over between waves. Only HP automatically restores upon wave completion.
- There is no save feature. Refreshing the browser, retrying, or returning to the title resets the session and all purchases.

The game is designed exclusively for PC keyboard and mouse.

## Difficulties & Starting Gear

| Setting | Normal Mode | Hard Mode |
|---|---|---|
| Starting Point | Wave 1 combat | Cleared Wave 1 shop; NEXT WAVE deploys to Wave 2 |
| Starting Credits | ₡500 | ₡2,000 |
| HP / Maximum | 100 / 100 | 100 / 100 |
| Armor / Maximum | 100 / 100 | 100 / 100 |
| Starting Weapon | H1 SERVICE PISTOL | H1 SERVICE PISTOL |
| Pistol Mag / Reserve | 12 / 48 | 12 / 48 |
| Medical Kits / Capacity | 3 / 3 | 3 / 3 |
| Grenades / Initial Capacity | 3 / 3 | 3 / 3 |
| Enemy HP & Damage Modifier | 1.0× | 1.35× |
| Enemy Movement Speed Modifier | 1.0× | 1.10× |

Hard mode also features higher enemy spawn frequency. Total enemy counts per wave are as follows (Freshpounds are included in these totals):

| Wave | Normal | Hard |
|---|---|---|
| 1 | 9 Zods | Skipped (starts cleared) |
| 2 | 12 Zods | 24 Zods |
| 3 | 15 Zods | 30 Zods |
| 4 | 18 Zods | 36 Zods |
| 5 | 21 Zods | 42 Zods |
| 6 | 24 Zods | 48 Zods |
| 7 | Final Boss (1) | Final Boss (1) |

On both difficulties, each advancing wave increases base Zod HP multiplier by **+0.1** and speed multiplier by **+0.045**:  
$$\text{Enemy HP} = \text{Base HP} \times (1 + (\text{Wave} - 1) \times 0.1) \times \text{Difficulty Multiplier}$$

The Final Boss has dedicated fixed statistics and does not scale with regular wave or difficulty multipliers.

## Controls

### Keybindings

| Action | Key / Input |
|---|---|
| Toggle Debug Panel (Title screen only) | F8 |
| Move | W / A / S / D |
| Look / Aim | Mouse movement |
| Fire Weapon | Left click |
| Aim Down Sights (ADS) | Right click (hold) |
| Sprint | Left Shift |
| Jump | Space |
| Reload | R |
| Handgun / Assault Rifle / Sniper Rifle / RPG-7 | 1 / 2 / 3 / 4 (owned weapons only) |
| Melee Attack | V (replaced by Katana once purchased) |
| Throw Grenade | G |
| Use Medical Kit | Q |
| Pause | Esc / Pause button |
| Advance from Wave Clear Screen | Space / Enter |

Sprinting consumes stamina (20/s drain, 20/s recovery when not sprinting, maximum 100). Sprinting is unavailable while aiming down sights. Mouse lock engages upon starting combat; pressing Esc releases the pointer and pauses combat. Choose **RESUME COMBAT** to unpause or **RETURN TO TITLE** to quit.

## Health, Armor & Medical Kits

Maximum HP and Armor are both 100 across all difficulties. Armor absorbs 100% of incoming damage within its remaining capacity; any remaining damage reduces HP.

- **Wave Clear**: Restores HP to 100. Medical Kits are neither used nor replenished automatically.
- **Q-Key Healing**: Consumes 1 Medical Kit to heal 50 HP (capped at 100).
- **10-Second Cooldown**: After using a kit, you must wait 10 seconds before using another. The cooldown only elapses during active combat; it pauses during pause and shop states.
- **Capacity & Resupply**: Starts at 3/3 kits. Additional kits cost ₡50 each in the shop up to the cap of 3.

## Firearms, Aiming & Recoil

| Weapon | Acquisition | Mag / Reserve | Base Damage | Fire Rate / Reload |
|---|---|---|---|---|
| H1 SERVICE PISTOL | Starting gear | 12 / 48 | 24 | 0.24 s / 1.35 s |
| G18C MACHINE PISTOL | ₡750 shop upgrade | 33 / 132 | 22 | 0.068 s / 1.35 s |
| AR-2 ASSAULT RIFLE | ₡800 shop purchase | 30 / 120 | 30 | 0.095 s / 1.9 s |
| SR-3 SNIPER RIFLE | ₡1,100 shop purchase | 5 / 18 | 150 | 1.1 s / 2.5 s |
| RPG-7 | ₡4,000 shop purchase | 1 / 7 | 600 blast | 0.9 s / 2.4 s |

H1, SR-3, and RPG-7 fire semi-automatically per click. AR-2 and G18C fire continuously while holding left click (tapping allows single shots). Purchasing the G18C permanently replaces the handgun on key 1. Headshots deal **3.0× damage**. SR-3 bullets penetrate up to 3 enemies.

### Recoil & Aiming Down Sights

Hip fire incurs bullet spread (especially significant with the SR-3). Holding right click engages iron sights on H1, G18C, and AR-2, or an approximately 5× scope on SR-3. Scoped SR-3 shots have zero spread. Each fired round kicks the view pitch and yaw upwards and sideways; **aim does not automatically return down**, requiring active manual mouse compensation.

### SR-3 Bolt Action

After each shot, the player lowers the optic and cycles the bolt for ~1.1 seconds. Switching weapons cannot bypass the bolt cycle. If the magazine is emptied, the bolt cycle is omitted, allowing immediate reload.

### RPG-7 Rocket Launcher

Rockets fly straight at **60 m/s** without ballistic gravity drop. Detonates upon hitting an enemy, wall, or floor, or after 2.0s of flight. A direct hit to an enemy's head deals **3.0× direct headshot damage (1,800)** with dedicated audio feedback. Automatically initiates reload after firing when reserve rockets are available. Exploding near the player inflicts distance-attenuated self-damage (up to 75, absorbed by armor, blocked by cover).

## Melee Attacks & Katana

| V-Key Attack | Base Damage | Reach | Attack Interval | Traits |
|---|---|---|---|---|
| Standard Melee | 42 | 2.9 m | 0.65 s | Blunt bash; useful for finishing weak Zods |
| Katana | 100 | 3.9 m | 0.80 s | Flat horizontal fan sweep slicing multiple forward targets |

Purchasing the Katana for ₡1,000 permanently replaces the V melee attack for the run.
- **Motion & Collision**: Draws on the left and sweeps across the crosshair in a completely flat horizontal fan arc from left to right, striking multiple enemies within 3.9m. Blocked by solid walls.
- **Firing Exclusivity**: Automatic firearm shooting is temporarily suspended during a Katana swing and automatically resumes when the swing finishes.

## Frag Grenades

Throw with `G`. Bounces off walls and floors, detonating **1.0 second** after leaving the hand.
- Blast radius: 7.0 m with distance attenuation. Blocked by solid cover.
- **Self-Damage**: Deals up to 75 self-damage if caught in the 7m blast (absorbed 100% by armor, blocked by cover).
- Capacity: 3 grenades (expandable to 5 via Ammo Pouch). Refill costs ₡50 per grenade.

## Shop Catalog

| Item | Price | Effect |
|---|---|---|
| Ammo Resupply | ₡100 | Refills loaded and reserve gun ammunition |
| Medical Kit | ₡50 | Adds 1 kit (up to 3). Heals 50 HP with Q (10s cooldown) |
| Body Armor | ₡150 | Restores armor to 100 on every difficulty |
| G18C | ₡750 | Replaces handgun with 33-round full-auto machine pistol |
| AR-2 | ₡800 | Purchases and equips assault rifle on key 2 |
| SR-3 | ₡1,100 | Purchases and equips sniper rifle on key 3 |
| RPG-7 | ₡4,000 | Purchases and equips rocket launcher on key 4 |
| Katana | ₡1,000 | Permanently upgrades V melee to 3.9m horizontal fan sweep |
| Ammo Pouch | ₡1,000 | +50% reserve ammo cap, +2 grenade capacity. Fully refills all ammo and grenades upon purchase |
| Weapon Upgrade | ₡1,000 / ₡2,000 | Max 2 tiers. Adds +35% base damage to bullets and melee per tier (Lv. 1: 1.35×, Lv. 2: 1.70×, except explosive) |
| Frag Grenade | ₡50 | Adds 1 grenade (max 3, or 5 with Ammo Pouch) |

### Ammo Pouch Upgrade

- **Reserve Capacity Boost**: Increases reserve ammunition limits by +50% across all weapons:
  - **H1**: 48 → 72 rounds
  - **G18C**: 132 → 198 rounds
  - **AR-2**: 120 → 180 rounds
  - **SR-3**: 18 → 27 rounds
  - **RPG-7**: 7 → 11 rockets
- **Grenade Storage**: Expands maximum grenade capacity from 3 to 5.
- **Immediate Refill**: Instantly tops off all weapon magazines, reserve ammunition, and grenades to their boosted caps upon purchase. Subsequent Ammo Resupply (₡100) refills up to these boosted caps.
- **One-time Purchase**: Costs ₡1,000; cannot be bought again once installed.

### Weapon Upgrade

- **Tiers & Pricing**:
  - **Tier 1 (Lv. 1)**: ₡1,000 (+35% damage, **1.35×** base damage)
  - **Tier 2 (Lv. 2)**: ₡2,000 (+70% damage, **1.70×** base damage)
  - Maximum 2 tiers. Upon reaching Lv. 2, the shop item displays `MAX LEVEL` and disables further purchases.
- **Damage Formula**:
  $$\text{Hit Damage} = \text{Base Weapon Damage} \times (1 + \text{Level} \times 0.35) \times (\text{Headshot} \, ? \, 3.0 : 1.0)$$
- **Applicability**:
  - **Firearms**: Increases direct bullet damage for H1 (24 → 32.4 → 40.8), G18C (22 → 29.7 → 37.4), AR-2 (30 → 40.5 → 51.0), and SR-3 (150 → 202.5 → 255.0).
  - **Melee**: Increases damage for both default blunt bash (42 → 56.7 → 71.4) and the Katana (100 → 135 → 170).
  - **Headshots**: Multiplies directly with the 3.0× headshot multiplier (e.g., SR-3 headshots deal 450 at Lv. 0, ~608 at Lv. 1, and 765 at Lv. 2).
  - **Explosives**: Does **not** apply to RPG-7 rocket blast damage or Frag Grenade blast damage (area-of-effect explosive damage remains fixed).

## Enemies (Waves 1–6)

| Enemy | First Wave | Base HP | Base Damage | Bounty | Combat Traits & Behavior |
|---|:---:|:---:|:---:|:---:|---|
| Clot | 1 | 65 | 10 | ₡65 | Basic shambler; easily dispatched with headshots. |
| Crawler | 1 | 60 | 9 | ₡55 | Low-profile crawling torso; aim low. |
| Gorefast | 2 | 90 | 10 | ₡85 | High running speed armed with a right-arm blade. |
| Bloat | 2 | 130 | 12 | ₡110 | Spits 3 bile projectiles (20 m/s) at 3–19m after 0.8s telegraph. |
| Scrake | 3 | 1,000 | 30 | ₡130 | Chainsaw horizontal swing with 4.1m reach. Kite with sprint. |
| Husk | 3 | 240 | 28 | ₡160 | Cannon glows orange for 0.9s, then fires 60 m/s fireball (4–27m range). |
| Siren | 4 | 150 | 20 DPS | ₡120 | Emaciated scream specialist. Radiates a 9.0m acoustic shockwave dealing armor-piercing damage directly to health. Blocked by solid walls and cover. |
| Freshpound | 5 | 3,000 | 42 | ₡450 | Dual drills (3.0m reach). Every 10s, flashes chest core red, roars 1s, then charges at 10× speed for 3s. |

### Siren: Acoustic Area Denial

Appears in Waves 4–6 (Normal: 2 / 3 / 4, Hard: 2 / 4 / 4).
- **Spawn Substitution**: Replaces standard wave slots in round-robin rotational order: **Bloat → Husk → Scrake → Other (Clot/Gorefast/Crawler)**. If a targeted category is unavailable, falls back to another available slot while strictly protecting Freshpounds.
- **Scream Mechanics**: When within 9.0m of the player, Siren halts navigation and winds up for 0.3s (unhinging her jaw and exposing a pulsating red throat), then unleashes a 1.5s sustained scream followed by a 3.0s cooldown.
- **Armor Bypass**: Screams inflict 20 DPS (Normal: 30 total) / 27 DPS (Hard: 40.5 total, using the standard enemy damage multiplier of 1.35) in 0.25s ticks directly to player HP, completely ignoring body armor.
- **Line of Sight & Cover**: Blocked by solid walls and cover obstacles, and cannot reach players elevated above 3.4m. Breaking line of sight immediately halts damage even during an active scream. Multiple Sirens stack damage additively. Has no melee strike attack.

### Final Boss: Wave 7

Clearing Wave 6 awards ₡550 and opens the shop before the dedicated Final Boss fight. The boss has **12,000 fixed HP** and no additional minion spawns.

| Action | Mechanics & Counterplay |
|---|---|
| Super Leap Slash | Triggers up to 25m. After 0.7s telegraph, leaps up to 25–28m (29m max flight, 22–33 m/s speed, 3.5m apex). Slashes 3.5m radius for 30 / 34 / 38 damage. Sidestep or break line of sight. Stopped by solid walls |
| Toxic Gas Grenades | Winds up for 1.0s and throws 2 green canisters (3 in Phase 3). Detonates after 1.4s, dealing 24 / 30 / 36 DPS in a 4.2m radius for 6.0s. Non-stacking; blocked by cover |
| Dual Heavy Burst Fire | 32m range. 0.85s telegraph followed by alternating ~2.4s burst (5 dmg per bullet, 80 m/s). Directly tracks player; requires concrete cover |
| Tactical Dash | 0.5s telegraph, 0.65s dash at 18 / 19.8 / 21.6 m/s to close distance or flank sideways |
| Energy Depletion | Starts at 100 energy (-1/s drain, costs for actions). Reaching 0 triggers a **4.0-second shutdown stun** where **incoming damage is increased by 1.5×** |

Phases: Phase 1 (>65% HP), Phase 2 (≤65% HP), Phase 3 (≤30% HP).

## Debug Mode (`F8`)

Press **F8** on the title screen to toggle the debug deployment panel (disabled during combat).
- **Select Starting Wave**: Wave 1 to 7 (Wave 7 deploys to the Final Boss preparation shop).
- **Starting Credits**: Default ₡20,000, adjustable in ₡10,000 increments with `[RESET]` button.
- **Prevent Death (Min HP 1)**: Clamps health at 1 HP to prevent dying from any damage source.
- **Pre-Wave Shop**: Always opens a `WAVE 0N PREPARATION` shop before combat.

---

## Technical Architecture

All 3D geometry, PBR textures, and audio assets are synthesized procedurally in browser memory without external binary downloads.

- **Frontend & Rendering**: React 19, Next.js 15+ App Router, Vite 8 via [vinext](https://github.com/cloudflare/vinext)
- **3D Graphics**: Three.js (`r185`), procedural canvas PBR maps, instanced mesh and scenery batching
- **Audio Engine**: Web Audio API (real-time procedural oscillator, noise buffer, and dynamic biquad filtering synthesis)
- **Deployment**: Cloudflare Workers / Sites via `@cloudflare/vite-plugin` and Wrangler

### Directory Structure

```
astrafloor/
├── app/
│   ├── layout.tsx         # Root HTML layout and metadata
│   ├── page.tsx           # Game Canvas, HUD overlay, Shop & Pause UI
│   └── globals.css        # Cyber-industrial HUD styles & retro scanline theme
├── components/
│   └── ui/                # UI components
├── docs/
│   ├── game-details.md    # Canonical developer reference & full specifications (English)
│   └── game-details.jp.md # Detailed rules and specifications (Japanese)
├── lib/
│   ├── game.ts            # Game engine, loop, entities, physics, audio & economy
│   ├── graphics.ts        # Procedural 3D weapon, projectile, and environment models
│   ├── h1-model.ts        # H1 Service Pistol procedural 3D model
│   ├── ar2-model.ts       # AR-2 Assault Rifle procedural 3D model
│   ├── sniper-model.ts    # SR-3 Sniper Rifle procedural 3D model
│   ├── rpg-model.ts       # RPG-7 Rocket Launcher procedural 3D model
│   ├── hans.ts            # Final boss AI state machine and attacks
│   ├── hans-model.ts      # Final boss 3D procedural character rig
│   ├── siren.ts           # Siren AI, acoustic scream, and spawn substitution
│   ├── siren-model.ts     # Siren procedural 3D character model
│   ├── freshpound-model.ts # Freshpound dual-drill 3D model
│   ├── bloat-model.ts     # Bloat enemy 3D model
│   ├── enemy-materials.ts # Shared procedural Zod PBR textures & materials
│   ├── recoil.ts          # Physical weapon recoil and camera kick mathematics
│   └── game-tools.ts      # WebMCP protocol tool schemas
├── tests/                 # Automated test suite (140 unit tests)
│   ├── game.test.mjs
│   ├── enemies-melee.test.mjs
│   ├── enemy-materials.test.mjs
│   ├── grenades.test.mjs
│   ├── recoil.test.mjs
│   ├── graphics.test.mjs
│   ├── audio.test.mjs
│   ├── hans.test.mjs
│   ├── katana-motion.test.mjs
│   ├── rpg.test.mjs
│   └── siren.test.mjs
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md              # Canonical English project documentation
└── README.jp.md           # Japanese localized documentation
```

---

## Verification & Testing

```bash
# Start local dev server
npm run dev

# Run all 140 automated unit tests
npm test

# TypeScript typecheck
npx tsc --noEmit

# Production bundle build
npm run build
```

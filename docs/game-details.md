# Astra Floor — Detailed Rules & Developer Specifications

English | [日本語](game-details.jp.md) | [Basic Rules](../README.md)

A single-player 3D zombie survival FPS set in an apocalyptic quarantined industrial complex. Earn credits (₡) by eliminating enemies and clearing waves, then use them in the prep shop between waves to purchase and upgrade firearms, armor, and consumables.

The implementation is the source of truth: [game engine](../lib/game.ts), [Siren](../lib/siren.ts), [Hans Volter](../lib/hans.ts), and [UI](../app/page.tsx). The specifications below describe the current code.

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
| Regular-Enemy HP & Damage Modifier | 1.0× | 1.35× |
| Regular-Enemy Movement Speed Modifier | 1.0× | 1.10× |

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

Regular-enemy speed is `base speed × (1 + (wave − 1) × 0.045) × difficulty speed modifier`. Damage is `base damage × difficulty multiplier` and does not increase with the wave. After the first spawn (1s), spawn intervals are `max(0.42, 1.5 − wave × 0.13)` seconds on Normal and `max(0.32, Normal interval × 0.75)` on Hard.

The Final Boss has dedicated fixed statistics (15,000 HP Normal / 20,000 HP Hard) and does not scale with regular wave multipliers.

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

Movement speeds are 3.7 m/s walking, 6.2 m/s sprinting, and 2.3 m/s aiming. Jumping retains horizontal obstacle collision. The pause menu keeps the game view visible while combat is frozen. The music button toggles BGM; the speaker button mutes all audio. BGM continues during pause and shop screens.

## Health, Armor & Medical Kits

Maximum HP and Armor are both 100 across all difficulties. Armor absorbs incoming damage within its remaining capacity; any remaining damage reduces HP. Siren screams bypass armor and damage HP directly.

- **Wave Clear**: Restores HP to 100. Medical Kits are neither used nor replenished automatically.
- **Q-Key Healing**: Consumes 1 Medical Kit to heal 50 HP (capped at 100).
- **8-Second Cooldown**: After using a kit, you must wait 8 seconds before using another. The cooldown only elapses during active combat; it pauses during pause and shop states.
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

Held automatic fire stops at an empty magazine; press R or click again to reload if reserve ammunition remains. Ammo is tracked independently per weapon slot.

### Recoil & Aiming Down Sights

Hip fire incurs bullet spread (especially significant with the SR-3). Holding right click engages iron sights on H1, G18C, AR-2, and RPG-7, or an approximately 5× scope on SR-3. Scoped SR-3 shots have zero spread. Each fired round kicks the view pitch and yaw upwards and sideways; **aim does not automatically return down**, requiring active manual mouse compensation. G18C angular recoil and model kickback are 20% greater than AR-2. Weapon-model sway and kickback settle automatically; ADS reduces them and the muzzle flash.

### SR-3 Bolt Action

After each shot with rounds remaining, the player lowers the optic and cycles the bolt for ~1.1 seconds. Switching weapons preserves the unfinished cycle, which resumes when the SR-3 is equipped again. Holding right click returns to the scope afterward; pressing R during the cycle queues a reload. If the magazine is emptied, the bolt cycle is omitted, allowing immediate reload.

### RPG-7 Rocket Launcher

Rockets fly straight at **60 m/s** without ballistic gravity drop. They detonate upon hitting an enemy, wall, or floor, or after 2.0s of flight (120m travel). The RPG automatically reloads after firing, or when equipped empty, if reserve rockets remain.

The blast affects enemies within 7m, with damage `600 × (1 − distance / 9)`, measured from the blast to the enemy's position plus 1m in height. A direct head impact multiplies only that enemy's blast damage by **3.0×** (up to 1,800 before distance attenuation), with headshot audio and HUD feedback. Direct head impacts are accepted even when low cover blocks the ray to the body center; ordinary splash is blocked by cover. There is no additional direct-impact damage, and weapon upgrades do not affect the blast. Hans's stunned vulnerability applies once.

Self-damage within 7m is `round(75 × (1 − player distance / 7))`, blocked by cover and absorbed by armor first. Pause freezes rocket flight and lifetime; leaving combat removes active rockets.

## Melee Attacks & Katana

| V-Key Attack | Base Damage | Reach | Attack Interval | Traits |
|---|---|---|---|---|
| Standard Melee | 42 | 2.9 m | 0.65 s | Blunt bash; useful for finishing weak Zods |
| Katana | 100 | 3.9 m | 0.80 s | Flat horizontal fan sweep slicing multiple forward targets |

Purchasing the Katana for ₡1,000 permanently replaces the V melee attack for the run.
- **Motion & Collision**: Draws on the left and sweeps across the crosshair in a completely flat horizontal fan arc from left to right, striking multiple enemies within 3.9m. Blocked by solid walls.
- **Hit Timing**: Damage is resolved once when V starts the attack. The visual sweep does not add repeated hits.
- **Firing Exclusivity**: Automatic firearm shooting is temporarily suspended during a Katana swing and automatically resumes when the swing finishes.

## Frag Grenades

Throw with `G`. Bounces off walls and floors, detonating **1.0 second** after leaving the hand.
- Throw animation: 0.55s, with release at 0.20s. Initial velocity is the aim direction ×15 m/s plus 2.8 m/s upward; gravity is 12 m/s². Firing, melee, ADS, and weapon switching are restricted during the throw.
- Enemy blast damage within 7m: `300 × (1 − distance / 9)`, blocked by solid cover.
- **Self-Damage**: `round(75 × (1 − player distance / 7))` within 7m, absorbed by available armor first and blocked by cover.
- Capacity: 3 grenades (expandable to 5 via Ammo Pouch). Refill costs ₡50 per grenade.
- Pause freezes the throw animation, flight, and fuse. Weapon upgrades do not affect grenade damage.

## Shop Catalog

| Item | Price | Effect |
|---|---|---|
| Ammo Resupply | ₡100 | Refills loaded and reserve gun ammunition |
| Medical Kit | ₡50 | Adds 1 kit (up to 3). Heals 50 HP with Q (8s cooldown) |
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
- **Immediate Refill**: Instantly tops off all weapon magazines, reserve ammunition, and grenades to their boosted caps upon purchase. Subsequent Ammo Resupply (₡100) refills ammunition; grenades are replenished separately for ₡50 each.
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

HP and damage in the table are base values. Wave and difficulty scaling apply to regular-enemy HP and speed; only difficulty scaling applies to damage. Bloat's listed damage is its melee damage; each bile projectile deals 65% of that value (7.8 on Normal or 10.53 on Hard).

| Enemy | First Wave | Base HP | Base Damage | Bounty | Combat Traits & Behavior |
|---|:---:|:---:|:---:|:---:|---|
| Clot | 1 | 65 | 10 | ₡65 | Basic shambler; easily dispatched with headshots. |
| Crawler | 1 | 60 | 9 | ₡55 | Low-profile crawling torso; aim low. |
| Gorefast | 1 | 90 | 10 | ₡85 | High running speed armed with a right-arm blade. |
| Bloat | 2 | 130 | 12 | ₡110 | Spits 3 bile projectiles (20 m/s) at 3–19m after 0.8s telegraph. |
| Scrake | 3 | 1,000 | 30 | ₡130 | Chainsaw horizontal swing with 3.9m reach. Kite with sprint. |
| Husk | 3 | 240 | 28 | ₡160 | Cannon glows orange for 0.9s, then fires 60 m/s fireball (4–27m range). |
| Siren | 4 | 150 | 20 DPS | ₡120 | Emaciated scream specialist. Radiates a 8.7m acoustic shockwave dealing armor-piercing damage directly to health. Blocked by solid walls and cover. |
| Freshpound | 5 | 3,000 | 42 | ₡450 | Dual drills (3.0m reach). Every 10s, flashes chest core red, roars 1s, then charges at 10× speed for 3s. |

### Scrake: Near-Death Rage

Normal chainsaw attacks raise, sweep, and recover over about 0.3s. Melee retains 30 base damage, a 1.15s attack interval, and 3.9m reach.

When damage leaves a living Scrake at or below 10% of its maximum HP at spawn, including wave and difficulty scaling, it immediately enrages without a windup. Lethal damage kills it without triggering rage. Rage lasts until death, with no timeout, and pursuit speed becomes 3.5× its normal speed, including wave and difficulty scaling.

The enraged Scrake uses existing obstacle avoidance and keeps pursuing within melee range, limiting movement at contact distance to avoid passing through the player. It leans forward, runs, and continuously swings its chainsaw broadly from side to side, including while held at contact distance. Damage remains independent of the animation: the existing attack interval, reach, cover checks, and height checks still apply, with no additional hits per visual swing. Pausing freezes movement, attacks, and animation; resuming preserves rage. This behavior is independent of Freshpound rage.

### Freshpound: Periodic Charge

Normal drill attacks reach 3.0m. After 10s of normal movement, Freshpound flashes its chest core and winds up for 1s before charging at 10× its scaled normal speed for up to 3s. The direction locks at the end of the windup; it pushes other enemies aside and stops on cover, a player hit, or timeout. Charge hits check a 2.8m horizontal range. The 10s timer restarts afterward and freezes while paused.

Both difficulties include one Freshpound at the start of Wave 5, and two in Wave 6 (the opening spawn and the midpoint).

### Siren: Acoustic Area Denial

Appears in Waves 4–6 (Normal: 2 / 3 / 4, Hard: 2 / 4 / 4).
- **Spawn Substitution**: Replaces standard wave slots in round-robin rotational order: **Bloat → Husk → Scrake → Other (Clot/Gorefast/Crawler)**. If a targeted category is unavailable, falls back to another available slot while strictly protecting Freshpounds.
- **Scream Mechanics**: When the player is within 8.7m and reachable by the scream, Siren halts navigation and winds up for 0.3s, then unleashes a 1.5s sustained scream followed by a 3.0s cooldown. It keeps its position during windup and screaming. During cooldown it stays still while the player remains reachable; otherwise it can resume pursuit. The red area effect reuses the same effect implementation as Hans's green gas.
- **Armor Bypass**: Screams inflict 20 DPS (Normal: 30 total) / 27 DPS (Hard: 40.5 total, using the standard enemy damage multiplier of 1.35) in 0.25s ticks directly to player HP, completely ignoring body armor.
- **Line of Sight & Cover**: Blocked by solid walls and cover obstacles, and cannot reach a player whose camera is above 3.4m. Breaking line of sight stops accumulating new damage; exposure already accumulated is applied on the next 0.25s tick or at the end of the scream. Windup and scream timers continue even if the player leaves the area. Multiple Sirens stack damage additively. Has no melee strike attack.

### Final Boss: Wave 7

Clearing Wave 6 awards ₡550 and opens the shop before the dedicated Final Boss fight. The boss has **15,000 HP (Normal) / 20,000 HP (Hard)** and no additional minion spawns.

| Action | Mechanics & Counterplay |
|---|---|
| Super Leap Slash | Selected at under 3m, or on the fourth action-selection slot at up to 25m. After 0.7s windup, follows a locked direction for a distance-dependent 0.26–0.88s leap (3.8–29m travel, 1.1–3.5m apex). Speed is travel distance / duration. A 3.5m horizontal claw check deals 30 / 34 / 38 damage once per leap, subject to height and cover checks. Sidestep or use cover; backpedaling can still be caught |
| Toxic Gas Grenades | Winds up for 1.0s and throws 2 green canisters (3 in Phase 3). Detonates after 1.4s, dealing 24 / 30 / 36 DPS in a 4.2m radius for 6.0s. Non-stacking; blocked by cover |
| Dual Heavy Burst Fire | Selected within 32m. 0.85s windup followed by a 2.4s alternating burst of up to 18 / 20 / 22 bullets, at 0.125 / 0.110 / 0.095s intervals. Each bullet deals 5 damage at 80 m/s. Tracks the current player position with slight random spread; bullets stop at cover |
| Tactical Dash | 0.5s telegraph, 0.65s dash at 18 / 19.8 / 21.6 m/s to close distance or flank sideways |
| Energy Depletion | Starts at 100 energy and drains 1/s; firing costs 18, gas 22, dash 12, and leap 20. At 0, finishes the current action before a **4.0-second stun** with **incoming damage ×1.5**, then restores energy to 100 |

Phases: Phase 1 (>65% HP), Phase 2 (≤65% HP), Phase 3 (≤30% HP).

Pursuit speeds are 6.24 / 6.48 / 6.72 m/s across the three phases. Rifle and gas damage use the boss's dedicated values on both difficulties; the regular-enemy ×1.35 damage multiplier is not applied. Overlapping gas clouds use the highest applicable damage rather than adding together, and gas damage is absorbed by armor.

## Debug Mode (`F8`)

Press **F8** on the title screen to toggle the debug deployment panel (disabled during combat).
- **Difficulty**: Select Normal or Hard; the initial wave selection is Wave 1.
- **Select Starting Wave**: Wave 1 to 7 (Wave 7 deploys to the Final Boss preparation shop).
- **Starting Credits**: The UI defaults to ₡15,000 and uses a slider from ₡0–30,000 in ₡1,000 steps.
- **Prevent Death (Min HP 1)**: Clamps health at 1 HP to prevent dying from any damage source.
- **Pre-Wave Shop**: Always opens a `WAVE 0N PREPARATION` shop before combat.

The engine's `Game.start()` API separately clamps `debugCash` to ₡0–999,000 and defaults to ₡20,000 when omitted. Those API defaults are not the title screen's slider settings. The title version label is stored directly in `app/page.tsx`, independently of `package.json`.

---

## Technical Architecture

Models and much of the scenery are generated in code. Floor, wall, and enemy textures and background music are bundled files loaded from the game's own server.

- **Frontend & Rendering**: React 19.2, Vite 8, and vinext's Next.js-compatible App Router. The runtime dependency is `vinext`; Next.js is not installed as an application dependency.
- **3D Graphics**: Three.js (`r185`), generated geometry, merged model parts, and instanced scenery batches. Floor and wall materials load 2048×2048 albedo, normal, and roughness maps from `public/textures/environment/`; enemies load shared maps from `public/textures/enemies/`. Procedural 128–256px `DataTexture` maps provide fallback materials. See [environment texture credits](../public/textures/environment/README.md).
- **Audio Engine**: Web Audio API synthesizes combat effects and voices using oscillators, noise buffers, filters, and a compressor. `public/audio/zombgm.ogg` supplies looping BGM through the same master audio bus.
- **Deployment**: Cloudflare Workers via `@cloudflare/vite-plugin` and Wrangler. The Sites plugin is included when `DEPLOY_TARGET` is not `cloudflare`. [Production CI](../.github/workflows/deploy-cloudflare.yml) builds with `DEPLOY_TARGET=cloudflare` and deploys `dist/server/wrangler.json`. Pushes changing only Markdown, MDX, or `docs/` are skipped; manual execution remains available on `main`.

### Resource Preparation & Performance

- `Game.prepareResources()` runs once per game instance before normal or debug deployment. It caches all six weapon models, compiles their shader variants using the game scene, and uploads buffers and textures via a 32×32 offscreen render. Render state is restored and the temporary target is disposed, including on failure. `INITIALIZING...` remains visible until preparation succeeds; errors prevent deployment. H1 and G18C share finish materials and grain textures, while equipped models have independent transforms.
- A 61×61 navigation grid caches static passability and reuses its queue and distance buffer. Checks retain the 0.55s interval; exploration is skipped while the player's rounded cell and obstacle data are unchanged. Rebuilding the world invalidates the cache.
- A 2m enemy spatial grid limits separation and Freshpound push candidates to nine nearby cells, retaining enemy-array order and updating membership after movement, pushes, and death.
- HUD panels subscribe to only the snapshot values they display through `GameUiStore` and `useSyncExternalStore`. Snapshot publication remains roughly every 0.06s; unrelated time or FPS changes do not rerender the whole page.
- Rendering uses `requestAnimationFrame`, with no custom 90 FPS cap. Pixel ratio is limited to 1.75 and the directional shadow map is 2048×2048.

### Directory Structure

```
astrafloor/
├── app/
│   ├── layout.tsx         # Root HTML layout and metadata
│   ├── page.tsx           # Game initialization, title, debug, shop, and pause UI
│   └── globals.css        # Cyber-industrial HUD styles & retro scanline theme
├── components/
│   ├── game-hud.tsx       # Independently subscribed HUD panels
│   └── ui/button.tsx      # Shared Button component
├── docs/
│   ├── game-details.md    # Developer reference and specifications (English)
│   └── game-details.jp.md # Detailed rules and specifications (Japanese)
├── lib/
│   ├── game.ts            # Game engine, loop, entities, physics, audio & economy
│   ├── graphics.ts        # Procedural 3D weapon, projectile, and environment models
│   ├── game-ui-store.ts   # Snapshot selection and UI subscriptions
│   ├── navigation.ts      # Cached navigation grid and reusable search buffers
│   ├── enemy-spatial-grid.ts # Nearby-enemy lookup and membership updates
│   ├── weapon-preparation.ts # Weapon shader and GPU resource preparation
│   ├── environment-materials.ts # Bundled floor/wall PBR maps and fallback materials
│   ├── environment-details.ts # Floor and wall surface details
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
│   ├── enemy-materials.ts # Bundled enemy maps and shared fallback materials
│   ├── recoil.ts          # Physical weapon recoil and camera kick mathematics
│   ├── game-tools.ts      # WebMCP protocol tool schemas
│   └── utils.ts           # UI class-name utility
├── public/
│   ├── audio/zombgm.ogg   # Bundled background music
│   └── textures/          # Enemy and environment texture maps
├── tests/                 # Automated test suite
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
│   ├── siren.test.mjs
│   ├── environment-materials.test.mjs
│   ├── navigation.test.mjs
│   ├── enemy-spatial-grid.test.mjs
│   └── weapon-preparation.test.mjs
├── .github/workflows/deploy-cloudflare.yml # Production deployment
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md              # English project documentation
└── README.jp.md           # Japanese localized documentation
```

---

## Verification & Testing

Requires Node.js `>=22.13.0` and npm. The scripts are defined in [package.json](../package.json). Open the URL printed by the development server (default `http://localhost:3000`), wait for weapon preparation, and select **DEPLOY**. Normal begins combat; Hard opens the Wave 2 preparation shop first.

```bash
# Start local dev server
npm run dev

# Run the automated test suite
npm test

# TypeScript typecheck
npx tsc --noEmit

# Production bundle build
npm run build

# Preview the built Worker locally (after a successful build)
npm start
```

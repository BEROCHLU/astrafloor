# Astra Floor

English | [日本語](README.jp.md)

> A fast-paced, single-player 3D zombie survival FPS running natively in modern web browsers with zero external asset downloads.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-black.svg)](https://threejs.org/)
[![Vite / vinext](https://img.shields.io/badge/Build-Vite%20%2F%20vinext-646cff.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-136%20passed-brightgreen.svg)](#automated-test-suite)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Controls & Mechanics](#controls--mechanics)
- [Weapons & Arsenal Specs](#weapons--arsenal-specs)
- [Shop & Economy System](#shop--economy-system)
- [Difficulty Modes & Debug Tools](#difficulty-modes--debug-tools)
- [Enemies & Wave Structure](#enemies--wave-structure)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Setup & Development](#setup--development)
- [Documentation Links](#documentation-links)

---

## Overview

**Astra Floor** is a hardcore wave-based 3D zombie survival first-person shooter set in an apocalyptic quarantined industrial complex. Face unrelenting waves of mutated bio-monsters known as "Zeds", earn credits (₡) through kills and wave survival, upgrade your firearms, armor, and gear in the prep shop between waves, and ultimately face off against the final mechanical horror: **Hans Volter** in Wave 7.

The game is designed around tight keyboard-and-mouse FPS fundamentals: movement shooting (strafe-aiming), precise recoil control, evasive sprint dashes, tactical melee swiping, grenade zoning, and methodical resource management.

---

## Key Features

- **Pure Browser-Native 3D FPS**  
  Runs smoothly inside standard web browsers via **Three.js** and **React 19 / vinext** without installing client binaries, plugins, or extensions.
- **100% In-Memory Procedural Assets**  
  3D weapon models, environmental architecture, mutant body geometry, and 128–256px PBR texture sets (albedo, normal, roughness) are synthesized dynamically in memory at startup. No massive external texture packs or multi-megabyte 3D asset downloads.
- **Pure Web Audio API Sound Synthesis**  
  Every sound effect—explosive gunshots, crisp sniper bolt mechanisms, rocket thrusters and detonations, bullet impacts, ricochets, monster growls, Hans Volter's mechanical voice and telegraphs—is synthesized in real-time using Web Audio oscillators, noise buffers, biquad filters, and master dynamic compressors.
- **Authentic FPS Recoil & Gunplay**  
  True recoil mechanics: each fired round kicks the camera pitch and yaw upwards and sideways. **The crosshair does not automatically snap back down.** Players must manually compensate with the mouse. Headshots deal **3.0× lethal damage** across all firearms and direct rocket strikes.

---

## Controls & Mechanics

### Keybindings

| Action | Key / Input | Notes |
|---|---|---|
| **Movement** | `W` `A` `S` `D` | Omnidirectional combat movement |
| **Look / Aim** | `Mouse` | Pointer-locked aim with manual recoil compensation |
| **Fire Weapon** | `Left Click` | Semi-auto or full-auto depending on equipped weapon |
| **Aim Down Sights (ADS)** | `Right Click` (Hold) | Tighter bullet spread, reduced recoil kick, 5× sniper optic |
| **Sprint** | `Left Shift` | 20 stamina/s drain; unavailable while ADS |
| **Jump** | `Space` | Obstacle hopping and evasive maneuvering |
| **Reload** | `R` | Reloads current weapon magazine |
| **Weapon Selection** | `1` `2` `3` `4` | `1`: Handgun/G18C, `2`: Assault Rifle, `3`: Sniper Rifle, `4`: RPG-7 |
| **Melee Attack** | `V` | Standard blunt hit (42 dmg) / Katana sweep (110 dmg) |
| **Throw Frag Grenade** | `G` | Throws primed grenade with 1.0s fuse after release |
| **Use Medical Kit** | `Q` | Instantly heals 50 HP (10s combat cooldown, holds up to 3) |
| **Pause Menu** | `Esc` | Releases pointer lock, freezes combat & projectiles |
| **Wave Clear Advance** | `Space` / `Enter` | Proceeds from wave-cleared results screen to the shop |
| **Debug Settings Panel** | `F8` | Title screen only; jump to any wave, set credits, toggle min HP |

### Core Survival Mechanics

- **HP & Armor**  
  Maximum HP is **100** and maximum Body Armor is **100** on both difficulties. Body armor absorbs **100% of incoming damage** until completely depleted; only damage exceeding the remaining armor reduces HP.
- **Wave Clear Healing**  
  Clearing a wave fully restores HP to 100. Armor, ammunition, medical kits, and grenades do NOT replenish automatically—they must be purchased in the shop.
- **Stamina System**  
  Sprinting drains stamina at **20/s**. Releasing sprint restores stamina at **20/s** up to the **100** maximum. Sprinting is disabled while aiming down sights.
- **Medical Kits (`Q`)**  
  Each kit immediately restores 50 HP (up to the 100 maximum). Features a strict **10-second cooldown** between uses. The cooldown only elapses during active combat (frozen while paused or in the shop). You start with 3 kits and can hold a maximum of 3.
- **Frag Grenades (`G`)**  
  Pressing `G` winds up and launches a frag grenade in an arc. It bounces off walls and floors, detonating **1.0 second after release**. The explosion deals heavy blast damage up to **7.0 m**, which attenuates over distance and is blocked by solid cover. Beware: self-damage applies up to 50 within the 7m blast radius!
- **Recoil & Spread**  
  Hip firing incurs high bullet dispersion. Aiming down sights (hold right click) significantly tightens bullet spread. View recoil must be actively countered with manual mouse movement.

---

## Weapons & Arsenal Specs

All firearms feature distinct ballistics, fire rates, reload animations, and sound signatures. Weapon damage upgrades purchased in the shop increase bullet and melee damage by **+35% per tier** (Lv. 1: 1.35×, Lv. 2: 1.70×).

| Weapon | Slot | Acquisition | Mag / Reserve | Base Damage | Fire Rate | Reload | Special Traits |
|---|:---:|---|:---:|:---:|:---:|:---:|---|
| **H1 Service Pistol** | 1 | Starting gear | 12 / 48 *(72)* | 24 | 0.24 s | 1.35 s | Crisp semi-auto; 3.0× headshot multiplier |
| **G18C Machine Pistol** | 1 | Shop upgrade (₡750) | 33 / 132 *(198)* | 22 | 0.068 s | 1.35 s | Rapid full-auto (~882 RPM); replaces handgun slot permanently |
| **AR-2 Assault Rifle** | 2 | Shop purchase (₡800) | 30 / 120 *(180)* | 30 | 0.095 s | 1.9 s | Sustained full-auto; excellent mid-range fire suppression |
| **SR-3 Sniper Rifle** | 3 | Shop purchase (₡1,100) | 5 / 15 *(23)* | 150 | 1.1 s cycle | 2.5 s | 5× scope, zero ADS spread, **penetrates up to 3 targets**, animated bolt-action cycle |
| **RPG-7 Rocket Launcher** | 4 | Shop purchase (₡4,000) | 1 / 7 *(11)* | 600 blast | 0.9 s | 2.4 s | Straight flight @ 60 m/s, **3.0× direct headshot (1,800 dmg)**, **auto-reloads** |
| **Standard Melee** | `V` | Default | — | 42 | 0.65 s | — | 2.9 m reach blunt bash; useful for finishing weak Zeds |
| **Katana** | `V` | Shop upgrade (₡1,000) | — | 110 | 0.6 s | — | **4.2 m reach**, completely flat horizontal fan sweep hitting multiple targets, **110 base damage** |

*(Numbers in parentheses represent boosted reserve capacity after purchasing the Ammo Pouch).*

### Special Ballistics & Firearm Rules

- **SR-3 Bolt Action Mechanism**  
  After each shot, the player lowers the scope and cycles the bolt for ~1.1 seconds. You cannot fire again until the bolt cycle finishes, and switching weapons cannot bypass the delay. If the magazine is completely emptied, the bolt cycle is omitted, allowing immediate reload or dry fire.
- **RPG-7 Rocket Ballistics**  
  Rockets fly straight at **60 m/s** without ballistic gravity drop. They detonate once upon striking an enemy, wall, or floor, or after 2.0 seconds of flight. A direct hit to an enemy's head hitbox scores a **3.0× direct headshot (1,800 damage)** with dedicated audio and HUD feedback. The launcher automatically starts reloading when a reserve rocket is available.

---

## Shop & Economy System

Between waves, players enter the safe **Supply Shop** to rearm and upgrade. The shop has no timer—take all the time you need, then press **NEXT WAVE** (or **FACE HANS VOLTER** before Wave 7).

### Economy Income

- **Zed Bounty**: Killing enemies awards instant credits (Clot: ₡65, Crawler: ₡55, Gorefast: ₡85, Bloat: ₡110, Scrake: ₡130, Husk: ₡160, Freshpound: ₡450, Hans Volter: ₡2,000).
- **Wave Clear Bonus**: Clearing Waves 1–6 awards **₡250 + (Wave Number × ₡50)**. Clearing Wave 6 grants **₡550**.

### Shop Catalog

| Item | Cost | Effect | Limits / Requirements |
|---|:---:|---|---|
| **Ammo Resupply** | ₡100 | Refills loaded magazine and reserve ammunition for all owned guns | Cannot purchase if all ammo is full |
| **Medical Kit** | ₡50 | Adds 1 consumable kit to inventory; heals 50 HP with `Q` (10s cooldown) | Max 3 kits held |
| **Body Armor** | ₡150 | Fully reinforces body armor back to maximum (100) | Max 100 armor; absorbs 100% incoming damage |
| **Frag Grenade** | ₡50 | Adds 1 frag grenade to inventory (1.0s fuse, 7m blast radius) | Max 3 held (max 5 with Ammo Pouch) |
| **G18C Machine Pistol** | ₡750 | Upgrades starting handgun into a 33-round full-auto machine pistol | Permanent 1-slot replacement; one-time buy |
| **AR-2 Assault Rifle** | ₡800 | Unlocks the 30-round automatic assault rifle on key `2` | One-time purchase |
| **SR-3 Sniper Rifle** | ₡1,100 | Unlocks the bolt-action sniper rifle with 5× scope & penetration on key `3` | One-time purchase |
| **RPG-7 Rocket Launcher** | ₡4,000 | Unlocks heavy rocket launcher on key `4` with 600 blast damage | One-time purchase |
| **Katana Melee Upgrade** | ₡1,000 | Permanently upgrades `V` melee to 4.2m horizontal arc slash dealing 110 base dmg | Permanent `V` replacement; one-time buy |
| **Ammo Pouch** | ₡1,000 | Increases all reserve ammo limits by **+50%** and grenade cap by **+2** (to 5). **Instantly refills all ammunition and grenades** | One-time purchase |
| **Weapon Damage Upgrade** | ₡1,000 (Lv.1)<br>₡2,000 (Lv.2) | Adds **+35% base damage** to all bullets and melee attacks per level (Lv.1: 1.35×, Lv.2: 1.70×) | Max Lv. 2; does not affect grenade/rocket blast |

---

## Difficulty Modes & Debug Tools

### Difficulty Modes

| Setting | Normal Mode | Hard Mode |
|---|---|---|
| **Starting Point** | Wave 1 combat | Cleared Wave 1 prep shop (starts directly at Wave 2) |
| **Starting Credits** | ₡500 | ₡2,000 |
| **Starting HP / Max** | 100 / 100 *(starts full)* | 100 / 100 *(starts full)* |
| **Starting Armor / Max** | 100 / 100 *(starts full; historical spec: 50)* | 100 / 100 *(starts full; max 100)* |
| **Starting Grenades / Max** | 3 / 3 *(starts full; max 5 with Ammo Pouch)* | 3 / 3 *(starts full; historical spec: 5; max 5 with Ammo Pouch)* |
| **Starting Ammunition** | 12 / 48 *(starts full)* | 12 / 48 *(starts full)* |
| **Starting Medical Kits** | 3 / 3 *(starts full)* | 3 / 3 *(starts full)* |
| **Starting Loadout** | H1 Service Pistol (12/48), 3 Medkits | H1 Service Pistol (12/48), 3 Medkits |
| **Enemy HP & Damage Multiplier** | 1.0× | 1.35× |
| **Enemy Movement Speed Multiplier** | 1.0× | 1.10× |
| **Enemy Spawn Rate** | Standard | High frequency |

*Note on difficulty balance & resources:*
- **Starting resources**: Both Normal and Hard modes initialize the player with full HP (100), full Armor (100), full firearm ammunition (12 loaded / 48 reserve), full Medical Kits (3/3), and full Frag Grenades (3/3).
- **Design rules vs. latest build**: Earlier rules balanced Normal mode with an Armor cap of 50 and Grenade cap of 3, while Hard mode had an Armor cap of 100 and Grenade cap of 5. In the latest verified codebase and documentation (`docs/game-rules.md`, `docs/dev/dev-rules.md`), Body Armor is standardized at a 100 cap for both difficulties, and Grenades start at a base capacity of 3 for both difficulties, expandable to 5 for either difficulty by purchasing the Ammo Pouch in the shop.

- **Wave Scaling**: On both difficulties, each advancing wave increases base Zed HP multiplier by **+0.1** and speed multiplier by **+0.045**:  
  $$\text{Enemy HP} = \text{Base HP} \times (1 + (\text{Wave} - 1) \times 0.1) \times \text{Difficulty Multiplier}$$
- **Enemy Wave Composition**:
  - **Normal**: Wave 1: 9 Zeds, Wave 2: 12, Wave 3: 15, Wave 4: 18, Wave 5: 21 (incl. 1 Freshpound), Wave 6: 24 (incl. 2 Freshpounds), Wave 7: Hans Volter boss fight.
  - **Hard**: Wave 1: Skipped, Wave 2: 24 Zeds, Wave 3: 30, Wave 4: 36, Wave 5: 42 (incl. 1 Freshpound), Wave 6: 48 (incl. 2 Freshpounds), Wave 7: Hans Volter boss fight.

### Debug Mode (`F8`)

Press **`F8`** on the title screen to toggle the in-game debug deployment panel:
- **Select Starting Wave**: Choose any Wave from 1 to 7 with one click (Wave 7 jumps directly to the Hans Volter encounter).
- **Difficulty Selection**: Switch between Normal and Hard modes.
- **Starting Credits**: Default ₡20,000, adjustable in `[-10k]` / `[+10k]` increments, with a `[RESET]` button.
- **Prevent Death (Min HP 1)**: Optional toggle to prevent player HP from dropping below 1 from any damage source (Zeds, self-explosions, toxic gas), allowing stress-testing encounters.
- **Preparation Shop**: Always opens a `WAVE 0N PREPARATION` shop before combat so you can outfit your customized loadout before deploying.

---

## Enemies & Wave Structure

### Regular Zeds (Waves 1–6)

| Zed | First Wave | Base HP | Base Damage | Bounty | Combat Traits & Counter-tactics |
|---|:---:|:---:|:---:|:---:|---|
| **Clot** | 1 | 65 | 10 | ₡65 | Basic melee shambler; easily eliminated with pistol headshots or melee. |
| **Crawler** | 1 | 60 | 9 | ₡55 | Low-profile upper torso crawling on the ground; aim downward to headshot. |
| **Gorefast** | 2 | 90 | 10 | ₡85 | High running speed armed with a right-arm blade; prioritize before they close distance. |
| **Bloat** | 2 | 130 | 12 | ₡110 | Spits 3 bile acid projectiles (20 m/s) at 3–19m range after a 0.8s telegraph. Strafe laterally. |
| **Scrake** | 3 | 1,000 | 30 | ₡130 | Huge chainsaw-wielding bruiser. 4.2m reach horizontal swing. Kite with sprint and focus fire. |
| **Husk** | 3 | 240 | 28 | ₡160 | Long-range artillery mutant. Cannon muzzle glows orange for 0.9s, then fires a 60 m/s fireball (4–27m range). Use cover. |
| **Freshpound** | 5 | 3,000 | 42 | ₡450 | Dual spinning drill arms (3.0m reach). Every 10s, flashes chest core red, roars for 1s, then **charges at 10× speed for 3s**. Sidestep the charge vector or bait into obstacles. |

---

### Final Boss: Hans Volter (Wave 7)

Clearing Wave 6 unlocks the dedicated boss fight against **Hans Volter**. Hans possesses **12,000 fixed HP** and does not spawn regular Zed minions. Equipment, upgrades, and supplies carry over from the Wave 6 victory shop.

#### Boss Abilities & Mechanics

- **Dual MKb42 Burst Fire (二丁MKb42)**  
  At ranges up to 32 m, Hans telegraphs for 0.85s and unleashes a punishing ~2.4s burst alternating both assault rifles (5 dmg per bullet, 80 m/s velocity). He tracks the player directly—duck behind solid concrete cover!
- **Nerve Gas Grenades (毒ガス)**  
  Hans winds up for 1.0s and throws 2 green toxic gas canisters (3 canisters in Phase 3). Detonates after 1.4s, leaving lingering green poison clouds for 6.0s (4.2m radius). Deals **24 / 30 / 36 DPS** depending on the phase. Damage does not stack; step out of the green radius immediately.
- **Super Leap Slash (スーパーリープ / Long-Range Aerial Leap)**  
  Hans leaps through the air across massive distances (**up to 25–28 m reach**, 29 m flight, 22–33 m/s velocity, 3.5 m arc peak). Slashes a 3.5 m radius for **30 / 34 / 38 damage**. Backpedaling (`S`) will not save you—dodge sideways (`A` / `D`) or break line-of-sight with cover.
- **High-Speed Tactical Dash / Charge (突進)**  
  Telegraphs for 0.5s and dashes for 0.65s at 18–21.6 m/s to rapidly close distance or flank sideways.
- **Energy Depletion & Vulnerability Stun (エネルギー枯渇スタン)**  
  Hans starts with 100 energy, which drains constantly (-1/s) and with actions (Burst: 18, Gas: 22, Dash: 12, Leap: 20). When his energy hits 0, he completes his current action and enters a **4.0-second shutdown stun**. While stunned, **he takes 1.5× bonus damage from all sources**! Afterward, his energy fully recharges to 100.
- **Combat Phases**:
  - **Phase 1** (>65% HP): Standard rotation, 2 gas grenades.
  - **Phase 2** (≤65% HP): Increased movement/dash speed, 30 DPS gas, 34 leap damage.
  - **Phase 3** (≤30% HP): Maximum aggression, throws 3 gas grenades, 36 DPS gas, 38 leap damage.

---

## Tech Stack & Architecture

- **Core Engine & Framework**: React 19, Next.js 15+ App Router, Vite 8 via [vinext](https://github.com/cloudflare/vinext)
- **3D Graphics & Shaders**: Three.js (`r185`), procedural canvas-generated PBR textures, instanced mesh and geometry batching
- **Audio Synthesis**: Web Audio API (real-time procedural audio synthesis, layered noise/sine wave transients, envelope generators, dynamic compressor)
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Runtime / Hosting Target**: Cloudflare Workers / Sites via `@cloudflare/vite-plugin` and Wrangler

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
│   ├── game-rules.md      # Canonical player game rules (English)
│   ├── game-rules.jp.md   # Canonical player game rules (Japanese)
│   └── dev/
│       ├── dev-rules.md   # Comprehensive developer reference (English)
│       └── dev-rules.jp.md# Comprehensive developer reference (Japanese)
├── lib/
│   ├── game.ts            # Game engine, loop, entities, physics, audio & economy
│   ├── graphics.ts        # Procedural 3D weapon, projectile, and environment models
│   ├── hans.ts            # Hans Volter boss AI state machine and attacks
│   ├── hans-model.ts      # Hans Volter 3D procedural character rig
│   ├── enemy-materials.ts # Shared procedural Zed PBR textures & materials
│   ├── recoil.ts          # Physical weapon recoil and camera kick mathematics
│   └── game-tools.ts      # WebMCP protocol tool schemas
├── tests/                 # Automated test suite (136 unit tests)
│   ├── game.test.mjs
│   ├── enemies-melee.test.mjs
│   ├── grenades.test.mjs
│   ├── recoil.test.mjs
│   ├── graphics.test.mjs
│   ├── audio.test.mjs
│   ├── hans.test.mjs
│   └── rpg.test.mjs
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md              # Canonical English project documentation
└── README.jp.md           # Japanese localized documentation
```

---

## Setup & Development

### Requirements

- **Node.js**: `>= 22.13.0`
- **Package Manager**: `npm`

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/username/astrafloor.git
cd astrafloor
npm install
```

### Running Locally

Start the local development server with Vite / vinext:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser, click the screen to lock the mouse pointer, and begin combat!

### Automated Test Suite

Run the full automated test suite (136 unit tests covering game rules, combat balance, ballistics, recoil, boss state machine, and audio synthesis):

```bash
npm test
```

### Type Checking & Production Build

Verify TypeScript types and build the production bundle:

```bash
# Type check without emitting files
npx tsc --noEmit

# Build production bundle (SSR, RSC, client chunks, and Cloudflare Worker)
npm run build
```

---

## Documentation Links

For deeper design decisions and specifications, consult the reference documents:

- **Player Rules**: [English](docs/game-rules.md) | [日本語](docs/game-rules.jp.md)
- **Developer Reference**: [English](docs/dev/dev-rules.md) | [日本語](docs/dev/dev-rules.jp.md)

---

## License

Private / Proprietary. All rights reserved.

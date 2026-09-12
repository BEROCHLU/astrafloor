# Astra Floor — Detailed Rules and Development Reference

[日本語](dev-rules.jp.md) | English | [Player rules](../game-rules.md)

A single-player 3D FPS about surviving zombie attacks in a quarantined industrial zone. Earn credits (₡) by killing enemies and clearing waves, then spend them on weapons, upgrades, and supplies.

## Progression, Victory, and Defeat

- Eliminate every enemy in a wave to clear it and fully restore your HP to 100.
- On both Normal and Hard, clearing Waves 1–6 awards **₡250 + wave number × ₡50**. Proceed from the results screen to the shop. Hard starts with Wave 1 already cleared, skipping its combat.
- The shop has no time limit. Press **NEXT WAVE** to begin the next wave.
- On both difficulties, a shop visit follows Wave 6. Defeat the final boss, **Hans Volter**, in Wave 7 to win. Reaching 0 HP ends the game in defeat.
- Credits, purchased equipment, upgrade levels, ammunition, armor, grenades, and remaining Medical Kits carry over between waves. Only HP is automatically restored on a wave clear.
- There is no save feature. Reloading the page, retrying, or returning to the title resets your progress and purchases.

The game requires a PC keyboard and mouse. The in-game UI is in English. Multiplayer and touch controls are not supported.

## Difficulty and Starting Equipment

| Setting | Normal | Hard |
|---|---|---|
| Starting point | Wave 1 combat | Shop after Wave 1 is already cleared; NEXT WAVE starts Wave 2 |
| Starting credits | ₡500 | ₡2,000 |
| HP / maximum | 100 / 100 | 100 / 100 |
| Armor / maximum | 100 / 100 | 100 / 100 |
| Starting weapon | H1 SERVICE PISTOL | H1 SERVICE PISTOL |
| Pistol loaded rounds / reserve | 12 / 48 | 12 / 48 |
| Medical Kits / capacity | 3 / 3 | 3 / 3 |
| Grenades / initial capacity | 3 / 3 | 3 / 3 |
| Enemy HP and attack damage multiplier | 1× | 1.35× |
| Enemy movement speed multiplier | 1× | 1.1× |

Enemies also spawn more frequently on Hard. Each wave contains the following number of enemies, including any Freshpounds.

| Wave | Normal | Hard |
|---|---|---|
| 1 | 9 | Combat skipped; starts already cleared |
| 2 | 12 | 24 |
| 3 | 15 | 30 |
| 4 | 18 | 36 |
| 5 | 21 | 42 |
| 6 | 24 | 48 |
| 7 | Hans Volter only | Hans Volter only |

On both difficulties, each successive wave increases the base enemy HP multiplier by 0.1 and the base movement speed multiplier by 0.045. Enemy HP is calculated as: **base HP × (1 + (wave number − 1) × 0.1) × difficulty multiplier**.

Hans Volter uses separate fixed stats. Regular enemy wave and difficulty multipliers do not apply to him.

## Controls

### Debug Settings Panel

Press **F8** on the title screen to toggle the debug settings panel. This shortcut is disabled during combat. Choose a difficulty (Normal or Hard), starting wave (Waves 1–7, with Hans Volter in Wave 7), and starting credits (default ₡20,000, adjustable in ₡10,000 steps with a RESET option to restore ₡20,000). You start in the **PREPARATION SHOP** immediately before the selected wave. Normal progression resumes once combat begins. See “Debug Mode (F8)” for details.

### Key Bindings

| Action | Key / input |
|---|---|
| Toggle debug settings panel (title screen only) | F8 |
| Move | W / A / S / D |
| Look | Move the mouse |
| Fire | Left click |
| Aim down sights (ADS) | Hold right click |
| Sprint | Left Shift |
| Jump | Space |
| Reload | R |
| Handgun / assault rifle / sniper rifle | 1 / 2 / 3 (purchased weapons only) |
| Melee attack | V (replaced by a slash after purchasing the Katana) |
| Throw grenade | G |
| Use Medical Kit | Q |
| Pause | Esc / pause button at the top of the screen |
| Proceed from the wave-clear screen to the shop | Space / Enter |

Sprinting consumes 20 stamina per second. Stamina regenerates at 20 per second when not sprinting, up to a maximum of 100. You cannot sprint while aiming. Starting the game locks the mouse pointer; releasing it with Esc pauses the game. Choose **RESUME COMBAT** to resume or **RETURN TO TITLE** to return to the title screen. The audio button at the top of the screen toggles mute.

## HP, Armor, and Medical Kits

Maximum HP and armor are both 100 on every difficulty. Armor absorbs 100% of incoming damage until it runs out; only the remaining damage reduces HP.

- **Wave clear:** Fully restores HP to 100. Medical Kits are neither consumed nor replenished.
- **Healing with Q:** Consumes one Medical Kit and restores 50 HP, up to 100 HP.
- **10-second cooldown:** After using a kit, you must wait 10 seconds before using another, even if you have kits left. The cooldown advances during combat and stops while paused or in the shop. Holding the key does not repeatedly consume kits.
- **Starting amount and capacity:** Start with three kits on every difficulty and carry up to three.
- **Resupply:** Purchase a Medical Kit in the shop for ₡50 to add one to your inventory. Buying a kit does not heal you immediately.
- **Purchase requirements:** You cannot buy a kit when carrying three. You can buy one at full HP if you have fewer than three kits.
- **Use requirements:** Kits can only be used during combat. No kit is consumed and no healing occurs at full HP, with no kits remaining, or during the cooldown.

The HUD's **Q MEDKIT** display shows your current kit count, capacity, and remaining cooldown in seconds.

## Guns, Aiming, and Recoil

Damage values below are base values before upgrades. Reserve capacities are listed without an Ammo Pouch.

| Weapon | Acquisition | Magazine / reserve capacity | Base damage | Shot interval / reload time |
|---|---|---|---|---|
| H1 SERVICE PISTOL | Starting equipment | 12 / 48 | 24 | 0.24 s / 1.35 s |
| G18C MACHINE PISTOL | Replaces the handgun for ₡750 | 33 / 132 | 22 | 0.068 s / 1.35 s |
| AR-2 ASSAULT RIFLE | Purchase for ₡800 | 30 / 120 | 30 | 0.095 s / 1.9 s |
| SR-3 SNIPER RIFLE | Purchase for ₡1,100 | 5 / 15 | 150 | 1.1 s / 2.5 s |
| RPG-7 | Purchase for ₡4,000 | 1 / 7 | 600 explosive | 0.9 s / 2.4 s |

The H1, SR-3, and RPG-7 fire once per click. The AR-2 and G18C fire automatically while holding left click; a brief click can also fire a single shot. Purchasing the G18C replaces your handgun for the remainder of the run. It still uses weapon key 1.

Gun headshots deal 3.0× damage. SR-3 bullets can penetrate up to three enemies. Bullets are stopped by cover.

### Aiming and Recoil

Hip fire has bullet spread, with especially high spread when firing the SR-3 without its scope. Hold right click to use iron sights on the H1, G18C, and AR-2, or an approximately 5× scope on the SR-3. Aiming reduces spread and recoil; scoped SR-3 shots have no random spread.

Each shot adds vertical and horizontal recoil to your view. **Your aim does not automatically return to its original position when you stop firing.** Control recoil with the mouse. G18C recoil is 20% stronger than AR-2 recoil. The weapon model's kickback and sway do return automatically.

### SR-3 Bolt Action

After each shot, you lower the scope and cycle the bolt for approximately 1.1 seconds. You cannot fire again until this finishes, and switching weapons cannot bypass it. Holding right click returns you to the scope afterward. Pressing R during the bolt cycle queues a reload when the cycle finishes. If the magazine becomes empty, no bolt cycle occurs; reloading or dry firing is immediately possible.

### RPG-7 Rockets

Purchasing the RPG-7 for ₡4,000 equips it immediately. You can then switch to it during combat with **key 4**. It holds one loaded rocket and seven reserve rockets (11 with an Ammo Pouch). It has no scope, bolt action, or penetration. Firing automatically starts a reload if reserve ammunition is available.

- Rockets travel straight along your aim at 60 m/s, without gravity. They explode once upon hitting an enemy, wall, or ground, or after two seconds of flight.
- Base explosion damage against enemies is 600, twice that of a grenade. It uses the same radius of less than 7 m, damage falloff of **base damage × (1 − distance / 9)**, and cover checks as grenades.
- A direct rocket hit to an enemy's head counts as a headshot. Only that enemy takes 3.0× damage (up to 1,800), with a dedicated headshot sound and HEADSHOT indicator. Nearby enemies caught only in the blast take normal explosion damage.
- There is no separate direct bullet damage, and shop damage upgrades do not apply. Hans's increased damage taken while stunned still applies.
- Self-damage is the same as for grenades: up to 50 within a radius of less than 7 m, reduced by distance and subject to cover and armor.
- Pausing stops both flight and the detonation timer. Active rockets are removed when victory or defeat is determined, when entering the shop, when returning to the title, or when retrying.
- The launcher has a low firing sound and its own recoil, without automatic aim recovery. Ammunition resupply and Ammo Pouch refills also apply to it.

## Melee Attacks and the Katana

| V-key attack | Base damage | Reach | Attack interval |
|---|---|---|---|
| Standard melee | 42 | 2.9 m | 0.65 s |
| Katana | 110 | 4.2 m | 0.6 s |

Purchasing the Katana for ₡1,000 **permanently replaces your V-key attack for the rest of the run**. You cannot switch back to the original melee attack. You can use it while keeping your gun equipped, and it does not add a weapon-switch key. Its wide frontal slash can hit multiple enemies, but cannot pass through cover.

## Grenades

Press G to wind up and throw a grenade in the direction you are aiming. The yellow-banded grenade follows an arc, bounces off the ground and walls, and explodes approximately one second after leaving your hand.

- The explosion damages targets within a radius of less than 7 m. Cover blocks it, and damage decreases with distance.
- Throwing lowers your aim and temporarily restricts shooting, melee attacks, and weapon switching.
- Starting inventory and capacity are three on every difficulty. An Ammo Pouch increases capacity by two, to five on every difficulty. Purchase one grenade in the shop for ₡50.
- Pausing stops flight and the detonation timer.
- Shop damage upgrades do not affect grenades.

## Shop

| Item | Price | Effect |
|---|---|---|
| Ammunition resupply | ₡100 | Refills loaded and reserve gun ammunition |
| Medical Kit | ₡50 | Adds one kit, up to three. Each kit restores 50 HP with Q; 10-second cooldown |
| Body Armor | ₡150 | Restores armor to 100 on every difficulty |
| G18C | ₡750 | Replaces the handgun with a fully automatic machine pistol with a 33-round magazine |
| AR-2 | ₡800 | Purchases and equips the assault rifle |
| SR-3 | ₡1,100 | Purchases and equips the sniper rifle |
| RPG-7 | ₡4,000 | Purchases and equips the rocket launcher; switch with key 4 |
| Katana | ₡1,000 | Upgrades the V-key melee attack |
| Ammo Pouch | ₡1,000 | Increases reserve ammunition capacity for all weapons by 50% and grenade capacity by two. Immediately refills all ammunition and grenades to their new limits. One-time purchase |
| Damage upgrade | ₡1,000 / ₡2,000 | Up to two levels. Each level adds 35% of base damage to bullets and V-key attacks (Lv. 1: 1.35×; Lv. 2: 1.70×). Excludes RPG and grenade explosions |
| Grenade | ₡50 | Adds one grenade. Capacity is three on every difficulty, or five with an Ammo Pouch |

With an Ammo Pouch, reserve capacities are 72 rounds for the H1, 198 for the G18C, 180 for the AR-2, 23 for the SR-3, and 11 for the RPG-7. Purchasing it fills every weapon's magazine and reserve ammunition, as well as grenades, to capacity. Later ammunition resupplies and grenade purchases use the increased limits.

Damage upgrades increase damage to 1.35× and then 1.70× its base value. Purchases are unavailable if you lack credits, already own the equipment, have reached the supply capacity, or have reached the upgrade limit.

## Enemies

HP and attack damage below are base values before wave and difficulty modifiers. “First wave” is the earliest wave in which that enemy type can appear.

| Enemy | First wave | Base HP | Base attack damage | Kill reward | Traits |
|---|---|---|---|---|---|
| Clot | 1 | 65 | 10 | ₡65 | Basic melee enemy |
| Crawler | 1 | 60 | 9 | ₡55 | An upper torso that crawls along the ground |
| Gorefast | 2 | 90 | 10 | ₡85 | Fast movement; attacks with a right-arm blade |
| Bloat | 2 | 130 | 12 | ₡110 | Fires three green vomit projectiles; each deals 65% of base attack damage |
| Scrake | 3 | 1,000 | 30 | ₡130 | Large melee enemy wielding a chainsaw |
| Husk | 3 | 240 | 28 | ₡160 | Ranged enemy with a right-arm cannon |
| Freshpound | 5 | 3,000 | 42 | ₡450 | Rotating drill and periodic high-speed charges |
| Hans Volter | 7 | 12,000 (fixed) | Varies by attack | ₡2,000 | Dual rifles, toxic gas, leaping slashes, and energy depletion |

### Ranged Attacks

- **Bloat:** After an approximately 0.8-second wind-up, fires vomit projectiles at 20 m/s. Firing range is 3–19 m.
- **Husk:** Its muzzle glows orange for approximately 0.9 seconds before firing a fast projectile at 60 m/s. Firing range is 4–27 m.

Both lock their aim during the wind-up, so strafing or using cover can help you evade them.

### Scrake's Chainsaw

The attack reaches 4.2 m. Scrake raises the chainsaw over approximately 0.7 seconds, swings it horizontally, and returns to its stance.

### Freshpound's Charge

Normal drill attacks reach 3.0 m. After 10 seconds of normal behavior, its chest flashes red and it roars for one second, then charges at 10× its normal movement speed for up to three seconds.

The charge direction locks at the end of the roar. Freshpound does not track you during the charge and pushes other enemies out of its path. Its attack range while charging is 2.8 m. The charge ends upon hitting a wall, hitting the player, or reaching its time limit. It then returns to normal behavior for another 10 seconds. Pausing also stops the charge timer.

On both difficulties, one Freshpound appears at the start of Wave 5. Wave 6 has two: one at the start and another midway through.

### Hans Volter: Final Boss

On both difficulties, clearing Wave 6 fully restores HP and awards ₡550. Resupply at the shop, then press **FACE HANS VOLTER** to begin the boss fight. No additional regular enemies spawn. Your equipment, upgrades, and supplies carry over.

Based on the supplied reference design, Hans has pale skin, a black gas mask, glowing green tubes and a chest core, a large back tank, reddish-brown straps, black leg armor, and needle-like claws. He draws two MKb42-style rifles when shooting and holsters them at his hips during other actions.

| Behavior | Mechanics and counterplay |
|---|---|
| Leaping claw attack (long-range leap) | Activates within 25 m, either at melee range below 3 m or in the third slot of his action rotation. Beyond 25 m, he dashes closer. After a 0.7-second wind-up, he makes a large arcing leap with roughly 25–28 m of reach, up to 29 m of travel, a forward speed of 22–33 m/s, and a peak height of approximately 3.5 m. Slash radius is 3.5 m, with only one hit per leap. Damage is 30 / 34 / 38. He lunges toward the position targeted during the wind-up, so simply backing away with S is insufficient; sidestep with A/D or use cover. Walls stop the leap |
| Toxic gas grenades | After a one-second throwing wind-up, throws two green grenades, or three in the final phase. They detonate 1.4 seconds after being thrown. Gas remains for six seconds in a 4.2 m radius, dealing 24 / 30 / 36 damage per second. Move out of the green ground circles. Overlapping gas does not stack, and cover blocks damage |
| Dual MKb42 fire | Range is 32 m. After a 0.85-second wind-up, alternates rifles in an approximately 2.4-second burst. Each bullet deals 5 damage and travels at 80 m/s. He fires accurately at the player's current position, making cover important |
| High-speed movement | A 0.5-second warning precedes a 0.65-second dash at 18 / 19.8 / 21.6 m/s. At long range, he closes the distance; at close range, he dodges sideways. He cannot pass through walls |
| Energy depletion | Starts at 100 energy. Energy drains by 1 per second, with additional costs of 18 for shooting, 22 for gas, 12 for a dash, and 20 for a leap. At zero, he finishes his current attack, then becomes immobile for four seconds and takes 1.5× damage. Afterward, energy recharges to 100 and he resumes fighting |

Values shown in groups of three correspond to phases 1 / 2 / 3. Phase 2 starts at 65% HP or below; phase 3 starts at 30% or below. Later phases increase his firing rate and strengthen melee and gas attacks. The top of the screen shows HP, energy, phase, and attack warnings. Headshots and weapon upgrades remain effective as usual.

Pausing also stops attacks, movement, toxic gas, and grenade timers. Defeating Hans, losing, returning to the title, or retrying removes toxic gas and enemy projectiles.

Hans uses energy consumption and a temporary stun. Grab-and-drain attacks, self-healing, shields, and reinforcement summons are not implemented. HP and attack values are tuned for this game's single-player combat.

## Debug Mode (F8)

Press **F8** on the title screen to toggle the debug settings panel. This shortcut is disabled during combat.

- **Starting wave:**
  - On both NORMAL and HARD, select any wave from 1 to 7 with one click. Wave 7 is the dedicated Hans Volter boss fight.
- **Starting credits:**
  - Default: ₡20,000. Range: ₡0–₡999,000.
  - Use `[-10k]` / `[+10k]` to adjust in increments of ₡10,000, or `[RESET]` to return to ₡20,000.
- **Minimum HP setting (checkbox):**
  - Enable **PREVENT DEATH (MIN HP 1)** to prevent HP from dropping below 1, even when taking damage from enemy attacks, your own explosions, or toxic gas. You can continue fighting without dying or triggering a game over.
- **Pre-wave resupply (PREPARATION SHOP):**
  - Every starting wave, including Wave 1, opens a preparation shop before combat. Its header is `WAVE 0N PREPARATION`.
  - Spend your credits on weapons, ammunition, and armor, then press `START WAVE N` (or `FACE HANS VOLTER` for Wave 7) to begin the selected wave.
  - After combat begins, normal progression continues, including wave-clear rewards, shops before subsequent waves, and victory or defeat.

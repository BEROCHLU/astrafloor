export type RecoilProfile = {
  vertical: number;
  horizontal: number;
  kickback: number;
  ads: number;
};

// Angular kick is in radians; kickback is the first-person model's travel.
// Hip-fire recoil is tuned stronger, while ADS heavily stabilizes aim.
export const RECOIL_PROFILES: readonly RecoilProfile[] = [
  { vertical: 0.05476, horizontal: 0.0142, kickback: 0.162, ads: 0.52 },
  { vertical: 0.054, horizontal: 0.024, kickback: 0.145, ads: 0.7 },
  { vertical: 0.18252, horizontal: 0.02808, kickback: 0.3744, ads: 0.44 },
  { vertical: 0.14, horizontal: 0.022, kickback: 0.32, ads: 0.65 },
];

export const G18C_RECOIL: RecoilProfile = {
  vertical: 0.0648,
  horizontal: 0.0288,
  kickback: 0.174,
  ads: 0.7,
};

export class WeaponRecoil {
  modelYaw = 0;
  private sinceShot = Infinity;
  private burst = 0;
  private profile?: RecoilProfile;

  fire(profile: RecoilProfile, aiming: boolean, random = Math.random()) {
    if (this.sinceShot > 0.3 || this.profile !== profile) this.burst = 0;
    const scale = aiming ? profile.ads : 1;
    const sway = Math.sin(++this.burst * 1.35) * 0.65 + (random - 0.5) * 0.7;
    const kick = { pitch: profile.vertical * scale, yaw: profile.horizontal * scale * sway };
    this.modelYaw = Math.max(-0.0585, Math.min(0.0585, this.modelYaw + kick.yaw));
    this.sinceShot = 0;
    this.profile = profile;
    // The caller adds this kick to the player's aim permanently.
    return kick;
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.sinceShot += dt;
    // Only the weapon model settles. Camera aim never springs back.
    this.modelYaw *= Math.exp(-14 * dt);
  }

  reset() {
    this.modelYaw = this.burst = 0;
    this.sinceShot = Infinity;
    this.profile = undefined;
  }
}

import * as T from 'three';
import type { Graphics } from './graphics.ts';

/** Warm the screen shader variants and GPU buffers without presenting temporary weapons. */
export function prepareWeaponResources(
  graphics: Graphics,
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  camera: T.Camera,
  gun: T.Group,
) {
  const weapons = graphics.preloadWeapons();
  weapons.name = 'Weapon preparation';
  weapons.position.copy(gun.position);
  weapons.traverse((object) => {
    // Include normally hidden moving parts, e.g. the RPG exhaust, without changing templates.
    object.visible = true;
    object.frustumCulled = false;
  });
  const target = new T.WebGLRenderTarget(32, 32);
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousLevel = renderer.getActiveMipmapLevel();
  const gunVisible = gun.visible;
  const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
  const shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
  try {
    // The muzzle light must be present, as it is during gameplay even when its intensity is zero.
    gun.visible = true;
    renderer.setRenderTarget(null);
    // Intentionally synchronous during initialization: no shader polling can outlive dispose().
    renderer.compile(weapons, camera, scene);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(target);
    camera.add(weapons);
    // Shader compilation alone does not upload vertex buffers or texture pixels.
    renderer.render(scene, camera);
  } finally {
    weapons.removeFromParent();
    gun.visible = gunVisible;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
    renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
    target.dispose();
  }
}

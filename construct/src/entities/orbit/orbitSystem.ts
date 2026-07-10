import { type Registry, type RenderPipeline, v3Set, COMPONENT_KEYS, type Transform, type Renderable, type Material } from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructOrbit } from './orbit.ts';
import { type ConstructOrbitOriginMarker } from './orbitOriginMarker.ts';

export const installConstructOrbitSystem = (registry: Registry, pipeline: RenderPipeline) => {
  return registry.addAction('update', (ctx) => {
    const markerEntity = registry.view(CONSTRUCT_KEYS.orbitOriginMarker)[0] ?? null;
    const markerTransform = (markerEntity?.components?.[COMPONENT_KEYS.transform] ?? null) as Transform | null;
    const marker = (markerEntity?.components?.[CONSTRUCT_KEYS.orbitOriginMarker] ?? null) as ConstructOrbitOriginMarker | null;
    const markerRenderable = (markerEntity?.components?.[COMPONENT_KEYS.renderable] ?? null) as Renderable | null;
    const markerMaterial = (markerRenderable?.material ?? null) as Material | null;

    for (const e of registry.view(CONSTRUCT_KEYS.orbit)) {
      const orbit = e.components[CONSTRUCT_KEYS.orbit] as ConstructOrbit | undefined;
      if (!orbit) continue;

      const dx = orbit.pendingDx;
      const dy = orbit.pendingDy;
      const panDx = orbit.pendingPanDx;
      const panDy = orbit.pendingPanDy;
      const wheel = orbit.pendingWheel;
      orbit.pendingDx = 0;
      orbit.pendingDy = 0;
      orbit.pendingPanDx = 0;
      orbit.pendingPanDy = 0;
      orbit.pendingWheel = 0;

      orbit.yawRad -= dx * 0.01;
      orbit.pitchRad += dy * 0.01;
      orbit.pitchRad = Math.max(orbit.minPitchRad, Math.min(orbit.maxPitchRad, orbit.pitchRad));

      if (wheel !== 0) {
        const next = orbit.distance * Math.exp(wheel * 0.0012);
        orbit.distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, next));
      }

      const sinYaw = Math.sin(orbit.yawRad);
      const cosYaw = Math.cos(orbit.yawRad);
      const sinPitch = Math.sin(orbit.pitchRad);
      const cosPitch = Math.cos(orbit.pitchRad);

      const rayX = sinYaw * cosPitch;
      const rayY = sinPitch;
      const rayZ = cosYaw * cosPitch;

      if (panDx !== 0 || panDy !== 0) {
        const fwdX = -rayX;
        const fwdY = -rayY;
        const fwdZ = -rayZ;

        const rightX = fwdZ;
        const rightY = 0;
        const rightZ = -fwdX;
        const rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ) || 1;
        const rnX = rightX / rightLen;
        const rnY = rightY / rightLen;
        const rnZ = rightZ / rightLen;

        const upX = fwdY * rnZ - fwdZ * rnY;
        const upY = fwdZ * rnX - fwdX * rnZ;
        const upZ = fwdX * rnY - fwdY * rnX;

        const panScale = orbit.distance * 0.0022;
        const tx = (rnX * panDx + upX * panDy) * panScale;
        const ty = (rnY * -panDx + upY * panDy) * panScale;
        const tz = (rnZ * panDx + upZ * panDy) * panScale;

        orbit.target[0] += tx;
        orbit.target[1] += ty;
        orbit.target[2] += tz;
      }

      const cx = orbit.target[0] + rayX * orbit.distance;
      const cy = orbit.target[1] + rayY * orbit.distance;
      const cz = orbit.target[2] + rayZ * orbit.distance;

      v3Set(pipeline.camera.position, cx, cy, cz);
      v3Set(pipeline.target, orbit.target[0], orbit.target[1], orbit.target[2]);

      if (markerTransform) {
        markerTransform.position[0] = orbit.target[0];
        markerTransform.position[1] = orbit.target[1];
        markerTransform.position[2] = orbit.target[2];
        markerTransform.dirty = true;
      }

      if (marker && markerMaterial) {
        const moved = dx !== 0 || dy !== 0 || panDx !== 0 || panDy !== 0;

        if (moved) marker.idleSeconds = 0;
        else marker.idleSeconds += ctx.dt;

        const wantsVisible = moved || marker.idleSeconds < marker.fadeOutDelaySeconds;
        const targetAlpha = wantsVisible ? marker.maxAlpha : 0;
        const perSec = wantsVisible ? marker.fadeInPerSecond : marker.fadeOutPerSecond;
        const k = 1 - Math.exp(-perSec * ctx.dt);
        marker.alpha += (targetAlpha - marker.alpha) * k;

        markerMaterial.baseColorFactor[3] = marker.alpha;
      }
    }
  }, 15);
};

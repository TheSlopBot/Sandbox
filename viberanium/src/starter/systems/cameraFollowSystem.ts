import { type Registry } from '../../engine/registry.ts';
import { type Input } from '../../input/input.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type Collider } from '../../components/collider.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';
import { type RenderPipeline } from '../../render/pipeline.ts';
import { aabbIntersects, makeAabb } from '../../collision/aabb.ts';
import { obbIntersectsAabb } from '../../collision/obb.ts';
import { v3Set } from '../../math/vec3.ts';

const MIN_DIST = 1.0;
const GROUND_Y = 0;
const CAM_RADIUS = 0.15;

const wrapTwoPi = (a: number): number => {
  a = a % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
};

export const installCameraFollowSystem = (
  registry: Registry,
  pipeline: RenderPipeline,
  input: Input,
) => {
  registry.addAction('update', (ctx) => {
    const colliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];

    for (const e of registry.view(COMPONENT_KEYS.cameraFollow)) {
      const cf = e.components[COMPONENT_KEYS.cameraFollow] as CameraFollow;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!t) continue;

      const { dx, dy } = input.mouseDelta();
      cf.yawRad = wrapTwoPi(cf.yawRad - dx * cf.mouseSensX);
      const minPitchRad = -Math.PI * 0.5 + cf.minOrbitElevationRad;
      cf.pitchRad = Math.max(minPitchRad, Math.min(cf.maxPitchRad, cf.pitchRad + dy * cf.mouseSensY));

      const sinYaw = Math.sin(cf.yawRad);
      const cosYaw = Math.cos(cf.yawRad);
      const sinPitch = Math.sin(cf.pitchRad);
      const cosPitch = Math.cos(cf.pitchRad);

      const idealDist = cf.distance;
      const pivotX = t.position[0];
      const pivotY = t.position[1] + cf.pivotHeight;
      const pivotZ = t.position[2];

      const rayX = sinYaw * cosPitch;
      const rayY = sinPitch;
      const rayZ = cosYaw * cosPitch;

      let dist = idealDist;

      for (const s of colliders) {
        if (!s.isStatic) continue;
        for (let step = MIN_DIST; step < idealDist; step += 0.25) {
          const tx = pivotX + rayX * step;
          const ty = pivotY + rayY * step;
          const tz = pivotZ + rayZ * step;
          const probe = makeAabb(tx, ty, tz, CAM_RADIUS, CAM_RADIUS, CAM_RADIUS);
          let hit = false;
          if (s.obbY) {
            hit = obbIntersectsAabb(s.obbY, probe);
          } else if (aabbIntersects(probe, s.aabb)) {
            hit = true;
          }
          if (hit) { dist = Math.max(MIN_DIST, step - 0.25); break; }
        }
      }

      if (rayY < 0) {
        const groundT = (GROUND_Y + CAM_RADIUS - pivotY) / rayY;
        if (groundT >= MIN_DIST) dist = Math.min(dist, groundT);
      }

      const k = 1 - Math.exp(-15.0 * ctx.dt);
      cf.currentDist += (dist - cf.currentDist) * k;

      let camX = pivotX + rayX * cf.currentDist;
      let camY = pivotY + rayY * cf.currentDist;
      let camZ = pivotZ + rayZ * cf.currentDist;

      if (camY < GROUND_Y + CAM_RADIUS) camY = GROUND_Y + CAM_RADIUS;

      v3Set(pipeline.camera.position, camX, camY, camZ);
      v3Set(pipeline.target, pivotX, pivotY, pivotZ);
    }
  }, 15);
};

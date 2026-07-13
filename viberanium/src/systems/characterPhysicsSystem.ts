import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Entity } from '../engine/entity.ts';
import { type Transform } from '../components/transform.ts';
import { type Aabb, type Collider } from '../components/collider.ts';
import {
  type CharacterController,
  characterBodyToSolver,
  readCharacterBodyCylinder,
} from '../components/characterController.ts';
import {
  type BodyY,
  applySlideVelocity,
  resolveCylinderMoveAndSlide,
  SLIDE_ACCEL_TIME_SEC,
  SLIDE_INPUT_COYOTE_SEC,
  SLIDE_MAX_SPEED_FACTOR,
  SLIDE_START_SPEED_FACTOR,
} from '../collision/characterCollision.ts';
import { isCollisionBroadphaseDirty } from '../collision/collisionBroadphase.ts';
import { getNearbyObstacles, getObstacles } from './collisionObstacles.ts';
import { readGroundPlaneY } from './readGroundPlaneY.ts';
import { v3Set } from '../math/vec3.ts';

const PHYSICS_STEP_SEC = 1 / 144;
const MAX_PHYSICS_SUBSTEPS = 4;

const _box: Aabb = {
  min: new Float32Array(3),
  max: new Float32Array(3),
};

export type CharacterPhysicsSystemOptions = {
  filter?: (entity: Entity) => boolean;
};

export const installCharacterPhysicsSystem = (
  registry: Registry,
  options?: CharacterPhysicsSystemOptions,
) => {
  const filter = options?.filter;

  registry.addAction(
    'update',
    () => {
      if (!isCollisionBroadphaseDirty()) return;
      getObstacles(registry, [COMPONENT_KEYS.collider]);
    },
    9,
  );

  registry.addAction(
    'update',
    (ctx) => {
      const groundY = readGroundPlaneY(registry);

      for (const e of registry.view(COMPONENT_KEYS.character)) {
        if (filter && !filter(e)) continue;

        const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
        const body = readCharacterBodyCylinder(
          e.components[COMPONENT_KEYS.collider] as Collider | undefined,
        );
        if (!t || !cc || !body) continue;

        const speed2 =
          cc.velocity[0] * cc.velocity[0] +
          cc.velocity[1] * cc.velocity[1] +
          cc.velocity[2] * cc.velocity[2];
        if (speed2 < 1e-10 && cc.onGround && !cc.sliding) continue;

        const solver = characterBodyToSolver(body);
        const queryRadius = Math.max(
          2,
          body.radius * 8 + Math.hypot(cc.velocity[0], cc.velocity[2]) * 0.1,
        );
        const obstacles = getNearbyObstacles(
          registry,
          cc.obstructiveColliderKeys,
          t.position[0],
          t.position[2],
          queryRadius,
        );

        const prevX = t.position[0];
        const prevY = t.position[1];
        const prevZ = t.position[2];

        let physicsRemaining = ctx.dt;
        let substeps = 0;
        while (physicsRemaining > 1e-12 && substeps < MAX_PHYSICS_SUBSTEPS) {
          const step = Math.min(physicsRemaining, PHYSICS_STEP_SEC);
          physicsRemaining -= step;
          substeps += 1;

          if (!cc.onGround && !cc.sliding) {
            cc.velocity[1] -= cc.gravity * step;
          }

          t.position[0] += cc.velocity[0] * step;
          t.position[1] += cc.velocity[1] * step;
          t.position[2] += cc.velocity[2] * step;

          const bodyY: BodyY = {
            x: t.position[0],
            y: t.position[1],
            z: t.position[2],
            radius: solver.radius,
            halfHeight: solver.halfHeight,
          };

          const result = resolveCylinderMoveAndSlide(
            bodyY,
            cc.velocity,
            obstacles,
            groundY,
            cc.floorMaxAngle,
            cc.sliding,
            cc.onGround,
            _box,
          );

          t.position[0] = result.body.x;
          t.position[1] = result.body.y;
          t.position[2] = result.body.z;

          if (result.sliding) {
            const start = cc.moveSpeed * SLIDE_START_SPEED_FACTOR;
            const max = cc.moveSpeed * SLIDE_MAX_SPEED_FACTOR;
            if (!cc.sliding) {
              cc.slideSpeed = start;
            } else {
              const accel = (max - start) / SLIDE_ACCEL_TIME_SEC;
              cc.slideSpeed = Math.min(max, cc.slideSpeed + accel * step);
            }

            cc.sliding = true;
            cc.slideIgnoreInputRemaining = SLIDE_INPUT_COYOTE_SEC;
            cc.onGround = false;
            v3Set(
              cc.groundNormal,
              result.groundNormal[0],
              result.groundNormal[1],
              result.groundNormal[2],
            );
            applySlideVelocity(
              cc.velocity,
              cc.groundNormal[0],
              cc.groundNormal[1],
              cc.groundNormal[2],
              cc.slideSpeed,
            );
          } else {
            cc.sliding = false;
            cc.slideSpeed = 0;
            cc.onGround = result.onGround;
            if (result.onGround) {
              v3Set(
                cc.groundNormal,
                result.groundNormal[0],
                result.groundNormal[1],
                result.groundNormal[2],
              );
            } else {
              v3Set(cc.groundNormal, 0, 1, 0);
            }
          }
        }

        if (
          t.position[0] !== prevX ||
          t.position[1] !== prevY ||
          t.position[2] !== prevZ
        ) {
          t.dirty = true;
        }
      }
    },
    10,
  );
};

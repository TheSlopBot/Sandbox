import {
  type Registry,
  type Collider,
  type Transform,
  type MovementIntent,
  type CharacterController,
  type CombatIntent,
  type NavGrid,
  COMPONENT_KEYS,
  findPath,
  pickRandomObjective,
  v3Set,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { type TestAi } from '../components/testAi.ts';

const WAYPOINT_RADIUS = 0.45;
const OBJECTIVE_MIN_DIST = 3;
const OBJECTIVE_MAX_DIST = 16;
const MAX_REPATHS_PER_FRAME = 8;
const AIM_EPS = 1e-6;

const aimTowardObjective = (
  combat: CombatIntent | undefined,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
) => {
  if (!combat) return;

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  if (dx * dx + dz * dz <= AIM_EPS) return;

  combat.aimYawRad = Math.atan2(dx, dz);
};

const getSceneNavGrid = (registry: Registry): NavGrid | null => {
  for (const e of registry.view(COMPONENT_KEYS.navGrid)) {
    return e.components[COMPONENT_KEYS.navGrid] as NavGrid;
  }

  return null;
};

const assignObjective = (
  ai: TestAi,
  colliders: Collider[],
  grid: NavGrid,
  fromX: number,
  fromZ: number,
): boolean => {
  const objective = pickRandomObjective(
    grid,
    colliders,
    fromX,
    fromZ,
    OBJECTIVE_MIN_DIST,
    OBJECTIVE_MAX_DIST,
  );
  if (!objective) return false;

  ai.target[0] = objective.x;
  ai.target[2] = objective.z;
  const path = findPath(grid, fromX, fromZ, objective.x, objective.z);
  ai.path = path ?? [{ x: objective.x, z: objective.z }];
  ai.pathIndex = 0;
  ai.state = 'navigating';
  return true;
};

const beginPause = (ai: TestAi) => {
  ai.state = 'pausing';
  ai.path = [];
  ai.pathIndex = 0;
  ai.pauseRemaining = ai.pauseMin + Math.random() * (ai.pauseMax - ai.pauseMin);
};

const steerToward = (
  intent: MovementIntent,
  cc: CharacterController,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
) => {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-6) {
    v3Set(intent.desiredVelocity, (dx / dist) * cc.moveSpeed, 0, (dz / dist) * cc.moveSpeed);
  } else {
    v3Set(intent.desiredVelocity, 0, 0, 0);
  }
};

export const installTestAiSystem = (registry: Registry) => {
  registry.addAction(
    'update',
    (ctx) => {
      const grid = getSceneNavGrid(registry);
      if (!grid) return;

      const colliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
      let repathsThisFrame = 0;

      for (const e of registry.view(GAME_COMPONENT_KEYS.testAi)) {
        const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
        const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
        const combat = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
        const ai = e.components[GAME_COMPONENT_KEYS.testAi] as TestAi;
        if (!t || !cc || !intent) continue;

        aimTowardObjective(combat, t.position[0], t.position[2], ai.target[0], ai.target[2]);

        if (ai.state === 'pausing') {
          ai.pauseRemaining -= ctx.dt;
          v3Set(intent.desiredVelocity, 0, 0, 0);
          intent.jumpRequested = false;
          if (ai.pauseRemaining <= 0) {
            ai.pauseRemaining = 0;
            if (repathsThisFrame < MAX_REPATHS_PER_FRAME) {
              if (assignObjective(ai, colliders, grid, t.position[0], t.position[2])) {
                repathsThisFrame++;
              }
            }
          }
          continue;
        }

        if (ai.path.length === 0) {
          if (repathsThisFrame < MAX_REPATHS_PER_FRAME) {
            if (assignObjective(ai, colliders, grid, t.position[0], t.position[2])) {
              repathsThisFrame++;
            }
          }
          if (ai.path.length === 0) {
            v3Set(intent.desiredVelocity, 0, 0, 0);
            intent.jumpRequested = false;
            continue;
          }
        }

        const waypoint = ai.path[ai.pathIndex]!;
        const distToWaypoint = Math.hypot(waypoint.x - t.position[0], waypoint.z - t.position[2]);
        const atLastWaypoint = ai.pathIndex >= ai.path.length - 1;
        const distToObjective = Math.hypot(
          ai.target[0] - t.position[0],
          ai.target[2] - t.position[2],
        );

        if (atLastWaypoint && distToObjective <= ai.objectiveRadius) {
          beginPause(ai);
          v3Set(intent.desiredVelocity, 0, 0, 0);
          intent.jumpRequested = false;
          continue;
        }

        if (distToWaypoint <= WAYPOINT_RADIUS && ai.pathIndex < ai.path.length - 1) {
          ai.pathIndex += 1;
        }

        const active = ai.path[ai.pathIndex]!;
        steerToward(intent, cc, t.position[0], t.position[2], active.x, active.z);

        ai.jumpTimer -= ctx.dt;
        if (cc.onGround && ai.jumpTimer <= 0) {
          ai.jumpTimer = ai.jumpCooldown;
          ai.jumpCooldown = 3 + Math.random() * 5;
          intent.jumpRequested = Math.random() < ai.jumpChance;
        } else {
          intent.jumpRequested = false;
        }
      }
    },
    6,
  );
};

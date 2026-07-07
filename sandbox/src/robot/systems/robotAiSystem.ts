import {
  type Registry,
  type Collider,
  type Transform,
  type MovementIntent,
  type CharacterController,
  type NavGrid,
  COMPONENT_KEYS,
  findPath,
  pickRandomObjective,
  v3Set,
} from 'viberanium';
import { ROBOT_AI_KEY, type RobotAi } from '../components/robotAi.ts';

const WAYPOINT_RADIUS = 0.45;
const OBJECTIVE_MIN_DIST = 3;
const OBJECTIVE_MAX_DIST = 16;

const getSceneNavGrid = (registry: Registry): NavGrid | null => {
  for (const e of registry.view(COMPONENT_KEYS.navGrid)) {
    return e.components[COMPONENT_KEYS.navGrid] as NavGrid;
  }

  return null;
};

const assignObjective = (
  robot: RobotAi,
  colliders: Collider[],
  grid: NavGrid,
  fromX: number,
  fromZ: number,
): boolean => {
  const objective = pickRandomObjective(grid, colliders, fromX, fromZ, OBJECTIVE_MIN_DIST, OBJECTIVE_MAX_DIST);
  if (!objective) return false;

  robot.target[0] = objective.x;
  robot.target[2] = objective.z;
  const path = findPath(grid, fromX, fromZ, objective.x, objective.z);
  robot.path = path ?? [{ x: objective.x, z: objective.z }];
  robot.pathIndex = 0;
  robot.state = 'navigating';
  return true;
};

const beginPause = (robot: RobotAi) => {
  robot.state = 'pausing';
  robot.path = [];
  robot.pathIndex = 0;
  robot.pauseRemaining = robot.pauseMin + Math.random() * (robot.pauseMax - robot.pauseMin);
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

export const installRobotAiSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    const grid = getSceneNavGrid(registry);
    if (!grid) return;

    const colliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];

    for (const e of registry.view(ROBOT_AI_KEY)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const robot = e.components[ROBOT_AI_KEY] as RobotAi;
      if (!t || !cc || !intent) continue;

      if (robot.state === 'pausing') {
        robot.pauseRemaining -= ctx.dt;
        v3Set(intent.desiredVelocity, 0, 0, 0);
        intent.jumpRequested = false;
        if (robot.pauseRemaining <= 0) {
          robot.pauseRemaining = 0;
          assignObjective(robot, colliders, grid, t.position[0], t.position[2]);
        }
        continue;
      }

      if (robot.path.length === 0) {
        assignObjective(robot, colliders, grid, t.position[0], t.position[2]);
        if (robot.path.length === 0) {
          v3Set(intent.desiredVelocity, 0, 0, 0);
          intent.jumpRequested = false;
          continue;
        }
      }

      const waypoint = robot.path[robot.pathIndex]!;
      const distToWaypoint = Math.hypot(waypoint.x - t.position[0], waypoint.z - t.position[2]);
      const atLastWaypoint = robot.pathIndex >= robot.path.length - 1;
      const distToObjective = Math.hypot(robot.target[0] - t.position[0], robot.target[2] - t.position[2]);

      if (atLastWaypoint && distToObjective <= robot.objectiveRadius) {
        beginPause(robot);
        v3Set(intent.desiredVelocity, 0, 0, 0);
        intent.jumpRequested = false;
        continue;
      }

      if (distToWaypoint <= WAYPOINT_RADIUS && robot.pathIndex < robot.path.length - 1) {
        robot.pathIndex += 1;
      }

      const active = robot.path[robot.pathIndex]!;
      steerToward(intent, cc, t.position[0], t.position[2], active.x, active.z);

      robot.jumpTimer -= ctx.dt;
      if (cc.onGround && robot.jumpTimer <= 0) {
        robot.jumpTimer = robot.jumpCooldown;
        robot.jumpCooldown = 3 + Math.random() * 5;
        intent.jumpRequested = Math.random() < robot.jumpChance;
      } else {
        intent.jumpRequested = false;
      }
    }
  }, 6);
};

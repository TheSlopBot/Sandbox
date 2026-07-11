import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Collider } from '../components/collider.ts';
import { type Transform } from '../components/transform.ts';
import { type CharacterController } from '../components/characterController.ts';
import { type Entity } from '../engine/entity.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import { CHARACTER_STATE_FLOATS } from '../render/gl/collisionPack.ts';
import {
  createCollisionPass,
  type CollisionCharacterInput,
} from '../render/passes/collisionPass.ts';
import {
  ensureCollisionBroadphase,
  isCollisionBroadphaseDirty,
  markCollisionBroadphaseDirty,
  queryNearbyStaticColliders,
} from '../collision/collisionBroadphase.ts';
import { onCollisionStaticDirty } from './collisionStaticDirty.ts';

const _obstacles: Collider[] = [];
let broadphaseHooked = false;

const ensureBroadphaseHook = () => {
  if (broadphaseHooked) return;
  broadphaseHooked = true;
  onCollisionStaticDirty(() => markCollisionBroadphaseDirty());
  markCollisionBroadphaseDirty();
};

export const getObstacles = (registry: Registry, keys: readonly string[]): Collider[] => {
  ensureBroadphaseHook();

  _obstacles.length = 0;
  for (const key of keys) {
    for (const c of registry.getComponentsByName(key)) {
      _obstacles.push(c as Collider);
    }
  }

  ensureCollisionBroadphase(_obstacles);
  return _obstacles;
};

export const getNearbyObstacles = (
  registry: Registry,
  keys: readonly string[],
  x: number,
  z: number,
  radius: number,
): Collider[] => {
  ensureBroadphaseHook();

  if (isCollisionBroadphaseDirty()) {
    getObstacles(registry, keys);
  }

  return queryNearbyStaticColliders(x, z, radius);
};

export type CollisionSystemOptions = {
  device?: GpuDevice;
  setPostUpdateFlush?: (fn: (() => Promise<void>) | null) => void;
  gpuResolve?: boolean;
};

const applyReadback = (
  readback: Float32Array,
  entitySnapshot: readonly Entity[],
  count: number,
) => {
  for (let i = 0; i < count; i++) {
    const e = entitySnapshot[i]!;
    const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
    if (!t || !cc) continue;

    const base = i * CHARACTER_STATE_FLOATS;
    const nextX = readback[base]!;
    const nextY = readback[base + 1]!;
    const nextZ = readback[base + 2]!;
    const radius = readback[base + 6]!;
    const halfHeight = readback[base + 7]!;

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZ)) continue;
    if (!(radius > 0) || !(halfHeight > 0)) continue;

    if (
      t.position[0] !== nextX ||
      t.position[1] !== nextY ||
      t.position[2] !== nextZ
    ) {
      t.position[0] = nextX;
      t.position[1] = nextY;
      t.position[2] = nextZ;
      t.dirty = true;
    }

    cc.velocity[1] = readback[base + 3]!;
    cc.velocity[0] = readback[base + 4]!;
    cc.velocity[2] = readback[base + 5]!;
    cc.onGround = readback[base + 9]! > 0.5;
  }
};

export const installCollisionSystem = (
  registry: Registry,
  options: CollisionSystemOptions = {},
): void => {
  ensureBroadphaseHook();

  registry.addAction(
    'update',
    () => {
      const allColliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
      ensureCollisionBroadphase(allColliders);
    },
    9,
  );

  if (!options.device || options.gpuResolve !== true) return;

  const pass = createCollisionPass(options.device);
  onCollisionStaticDirty(() => pass.markStaticDirty());

  const inputs: CollisionCharacterInput[] = [];
  const entities: Entity[] = [];
  let readback = new Float32Array(0);
  const pendingBySlot: [Entity[], Entity[]] = [[], []];
  const pendingCounts: [number, number] = [0, 0];

  registry.addAction(
    'update',
    () => {
      if (!pass.isReadbackReady()) return;

      const count = Math.max(pendingCounts[0], pendingCounts[1]);
      if (count <= 0) return;
      const needed = count * CHARACTER_STATE_FLOATS;
      if (readback.length < needed) readback = new Float32Array(needed);

      const slot = pass.readCharacters(readback, count);
      if (slot < 0) return;

      applyReadback(readback, pendingBySlot[slot]!, pendingCounts[slot]!);
      pendingBySlot[slot] = [];
      pendingCounts[slot] = 0;
    },
    7,
  );

  registry.addAction(
    'update',
    (ctx) => {
      if (!pass.canDispatch()) return;

      const allColliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
      pass.rebuildStatic(allColliders);

      inputs.length = 0;
      entities.length = 0;

      for (const e of registry.view(COMPONENT_KEYS.character)) {
        const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
        if (!t || !cc) continue;

        const speed2 =
          cc.velocity[0] * cc.velocity[0] +
          cc.velocity[1] * cc.velocity[1] +
          cc.velocity[2] * cc.velocity[2];
        const foot = cc.halfHeight + cc.radius;
        const airborne = t.position[1] - foot > 0.05;
        const active = !(speed2 < 1e-10 && cc.onGround && !airborne);

        entities.push(e);
        inputs.push({
          pos: t.position,
          vel: cc.velocity,
          radius: cc.radius,
          halfHeight: cc.halfHeight,
          gravity: cc.gravity,
          onGround: cc.onGround && !airborne,
          active,
        });
      }

      if (inputs.length === 0) return;

      pass.writeCharacters(inputs);
      const slot = pass.dispatch(ctx.dt, inputs.length);
      if (slot < 0) return;

      pendingBySlot[slot] = entities.slice();
      pendingCounts[slot] = inputs.length;
    },
    10,
  );
};

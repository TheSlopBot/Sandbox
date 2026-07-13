import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Collider } from '../components/collider.ts';
import { type Transform } from '../components/transform.ts';
import {
  type CharacterController,
  characterBodyToSolver,
  readCharacterBodyCylinder,
} from '../components/characterController.ts';
import { type Entity } from '../engine/entity.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import { CHARACTER_STATE_FLOATS } from '../render/gl/collisionPack.ts';
import {
  createCollisionPass,
  type CollisionCharacterInput,
} from '../render/passes/collisionPass.ts';
import { onCollisionStaticDirty } from './collisionStaticDirty.ts';
import { readGroundPlaneY } from './readGroundPlaneY.ts';

export type CollisionSystemOptions = {
  device: GpuDevice;
  setSimFlush: (fn: (() => Promise<void>) | null) => void;
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
  options: CollisionSystemOptions,
): (() => void) => {
  const pass = createCollisionPass(options.device);
  onCollisionStaticDirty(() => pass.markStaticDirty());

  const inputs: CollisionCharacterInput[] = [];
  const entities: Entity[] = [];
  let packedEntities: Entity[] = [];
  let packedCount = 0;
  let packedDt = 0;
  let readback = new Float32Array(0);

  registry.addAction(
    'update',
    (ctx) => {
      if (pass.needsStaticRebuild()) {
        const allColliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
        pass.rebuildStatic(allColliders);
      }

      inputs.length = 0;
      entities.length = 0;

      for (const e of registry.view(COMPONENT_KEYS.character)) {
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
        entities.push(e);
        inputs.push({
          pos: t.position,
          vel: cc.velocity,
          radius: solver.radius,
          halfHeight: solver.halfHeight,
          gravity: cc.gravity,
          onGround: cc.onGround,
          active: true,
        });
      }

      packedCount = inputs.length;
      packedDt = Math.min(ctx.dt, 0.05);
      packedEntities = entities.slice();

      if (packedCount > 0) pass.writeCharacters(inputs);
    },
    10,
  );

  options.setSimFlush(async () => {
    if (packedCount <= 0) return;

    const needed = packedCount * CHARACTER_STATE_FLOATS;
    if (readback.length < needed) readback = new Float32Array(needed);

    const count = await pass.dispatchAndRead(
      packedDt,
      packedCount,
      readback,
      readGroundPlaneY(registry),
    );
    if (count <= 0) return;

    applyReadback(readback, packedEntities, count);
    packedCount = 0;
    packedEntities = [];
  });

  return () => {
    options.setSimFlush(null);
    pass.destroy();
  };
};

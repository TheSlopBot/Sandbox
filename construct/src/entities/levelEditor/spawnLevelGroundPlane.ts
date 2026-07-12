import {
  type GpuDevice,
  type Registry,
  createChildOf,
  createChildren,
  createGroundPlane,
  createInterleavedMesh,
  createLocalTransform,
  createTransform,
  destroyMesh,
  addChildId,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import {
  LEVEL_GROUND_PLANE_ID,
  type LevelDocument,
} from '../../catalog/levels/levelDocument.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';
import { createConstructLevelPlacement } from './levelPlacement.ts';

export const spawnLevelGroundPlaneEntity = (
  device: GpuDevice,
  registry: Registry,
  rootId: number,
  doc: LevelDocument,
): number | null => {
  const root = registry.get(rootId);
  if (!root) return null;

  const existing = registry.view(COMPONENT_KEYS.groundPlane);
  for (const e of existing) registry.deregister(e.id);

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const rootChildren = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const size = doc.groundPlane.size;
  const v = new Float32Array([
    -1, 0, -1,  0, 1, 0,  0, 0,
     1, 0, -1,  0, 1, 0,  1, 0,
     1, 0,  1,  0, 1, 0,  1, 1,
    -1, 0,  1,  0, 1, 0,  0, 1,
  ]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2]);
  const mesh = createInterleavedMesh(device, v, idx);

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, {
    position: doc.groundPlane.position,
    rotation: [0, 0, 0, 1],
    scale: [size, 1, size],
  });

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.groundPlane] = createGroundPlane(
    mesh,
    t.world,
    doc.groundPlane.variant,
  );
  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(LEVEL_GROUND_PLANE_ID);
  entity.components[CONSTRUCT_KEYS.levelPlacement] = createConstructLevelPlacement(
    LEVEL_GROUND_PLANE_ID,
    'groundPlane',
  );

  entity.onDeregister.push(() => destroyMesh(device, mesh));

  registry.register(entity);
  addChildId(rootChildren, entity.id);
  bakeChildWorld(rootT, t, local);

  return entity.id;
};

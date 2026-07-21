import { type Registry } from '../../engine/registry.ts';
import { type EntityId } from '../../engine/entity.ts';
import { createTransform } from '../../components/transform.ts';
import {
  createBoxCollider,
  createSphereCollider,
  bakeColliderWorldFromLocal,
  type Collider,
} from '../../components/collider.ts';
import { createProjectile } from '../../components/projectile.ts';
import { createMeshDraws, type MeshDrawPart } from '../../components/meshDraws.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { COMBAT_LAYER, COMBAT_MASK } from '../../combat/combatLayers.ts';
import { v3 } from '../../math/vec3.ts';
import { type WeaponDefinition, type WeaponColliderDef } from '../../definitions/weapons/weaponDefinition.ts';
import { type GpuDevice } from '../../render/gl/device.ts';
import { type TextureCache } from '../../render/gl/texture.ts';
import { type GltfCache } from '../../assets/gltf/cache.ts';
import { getOrBuildRuntimeScene, updateWorldFromLocals } from '../../assets/gltf/runtime.ts';
import { buildGltfMaterials } from '../../assets/gltf/materials.ts';
import { createInterleavedMesh, destroyMesh } from '../../render/gl/mesh.ts';
import { orientTransformAlongVelocity } from '../../combat/orientTransformAlongVelocity.ts';

const buildColliderFromDef = (
  def: WeaponColliderDef,
): { collider: Collider; radius: number } => {
  if (def.shape === 'box') {
    const hx = Math.abs((def.halfExtents?.[0] ?? 0.15) * def.scale[0]);
    const hy = Math.abs((def.halfExtents?.[1] ?? 0.15) * def.scale[1]);
    const hz = Math.abs((def.halfExtents?.[2] ?? 0.15) * def.scale[2]);
    const collider = createBoxCollider({
      center: v3(def.position[0], def.position[1], def.position[2]),
      halfExtents: v3(hx, hy, hz),
      isStatic: false,
    });
    return { collider, radius: Math.max(hx, hy, hz, 0.05) };
  }

  if (def.shape === 'sphere') {
    const radius = Math.abs((def.radius ?? 0.12) * Math.max(def.scale[0], def.scale[1], def.scale[2]));
    const collider = createSphereCollider({
      center: v3(def.position[0], def.position[1], def.position[2]),
      radius,
      isStatic: false,
    });
    return { collider, radius };
  }

  const radius = Math.abs((def.radius ?? 0.12) * Math.max(def.scale[0], def.scale[1], def.scale[2]));
  const collider = createSphereCollider({
    center: v3(0, 0, 0),
    radius,
    isStatic: false,
  });
  return { collider, radius };
};

export const spawnProjectile = (
  registry: Registry,
  opts: {
    ownerId: EntityId;
    position: [number, number, number];
    velocity: [number, number, number];
    damage: number;
    radius?: number;
    maxDistance?: number;
    projectileDef?: WeaponDefinition;
    device?: GpuDevice;
    textures?: TextureCache;
    gltfCache?: GltfCache;
  },
): number => {
  const entity = registry.createBare();
  const t = createTransform();
  t.position[0] = opts.position[0];
  t.position[1] = opts.position[1];
  t.position[2] = opts.position[2];
  orientTransformAlongVelocity(t, opts.velocity);

  let radius = opts.radius ?? 0.12;
  let collider: Collider;

  const hitCol =
    opts.projectileDef?.colliders.find((c) => c.role === 'weapon') ?? opts.projectileDef?.colliders[0];

  if (hitCol) {
    const built = buildColliderFromDef(hitCol);
    collider = built.collider;
    radius = opts.radius ?? built.radius;
  } else {
    collider = createSphereCollider({
      center: v3(opts.position[0], opts.position[1], opts.position[2]),
      radius,
      isStatic: false,
    });
  }

  collider.combatLayer = COMBAT_LAYER.PROJECTILE;
  collider.combatMask = COMBAT_MASK.PROJECTILE_TARGETS;
  collider.ownerId = opts.ownerId;
  collider.entityId = entity.id;
  if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.collider] = collider;
  entity.components[COMPONENT_KEYS.projectile] = createProjectile({
    ownerId: opts.ownerId,
    damage: opts.damage,
    velocity: opts.velocity,
    origin: [opts.position[0], opts.position[1], opts.position[2]],
    maxDistance: opts.maxDistance ?? 100,
    radius,
  });

  const meshUrl = opts.projectileDef?.mesh.url;
  if (
    meshUrl &&
    opts.device &&
    opts.textures &&
    opts.gltfCache
  ) {
    const loaded = opts.gltfCache.getIfLoaded(meshUrl);
    if (loaded) {
      const attachScene = getOrBuildRuntimeScene(loaded);
      updateWorldFromLocals(attachScene.nodes);
      const mats = buildGltfMaterials(
        loaded,
        opts.projectileDef!.mesh.materialPrefix,
        opts.textures,
      );
      const parts: MeshDrawPart[] = [];
      for (const pair of attachScene.meshNodePairs) {
        const modelMesh = attachScene.models[pair.meshIndex];
        if (!modelMesh) continue;
        for (const prim of modelMesh.primitives) {
          if (prim.kind === 'skinned') continue;
          const material =
            prim.materialIndex >= 0 && prim.materialIndex < mats.length
              ? mats[prim.materialIndex]!
              : mats[0]!;
          parts.push({
            mesh: createInterleavedMesh(opts.device, prim.vertices, prim.indices),
            material,
            gltfNodeIndex: pair.nodeIndex,
            visible: true,
          });
        }
      }
      if (parts.length > 0) {
        entity.components[COMPONENT_KEYS.meshDraws] = createMeshDraws(parts);
        for (const part of parts) {
          entity.onDeregister.push(() => destroyMesh(opts.device!, part.mesh));
        }
      }
    }
  }

  registry.register(entity);
  return entity.id;
};

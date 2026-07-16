import {
  type GpuDevice,
  type Registry,
  createTransform,
  createCharacterController,
  createMovementIntent,
  spawnActorColliders,
  type TextureCache,
  type GltfCache,
  type SharedMeshCache,
  type CharacterController,
  type ActorColliderDef,
  type ActorDefinition,
  COMPONENT_KEYS,
} from 'viberanium';
import { type SkeletalCharacterDef } from '../../catalog/characters/characterDef.ts';
import { loadSkeletalCharacter } from './loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from './spawnSkeletalCharacter.ts';
import { attachCombatActor } from '../combat/attachCombatActor.ts';

export type SpawnActorOpts = {
  x: number;
  y: number;
  z: number;
  moveSpeed?: number;
  colliders?: readonly ActorColliderDef[];
  extraComponents?: Record<string, unknown>;
  combatActor?: ActorDefinition;
  meshes?: SharedMeshCache;
};

export const spawnActor = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  def: SkeletalCharacterDef,
  opts: SpawnActorOpts,
) => {
  const charT = createTransform();
  charT.position[0] = opts.x;
  charT.position[1] = opts.y;
  charT.position[2] = opts.z;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();

  if (opts.extraComponents) {
    for (const [key, value] of Object.entries(opts.extraComponents)) {
      entity.components[key] = value;
    }
  }

  const loaded = await loadSkeletalCharacter(
    { device, textures, gltfCache, meshes: opts.meshes },
    def,
  );
  const attachmentEntityIds = spawnSkeletalCharacter(registry, entity, loaded, {
    device,
    meshes: opts.meshes,
  });

  if (opts.colliders && opts.colliders.length > 0) {
    spawnActorColliders(registry, entity, opts.colliders, {
      attachmentEntityIds,
    });
  }

  if (opts.combatActor) {
    attachCombatActor(entity, opts.combatActor);
  }

  const cc = entity.components[COMPONENT_KEYS.character] as CharacterController;
  cc.moveSpeed = opts.moveSpeed ?? 3.8;

  registry.register(entity);

  return { entity };
};

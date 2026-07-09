import {
  type Registry,
  createTransform,
  createCharacterController,
  createMovementIntent,
  type TextureCache,
  type GltfCache,
  type CharacterController,
  COMPONENT_KEYS,
} from 'viberanium';
import { type SkeletalCharacterDef } from '../../catalog/types/character.ts';
import { loadSkeletalCharacter } from './loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from './spawnSkeletalCharacter.ts';

export type SpawnActorOpts = {
  x: number;
  z: number;
  y?: number;
  moveSpeed?: number;
  extraComponents?: Record<string, unknown>;
};

export const spawnActor = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  def: SkeletalCharacterDef,
  opts: SpawnActorOpts,
) => {
  const charT = createTransform();
  charT.position[0] = opts.x;
  charT.position[1] = opts.y ?? 1.6;
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

  const loaded = await loadSkeletalCharacter({ gl, textures, gltfCache }, def);
  spawnSkeletalCharacter(registry, entity, loaded, { gl });

  const cc = entity.components[COMPONENT_KEYS.character] as CharacterController;
  cc.moveSpeed = opts.moveSpeed ?? 3.8;

  registry.register(entity);

  return { entity };
};

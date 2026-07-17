import {
  type GpuDevice,
  type TextureCache,
  type GltfCache,
  type Material,
  type AnimationClip,
  type SkeletalModel,
  type MeshDraws,
  type SharedMeshCache,
  createSkeletalModel,
  createAnimationClip,
  createAttachmentOffset,
  buildRetargetedClips,
  getOrBuildRuntimeScene,
  buildGltfMaterials,
  buildMeshDrawsFromRuntimeScene,
  findBoneNodeIndex,
  updateWorldFromLocals,
  type RuntimeScene,
  type Mat4,
} from 'viberanium';
import { type SkeletalCharacterDef } from '../../catalog/characters/characterDef.ts';
import { pickClip } from './pickClip.ts';

export type CharacterLoadDeps = {
  device: GpuDevice;
  textures: TextureCache;
  gltfCache: GltfCache;
  meshes?: SharedMeshCache;
};

export type LoadedAttachmentPart = {
  material: Material;
  gltfNodeIndex: number;
  vertices: Float32Array;
  indices: Uint32Array;
  meshKey: string;
};

export type LoadedAttachment = {
  id: string;
  boneNodeIndex: number;
  localOffset: Mat4;
  attachScene: RuntimeScene;
  parts: LoadedAttachmentPart[];
  spawnEquipped: boolean;
  gltfUrl: string;
};

export type SkeletalCharacterLoad = {
  model: SkeletalModel;
  meshDraws: MeshDraws;
  sharedMeshes: boolean;
  clips: {
    idle: AnimationClip;
    run: AnimationClip;
    walkBack: AnimationClip;
    jumpStart: AnimationClip;
    jumpIdle: AnimationClip;
    jumpLand: AnimationClip;
    hit: AnimationClip;
    death: AnimationClip;
    deathPose: AnimationClip;
  };
  attachments: LoadedAttachment[];
};

const loadAttachment = async (
  deps: CharacterLoadDeps,
  bodyScene: RuntimeScene,
  def: NonNullable<SkeletalCharacterDef['attachments']>[number],
): Promise<LoadedAttachment> => {
  const loaded = await deps.gltfCache.getOrLoad(def.gltfUrl);
  const attachScene = getOrBuildRuntimeScene(loaded);
  updateWorldFromLocals(attachScene.nodes);

  const mats = buildGltfMaterials(loaded, def.materialPrefix, deps.textures);
  const boneNodeIndex = findBoneNodeIndex(bodyScene.nodes, def.boneName);
  const localOffset = createAttachmentOffset(def.offsetT, def.offsetR, def.offsetS);
  const parts: LoadedAttachmentPart[] = [];

  for (const pair of attachScene.meshNodePairs) {
    const model = attachScene.models[pair.meshIndex];
    if (!model) continue;

    for (let primIndex = 0; primIndex < model.primitives.length; primIndex++) {
      const prim = model.primitives[primIndex]!;
      if (prim.kind === 'skinned') continue;

      const material = prim.materialIndex >= 0 && prim.materialIndex < mats.length
        ? mats[prim.materialIndex]
        : mats[0];
      parts.push({
        material,
        gltfNodeIndex: pair.nodeIndex,
        vertices: prim.vertices,
        indices: prim.indices,
        meshKey: `${def.gltfUrl}#${pair.meshIndex}:${primIndex}:static`,
      });
    }
  }

  return {
    id: def.id,
    boneNodeIndex,
    localOffset,
    attachScene,
    parts,
    spawnEquipped: def.spawnEquipped !== false,
    gltfUrl: def.gltfUrl,
  };
};

export const loadSkeletalCharacter = async (
  deps: CharacterLoadDeps,
  def: SkeletalCharacterDef,
): Promise<SkeletalCharacterLoad> => {
  const advancedUrl = def.animPack.movementAdvancedGlb;
  const [bodyLoaded, idleLoaded, moveLoaded, advancedLoaded] = await Promise.all([
    deps.gltfCache.getOrLoad(def.bodyGlb),
    deps.gltfCache.getOrLoad(def.animPack.generalGlb),
    deps.gltfCache.getOrLoad(def.animPack.movementGlb),
    advancedUrl ? deps.gltfCache.getOrLoad(advancedUrl) : Promise.resolve(null),
  ]);

  const bodyScene = getOrBuildRuntimeScene(bodyLoaded);
  updateWorldFromLocals(bodyScene.nodes);
  const baseColorOverride = def.baseColorTextureUrl
    ? await deps.textures.getOrLoad(def.baseColorTextureUrl)
    : null;
  const bodyMats = buildGltfMaterials(bodyLoaded, def.materialPrefix, deps.textures, baseColorOverride);
  const idleClips = buildRetargetedClips(idleLoaded, bodyScene.nodes);
  const moveClips = buildRetargetedClips(moveLoaded, bodyScene.nodes);
  const advancedClips = advancedLoaded
    ? buildRetargetedClips(advancedLoaded, bodyScene.nodes)
    : moveClips;

  const walkBackName = def.clips.walkBack;
  const walkBackSource = walkBackName && advancedLoaded ? advancedClips : moveClips;
  const walkBackClip = walkBackName
    ? pickClip(walkBackSource, walkBackName)
    : pickClip(moveClips, def.clips.run);

  const clips = {
    idle: createAnimationClip(pickClip(idleClips, def.clips.idle)),
    run: createAnimationClip(pickClip(moveClips, def.clips.run)),
    walkBack: createAnimationClip(walkBackClip),
    jumpStart: createAnimationClip(pickClip(moveClips, def.clips.jumpStart)),
    jumpIdle: createAnimationClip(pickClip(moveClips, def.clips.jumpIdle)),
    jumpLand: createAnimationClip(pickClip(moveClips, def.clips.jumpLand)),
    hit: createAnimationClip(pickClip(idleClips, def.clips.hit)),
    death: createAnimationClip(pickClip(idleClips, def.clips.death)),
    deathPose: createAnimationClip(pickClip(idleClips, def.clips.deathPose)),
  };

  const meshDraws = buildMeshDrawsFromRuntimeScene(deps.device, bodyScene, bodyMats, {
    meshes: deps.meshes,
    meshKeyPrefix: def.bodyGlb,
  });
  const model = createSkeletalModel(bodyScene, def.visualYOffset ?? -0.55);

  const attachments = def.attachments?.length
    ? await Promise.all(def.attachments.map((attachment) => loadAttachment(deps, bodyScene, attachment)))
    : [];

  return { model, meshDraws, sharedMeshes: !!deps.meshes, clips, attachments };
};

import {
  type Registry,
  type Entity,
  type Transform,
  createSkinInstance,
  type SkinInstance,
  buildRetargetedClips,
  type AnimClip,
  type Material,
  createInterleavedMesh,
  createSkinnedMesh,
  type TextureCache,
  type GltfCache,
  buildRuntimeScene,
  buildGltfMaterials,
  m4,
  type AnimClips,
  type CharacterPart,
  COMPONENT_KEYS,
} from 'viberanium';

export type CharacterAnimAssets = {
  bodyGlb: string;
  animGeneralGlb: string;
  animMovementGlb: string;
  materialPrefix: string;
  baseColorTextureUrl?: string;
};

const pickClip = (clips: AnimClip[], name: string): AnimClip => {
  const exact = clips.find(c => c.name === name);
  if (exact) return exact;
  const partial = clips.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
  if (partial) return partial;
  if (clips[0]) return clips[0];
  throw new Error(`No clip found matching '${name}'`);
};

const buildSkinnedEntities = (
  registry: Registry,
  gl: WebGL2RenderingContext,
  charT: Transform,
  sceneRuntime: ReturnType<typeof buildRuntimeScene>,
  targetNodes: ReturnType<typeof buildRuntimeScene>['nodes'],
  mats: Material[],
): { characterParts: CharacterPart[]; renderEntityIds: number[] } => {
  const characterParts: CharacterPart[] = [];
  const renderEntityIds: number[] = [];
  const nameToBody = new Map<string, number>();
  for (let i = 0; i < targetNodes.length; i++) nameToBody.set(targetNodes[i].name, i);

  for (const pair of sceneRuntime.meshNodePairs) {
    const model = sceneRuntime.models[pair.meshIndex];
    if (!model) continue;

    let skinInst: SkinInstance | null = null;
    if (pair.skinIndex >= 0) {
      const srcSkin = sceneRuntime.skins[pair.skinIndex];
      if (!srcSkin) continue;
      const remappedJoints: number[] = [];
      for (const jNode of srcSkin.joints) {
        const jName = sceneRuntime.nodes[jNode]?.name;
        remappedJoints.push(jName ? (nameToBody.get(jName) ?? 0) : 0);
      }
      const fakeScene = { ...sceneRuntime, nodes: targetNodes, skins: [{ ...srcSkin, joints: remappedJoints }] } as typeof sceneRuntime;
      skinInst = createSkinInstance(fakeScene, 0, pair.nodeIndex);
    }

    const pairRenderIds: number[] = [];

    for (const prim of model.primitives) {
      const material = prim.materialIndex >= 0 && prim.materialIndex < mats.length
        ? mats[prim.materialIndex]
        : mats[0];

      if (prim.kind === 'skinned' && skinInst) {
        const mesh = createSkinnedMesh(gl, prim.vertices, prim.joints, prim.weights, prim.indices, skinInst.jointCount);
        const e = registry.createBare();
        e.components[COMPONENT_KEYS.transform] = charT;
        e.components[COMPONENT_KEYS.skin] = skinInst;
        e.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
        e.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
        registry.register(e);
        pairRenderIds.push(e.id);
        renderEntityIds.push(e.id);
      } else {
        const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
        const e = registry.createBare();
        e.components[COMPONENT_KEYS.transform] = charT;
        e.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
        e.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
        registry.register(e);
        pairRenderIds.push(e.id);
        renderEntityIds.push(e.id);
      }
    }

    if (skinInst) characterParts.push({ skinInst, renderEntityIds: pairRenderIds });
  }

  return { characterParts, renderEntityIds };
};

export const assembleSkeletalCharacter = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  charT: Transform,
  assets: CharacterAnimAssets,
): Promise<{ bodyScene: ReturnType<typeof buildRuntimeScene>; characterParts: CharacterPart[]; renderEntityIds: number[]; clips: AnimClips }> => {
  const [bodyLoaded, idleLoaded, moveLoaded] = await Promise.all([
    gltfCache.getOrLoad(assets.bodyGlb),
    gltfCache.getOrLoad(assets.animGeneralGlb),
    gltfCache.getOrLoad(assets.animMovementGlb),
  ]);

  const bodyScene = buildRuntimeScene(bodyLoaded);
  const baseColorOverride = assets.baseColorTextureUrl
    ? await textures.getOrLoad(assets.baseColorTextureUrl)
    : null;
  const bodyMats = buildGltfMaterials(bodyLoaded, assets.materialPrefix, textures, baseColorOverride);
  const idleClips = buildRetargetedClips(idleLoaded, bodyScene.nodes);
  const moveClips = buildRetargetedClips(moveLoaded, bodyScene.nodes);

  const clips: AnimClips = {
    idle: pickClip(idleClips, 'idle_a'),
    run: pickClip(moveClips, 'running_a'),
    jumpStart: pickClip(moveClips, 'jump_start'),
    jumpIdle: pickClip(moveClips, 'jump_idle'),
    jumpLand: pickClip(moveClips, 'jump_land'),
  };

  const { characterParts, renderEntityIds } = buildSkinnedEntities(
    registry, gl, charT,
    bodyScene, bodyScene.nodes, bodyMats,
  );

  return { bodyScene, characterParts, renderEntityIds, clips };
};

export type AssembledCharacter = {
  entity: Entity;
  charT: Transform;
};

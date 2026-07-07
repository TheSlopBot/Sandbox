import {
  type Registry,
  type Entity,
  type Transform,
  createTransform,
  createSkinInstance,
  type SkinInstance,
  buildRetargetedClips,
  type AnimClip,
  type Material,
  createInterleavedMesh,
  createSkinnedMesh,
  TextureCache,
  loadGltf,
  buildRuntimeScene,
  buildGltfMaterials,
  m4,
  createCharacterController,
  createCameraFollow,
  createLocomotionIntent,
  createPlayerController,
  createSkeletalRig,
  type AnimClips,
  type CharacterPart,
  COMPONENT_KEYS,
} from 'viberanium';

export type PlayerAssets = {
  bodyGlb: string;
  animGeneralGlb: string;
  animMovementGlb: string;
};

export type PlayerEntity = {
  entity: Entity;
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
): CharacterPart[] => {
  const characterParts: CharacterPart[] = [];
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

    const renderEntityIds: number[] = [];

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
        renderEntityIds.push(e.id);
      } else {
        const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
        const e = registry.createBare();
        e.components[COMPONENT_KEYS.transform] = charT;
        e.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
        e.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
        registry.register(e);
        renderEntityIds.push(e.id);
      }
    }

    if (skinInst) characterParts.push({ skinInst, renderEntityIds });
  }

  return characterParts;
};

export const createPlayer = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  assets: PlayerAssets,
): Promise<PlayerEntity> => {
  const charT = createTransform();
  charT.position[1] = 1.6;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.locomotionIntent] = createLocomotionIntent();
  entity.components[COMPONENT_KEYS.playerController] = createPlayerController();
  entity.components[COMPONENT_KEYS.cameraFollow] = createCameraFollow();

  const [bodyLoaded, idleLoaded, moveLoaded] = await Promise.all([
    loadGltf(assets.bodyGlb),
    loadGltf(assets.animGeneralGlb),
    loadGltf(assets.animMovementGlb),
  ]);

  const bodyScene = buildRuntimeScene(bodyLoaded);
  const bodyMats = buildGltfMaterials(bodyLoaded, 'spaceranger_body', textures);
  const idleClips = buildRetargetedClips(idleLoaded, bodyScene.nodes);
  const moveClips = buildRetargetedClips(moveLoaded, bodyScene.nodes);

  const clips: AnimClips = {
    idle: pickClip(idleClips, 'idle_a'),
    run: pickClip(moveClips, 'running_a'),
    jumpStart: pickClip(moveClips, 'jump_start'),
    jumpIdle: pickClip(moveClips, 'jump_idle'),
    jumpLand: pickClip(moveClips, 'jump_land'),
  };

  const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController>;
  cc.jumpStartDuration = clips.jumpStart.duration;
  cc.jumpLandDuration = clips.jumpLand.duration;

  const characterParts = buildSkinnedEntities(
    registry, gl, charT,
    bodyScene, bodyScene.nodes, bodyMats,
  );

  entity.components[COMPONENT_KEYS.skeletalRig] = createSkeletalRig(
    bodyScene, characterParts, clips,
  );

  return { entity };
};

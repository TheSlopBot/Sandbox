import { type Registry } from '../engine/registry.ts';
import { type Transform, createTransform } from '../components/transform.ts';
import { createSkinInstance, type SkinInstance } from '../components/skin.ts';
import { buildRetargetedClips, type AnimClip } from '../components/animation.ts';
import { type Material } from '../render/types.ts';
import { createInterleavedMesh, createSkinnedMesh } from '../render/gl/mesh.ts';
import { TextureCache } from '../render/gl/texture.ts';
import { loadGltf } from '../assets/gltf/loader.ts';
import { buildRuntimeScene, type RuntimeScene } from '../assets/gltf/runtime.ts';
import { buildGltfMaterials } from '../assets/gltf/materials.ts';
import { m4 } from '../math/mat4.ts';
import { createCharacterController } from './components/characterController.ts';
import { createCameraFollow } from './components/cameraFollow.ts';
import { type AnimClips, type CharacterPart } from '../systems/animationSystem.ts';

export type PlayerAssets = {
  bodyGlb: string;
  animGeneralGlb: string;
  animMovementGlb: string;
};

export type PlayerRefs = {
  charT: Transform;
  bodyScene: RuntimeScene;
  characterParts: CharacterPart[];
  clips: AnimClips;
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
  targetNodes: RuntimeScene['nodes'],
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
        const e = registry.create();
        e.components['transform'] = charT;
        e.components['skin'] = skinInst;
        e.components['gltfNodeIndex'] = pair.nodeIndex;
        e.components['renderable'] = { mesh, material, model: m4() };
        renderEntityIds.push(e.id);
      } else {
        const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
        const e = registry.create();
        e.components['transform'] = charT;
        e.components['gltfNodeIndex'] = pair.nodeIndex;
        e.components['renderable'] = { mesh, material, model: m4() };
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
): Promise<PlayerRefs> => {
  const charT = createTransform();
  charT.position[1] = 1.6;
  charT.dirty = true;

  const characterEntity = registry.create();
  characterEntity.components['transform'] = charT;
  characterEntity.components['character'] = createCharacterController();
  characterEntity.components['cameraFollow'] = createCameraFollow();

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

  const cc = characterEntity.components['character'] as ReturnType<typeof createCharacterController>;
  cc.jumpStartDuration = clips.jumpStart.duration;
  cc.jumpLandDuration = clips.jumpLand.duration;

  const characterParts = buildSkinnedEntities(
    registry, gl, charT,
    bodyScene, bodyScene.nodes, bodyMats,
  );

  return { charT, bodyScene, characterParts, clips };
};

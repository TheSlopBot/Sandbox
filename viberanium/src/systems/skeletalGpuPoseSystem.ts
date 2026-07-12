import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type MeshDraws } from '../components/meshDraws.ts';
import { type AnimationStateMachine, type AnimStateId } from '../components/animationStateMachine.ts';
import { type AnimationClipMap } from '../components/animationClipMap.ts';
import { type Children } from '../components/children.ts';
import { type BoneAttachment } from '../components/boneAttachment.ts';
import { type SkinInstance } from '../components/skin.ts';
import { type Gltf } from '../assets/gltf/types.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
  skeletonLodUpdateInterval,
} from '../engine/optimizationOptions.ts';
import { m4, m4Copy, type Mat4 } from '../math/mat4.ts';
import { type Vec3 } from '../math/vec3.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import {
  createSkeletonGpuAsset,
  type SkeletonGpuAsset,
} from '../render/gl/skeletonGpu.ts';
import {
  createSkeletalPosePass,
  type PoseAttachmentJob,
  type PoseDispatchEntry,
  type PoseMeshJob,
  type SkeletalPosePass,
} from '../render/passes/skeletalPosePass.ts';
import { clipStateIndex } from '../assets/gltf/packClipsForGpu.ts';
import { type Entity } from '../engine/entity.ts';

export type SkeletalGpuPoseOptions = {
  device: GpuDevice;
  setPreDrawEncode?: (fn: ((encoder: GPUCommandEncoder) => void) | null) => void;
  getLodOrigin?: () => Vec3;
  optimization?: EngineOptimizationOptions;
};

type GpuPoseState = {
  asset: SkeletonGpuAsset;
  slotIndex: number;
  lodAccum: number;
};

type SharedAssetEntry = {
  asset: SkeletonGpuAsset;
};

type PendingPose = {
  entity: Entity;
  model: SkeletalModel;
  meshDraws: MeshDraws;
  fsm: AnimationStateMachine;
  clipMap: AnimationClipMap;
  skin: SkinInstance;
  state: GpuPoseState;
  renderRoot: Mat4;
  skip: boolean;
  castShadow: boolean;
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const isLoopingState = (state: AnimStateId) =>
  state === 'idle' || state === 'run' || state === 'jumpAir';

export const installSkeletalGpuPoseSystem = (
  registry: Registry,
  options: SkeletalGpuPoseOptions,
) => {
  const getLodOrigin = options.getLodOrigin;
  const optimization = options.optimization ?? DEFAULT_ENGINE_OPTIMIZATION;
  const posePass: SkeletalPosePass = createSkeletalPosePass(options.device);
  const stateByModel = new WeakMap<SkeletalModel, GpuPoseState>();
  const renderRootByModel = new WeakMap<SkeletalModel, Mat4>();
  const sharedAssets = new WeakMap<Gltf, SharedAssetEntry>();
  const pending: PendingPose[] = [];
  const entries: PoseDispatchEntry[] = [];

  const ensureAsset = (
    model: SkeletalModel,
    skin: SkinInstance,
    clipMap: AnimationClipMap,
  ): SkeletonGpuAsset => {
    const gltf = model.bodyScene.gltf;

    if (model.clipsDirty) {
      const stale = sharedAssets.get(gltf);
      if (stale) {
        stale.asset.destroy();
        sharedAssets.delete(gltf);
      }
      model.clipsDirty = false;
    }

    const cached = sharedAssets.get(gltf);
    if (cached) return cached.asset;

    const asset = createSkeletonGpuAsset(
      options.device,
      model.bodyScene,
      skin.skin,
      skin.rootNodeIndex,
      clipMap,
    );
    sharedAssets.set(gltf, { asset });
    return asset;
  };

  const ensureState = (
    model: SkeletalModel,
    skin: SkinInstance,
    clipMap: AnimationClipMap,
  ): GpuPoseState => {
    const asset = ensureAsset(model, skin, clipMap);
    let state = stateByModel.get(model);
    if (state) {
      state.asset = asset;
      return state;
    }

    state = {
      asset,
      slotIndex: posePass.allocSlot(),
      lodAccum: 0,
    };
    stateByModel.set(model, state);
    return state;
  };

  const remove = registry.addAction('postUpdate', () => {
    const origin = getLodOrigin?.();
    const ox = origin ? origin[0] : 0;
    const oz = origin ? origin[2] : 0;
    const shadowDist2 = optimization.shadowCullDist * optimization.shadowCullDist;
    pending.length = 0;
    entries.length = 0;

    for (const e of registry.view(COMPONENT_KEYS.meshDraws)) {
      const model = e.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
      const meshDraws = e.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      const clipMap = e.components[COMPONENT_KEYS.animationClipMap] as AnimationClipMap | undefined;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!model || !meshDraws || !fsm || !clipMap || !t) continue;

      let skin: SkinInstance | undefined;
      for (const part of meshDraws.parts) {
        if (part.skin) {
          skin = part.skin;
          break;
        }
      }
      if (!skin) continue;

      updateWorldMatrix(t);

      const d2 = origin ? distSqXZ(t.position[0], t.position[2], ox, oz) : 0;
      const dist = origin ? Math.sqrt(d2) : 0;
      const state = ensureState(model, skin, clipMap);
      const interval = origin ? skeletonLodUpdateInterval(dist, optimization.skeletonLod) : 1;
      let skip = false;
      if (interval === 0) {
        skip = true;
      } else if (interval > 1) {
        state.lodAccum += 1;
        if (state.lodAccum < interval) skip = true;
        else state.lodAccum = 0;
      } else {
        state.lodAccum = 0;
      }
      const castShadow = !origin || d2 <= shadowDist2;

      let renderRoot = renderRootByModel.get(model);
      if (!renderRoot) {
        renderRoot = m4();
        renderRootByModel.set(model, renderRoot);
      }
      m4Copy(renderRoot, t.world);
      renderRoot[13] += model.visualYOffset;

      pending.push({
        entity: e,
        model,
        meshDraws,
        fsm,
        clipMap,
        skin,
        state,
        renderRoot,
        skip,
        castShadow,
      });
    }

    const meshBuffer = posePass.meshModelsBuffer();
    const attachmentBuffer = posePass.attachmentModelsBuffer();

    for (const item of pending) {
      const { meshDraws, fsm, skin, state, renderRoot, skip, castShadow, model } = item;
      skin.paletteGpu = posePass.paletteBinding(state.slotIndex);

      const meshJobs: PoseMeshJob[] = [];
      let meshOut = 0;

      for (const part of meshDraws.parts) {
        if (part.visible === false) continue;
        part.castShadow = castShadow;
        if (!part.model) part.model = m4();
        m4Copy(part.model as Float32Array, renderRoot);

        if (part.skin) {
          part.gpuModel = undefined;
          continue;
        }

        part.gpuModel = {
          buffer: meshBuffer,
          byteOffset: posePass.meshModelByteOffset(state.slotIndex, meshOut),
        };
        meshJobs.push({ nodeIndex: part.gltfNodeIndex, outIndex: meshOut });
        meshOut++;
      }

      const attachmentJobs: PoseAttachmentJob[] = [];
      let attachOut = 0;
      const children = item.entity.components[COMPONENT_KEYS.children] as Children | undefined;

      if (children) {
        for (const childId of children.ids) {
          const child = registry.get(childId);
          if (!child) continue;

          const attachment = child.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
          if (!attachment) continue;

          const childT = child.components[COMPONENT_KEYS.transform] as Transform | undefined;
          if (childT) m4Copy(childT.world, renderRoot);

          const childDraws = child.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
          if (!childDraws) continue;

          for (const part of childDraws.parts) {
            if (part.visible === false) continue;
            const node = attachment.attachScene.nodes[part.gltfNodeIndex];
            if (!node) continue;
            part.castShadow = castShadow;
            part.gpuModel = {
              buffer: attachmentBuffer,
              byteOffset: posePass.attachmentModelByteOffset(state.slotIndex, attachOut),
            };
            if (!part.model) part.model = m4();
            m4Copy(part.model as Float32Array, renderRoot);
            attachmentJobs.push({
              boneNodeIndex: attachment.boneNodeIndex,
              outIndex: attachOut,
              localOffset: attachment.localOffset,
              attachNodeWorld: node.worldM,
            });
            attachOut++;
          }
        }
      }

      const oneShot = fsm.current === 'jumpStart' || fsm.current === 'jumpLand';
      const time = oneShot ? fsm.stateTime : fsm.animTime;
      const speed = fsm.current === 'run' ? fsm.runPlaybackSpeed : 1;

      entries.push({
        asset: state.asset,
        slotIndex: state.slotIndex,
        skin,
        renderRoot,
        animTime: time * speed,
        clipIndex: clipStateIndex(fsm.current),
        loop: isLoopingState(fsm.current),
        skip,
        meshJobs,
        attachmentJobs,
      });

      model.poseDirty = false;
    }

    if (options.setPreDrawEncode) {
      options.setPreDrawEncode((encoder) => {
        posePass.dispatch(entries, encoder);
      });
      return;
    }

    posePass.dispatch(entries);
  }, 0);

  return () => {
    remove();
    options.setPreDrawEncode?.(null);
    posePass.destroy();
  };
};

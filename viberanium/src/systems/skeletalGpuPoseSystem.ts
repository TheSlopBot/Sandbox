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
import { type AnimClip } from '../components/animation.ts';
import { type RightHandStateMachine } from '../components/rightHandStateMachine.ts';
import { type LeftHandStateMachine } from '../components/leftHandStateMachine.ts';
import {
  type RightHandClipId,
  type RightHandClipMap,
} from '../components/rightHandClipMap.ts';
import {
  type LeftHandClipId,
  type LeftHandClipMap,
} from '../components/leftHandClipMap.ts';
import {
  createAnimationHandMasks,
  type AnimationHandMasks,
} from '../components/animationHandMasks.ts';
import { type AnimationAimOffset } from '../components/animationAimOffset.ts';
import { type AnimationPoseOverlay } from '../components/animationPoseOverlay.ts';
import { type AnimationFullBody, type FullBodyClipId } from '../components/animationFullBody.ts';
import { type EquipmentSlots } from '../components/equipmentSlots.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
  skeletonLodUpdateInterval,
} from '../engine/optimizationOptions.ts';
import { m4, m4Copy, m4Mul, type Mat4 } from '../math/mat4.ts';
import { type Vec3 } from '../math/vec3.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import {
  createSkeletonGpuAsset,
  rewriteSkeletonGpuAsset,
  type SkeletonGpuAsset,
} from '../render/gl/skeletonGpu.ts';
import {
  createSkeletalPosePass,
  FULL_BODY_CLIP_DISABLED,
  type PoseAttachmentJob,
  type PoseDispatchEntry,
  type PoseMeshJob,
  type SkeletalPosePass,
} from '../render/passes/skeletalPosePass.ts';
import {
  clipStateIndex,
  GPU_MOVEMENT_CLIP_COUNT,
  GPU_FULL_BODY_CLIP_COUNT,
} from '../assets/gltf/packClipsForGpu.ts';
import { type Entity } from '../engine/entity.ts';
import { type RuntimeScene, type RuntimeSkin } from '../assets/gltf/runtime.ts';

const _boneAttachedWorld = m4();

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
  paletteReady: boolean;
};

type SharedAssetEntry = {
  asset: SkeletonGpuAsset;
  bankKeys: Map<string, number>;
  bankClips: (AnimClip | null)[];
  movementClipMap: AnimationClipMap;
  scene: RuntimeScene;
  skin: RuntimeSkin;
  rootNodeIndex: number;
  handMasks: AnimationHandMasks;
};

type PendingPose = {
  entity: Entity;
  model: SkeletalModel;
  meshDraws: MeshDraws;
  fsm: AnimationStateMachine;
  skin: SkinInstance;
  state: GpuPoseState;
  renderRoot: Mat4;
  skip: boolean;
  castShadow: boolean;
  hasHandEquipment: boolean;
  rightHandClipMap: RightHandClipMap | undefined;
  leftHandClipMap: LeftHandClipMap | undefined;
};

type PoseEntryCommon = {
  asset: SkeletonGpuAsset;
  slotIndex: number;
  skin: SkinInstance;
  renderRoot: Mat4;
  moveAnimTime: number;
  moveClipIndex: number;
  moveLoop: boolean;
  fullBodyClipIndex: number;
  fullBodyAnimTime: number;
  torsoYawRad: number;
  headYawRad: number;
  spineNodeIndex: number;
  headNodeIndex: number;
  skip: boolean;
  meshJobs: readonly PoseMeshJob[];
  attachmentJobs: readonly PoseAttachmentJob[];
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const isLoopingState = (state: AnimStateId) =>
  state === 'idle' || state === 'run' || state === 'walkBack' || state === 'jumpAir';

const isRightHandLooping = (state: string) => state === 'idleHold' || state === 'aim';

const isLeftHandLooping = (state: string) => state === 'idleHold' || state === 'block';

const RIGHT_HAND_CLIP_IDS: readonly RightHandClipId[] = [
  'idleHold',
  'aim',
  'attack',
  'reload',
];

const LEFT_HAND_CLIP_IDS: readonly LeftHandClipId[] = ['idleHold', 'block', 'attack'];

const hasAnyHandEquipment = (equipment: EquipmentSlots | undefined): boolean =>
  !!equipment?.right.equippedId || !!equipment?.left.equippedId;

const buildBasePoseEntry = (common: PoseEntryCommon): PoseDispatchEntry => ({
  ...common,
  rightAnimTime: common.moveAnimTime,
  rightClipIndex: common.moveClipIndex,
  rightLoop: common.moveLoop,
  leftAnimTime: common.moveAnimTime,
  leftClipIndex: common.moveClipIndex,
  leftLoop: common.moveLoop,
  layerMode: 0,
});

const buildHitUpperBlendEntry = (common: PoseEntryCommon): PoseDispatchEntry => ({
  ...common,
  rightAnimTime: common.moveAnimTime,
  rightClipIndex: common.moveClipIndex,
  rightLoop: common.moveLoop,
  leftAnimTime: common.moveAnimTime,
  leftClipIndex: common.moveClipIndex,
  leftLoop: common.moveLoop,
  layerMode: 2,
});

const buildLayeredPoseEntry = (
  common: PoseEntryCommon,
  rightFsm: RightHandStateMachine | undefined,
  leftFsm: LeftHandStateMachine | undefined,
  rightHandClipMap: RightHandClipMap | undefined,
  leftHandClipMap: LeftHandClipMap | undefined,
): PoseDispatchEntry => {
  const rightState = rightFsm?.current ?? 'none';
  const leftState = leftFsm?.current ?? 'none';
  const rightUsesMove = rightState === 'none';
  const leftUsesMove = leftState === 'none';
  const rightGpu = !rightUsesMove
    ? rightHandClipMap?.gpuIndices[rightState as RightHandClipId]
    : undefined;
  const leftGpu = !leftUsesMove
    ? leftHandClipMap?.gpuIndices[leftState as LeftHandClipId]
    : undefined;

  return {
    ...common,
    rightAnimTime: rightUsesMove
      ? common.moveAnimTime
      : rightFsm
        ? rightState === 'attack' || rightState === 'reload'
          ? rightFsm.stateTime
          : rightFsm.animTime
        : 0,
    rightClipIndex: rightUsesMove ? common.moveClipIndex : (rightGpu ?? common.moveClipIndex),
    rightLoop: rightUsesMove ? common.moveLoop : isRightHandLooping(rightState),
    leftAnimTime: leftUsesMove
      ? common.moveAnimTime
      : leftFsm
        ? leftState === 'attack'
          ? leftFsm.stateTime
          : leftFsm.animTime
        : 0,
    leftClipIndex: leftUsesMove ? common.moveClipIndex : (leftGpu ?? common.moveClipIndex),
    leftLoop: leftUsesMove ? common.moveLoop : isLeftHandLooping(leftState),
    layerMode: 1,
  };
};

const FULL_BODY_CLIP_IDS: readonly FullBodyClipId[] = ['hit', 'death', 'deathPose'];

const ensureFullBodyBankSlots = (entry: SharedAssetEntry): void => {
  while (entry.bankClips.length < GPU_FULL_BODY_CLIP_COUNT) {
    entry.bankClips.push(null);
  }
};

const bankEntriesOf = (entry: SharedAssetEntry) =>
  entry.bankClips.map((clip) => ({ clip }));

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

  const rewriteShared = (entry: SharedAssetEntry): void => {
    rewriteSkeletonGpuAsset(
      options.device,
      entry.asset,
      entry.scene,
      entry.skin,
      entry.movementClipMap,
      {
        bankEntries: bankEntriesOf(entry),
        handMasks: entry.handMasks,
      },
    );
  };

  const registerFullBodyClips = (
    entry: SharedAssetEntry,
    fullBody: AnimationFullBody | undefined,
  ): boolean => {
    if (!fullBody) return false;

    ensureFullBodyBankSlots(entry);
    let grew = false;

    for (let i = 0; i < FULL_BODY_CLIP_IDS.length; i++) {
      const clipId = FULL_BODY_CLIP_IDS[i]!;
      const anim = fullBody.clips[clipId];
      if (!anim) continue;

      const gpuIndex = GPU_MOVEMENT_CLIP_COUNT + i;
      const key = `fullBody:${clipId}`;

      if (!entry.bankKeys.has(key)) {
        entry.bankClips[i] = anim.clip;
        entry.bankKeys.set(key, gpuIndex);
        grew = true;
      }

      fullBody.gpuIndices[clipId] = gpuIndex;
      fullBody.durations[clipId] = entry.bankClips[i]?.duration ?? anim.clip.duration;
    }

    return grew;
  };

  const registerHandClips = (
    entry: SharedAssetEntry,
    rightHandClipMap: RightHandClipMap | undefined,
    leftHandClipMap: LeftHandClipMap | undefined,
    rightSourceId: string,
    leftSourceId: string,
  ): boolean => {
    let grew = false;

    ensureFullBodyBankSlots(entry);

    if (rightHandClipMap) {
      for (const clipId of RIGHT_HAND_CLIP_IDS) {
        const anim = rightHandClipMap.clips[clipId];
        if (!anim) continue;
        const key = `right:${rightSourceId}:${clipId}`;
        let idx = entry.bankKeys.get(key);
        if (idx === undefined) {
          idx = GPU_MOVEMENT_CLIP_COUNT + entry.bankClips.length;
          entry.bankClips.push(anim.clip);
          entry.bankKeys.set(key, idx);
          grew = true;
        }
        rightHandClipMap.gpuIndices[clipId] = idx;
      }
    }

    if (leftHandClipMap) {
      for (const clipId of LEFT_HAND_CLIP_IDS) {
        const anim = leftHandClipMap.clips[clipId];
        if (!anim) continue;
        const key = `left:${leftSourceId}:${clipId}`;
        let idx = entry.bankKeys.get(key);
        if (idx === undefined) {
          idx = GPU_MOVEMENT_CLIP_COUNT + entry.bankClips.length;
          entry.bankClips.push(anim.clip);
          entry.bankKeys.set(key, idx);
          grew = true;
        }
        leftHandClipMap.gpuIndices[clipId] = idx;
      }
    }

    return grew;
  };

  const ensureSharedEntry = (
    model: SkeletalModel,
    skin: SkinInstance,
    clipMap: AnimationClipMap,
    handMasks: AnimationHandMasks | undefined,
  ): SharedAssetEntry => {
    const gltf = model.bodyScene.gltf;
    const cached = sharedAssets.get(gltf);
    if (cached) return cached;

    const masks = handMasks ?? createAnimationHandMasks(model.bodyScene);
    const asset = createSkeletonGpuAsset(
      options.device,
      model.bodyScene,
      skin.skin,
      skin.rootNodeIndex,
      clipMap,
      { handMasks: masks },
    );
    const entry: SharedAssetEntry = {
      asset,
      bankKeys: new Map(),
      bankClips: [],
      movementClipMap: clipMap,
      scene: model.bodyScene,
      skin: skin.skin,
      rootNodeIndex: skin.rootNodeIndex,
      handMasks: masks,
    };
    sharedAssets.set(gltf, entry);
    return entry;
  };

  const fullBodyNeedsBank = (fullBody: AnimationFullBody | undefined): boolean => {
    if (!fullBody) return false;
    return (
      fullBody.gpuIndices.hit < 0 ||
      fullBody.gpuIndices.death < 0 ||
      fullBody.gpuIndices.deathPose < 0
    );
  };

  const ensureState = (
    model: SkeletalModel,
    skin: SkinInstance,
    clipMap: AnimationClipMap,
    fullBody: AnimationFullBody | undefined,
    rightHandClipMap: RightHandClipMap | undefined,
    leftHandClipMap: LeftHandClipMap | undefined,
    handMasks: AnimationHandMasks | undefined,
    rightSourceId: string,
    leftSourceId: string,
  ): GpuPoseState => {
    const entry = ensureSharedEntry(model, skin, clipMap, handMasks);

    if (model.clipsDirty) {
      entry.movementClipMap = clipMap;
      entry.scene = model.bodyScene;
      entry.skin = skin.skin;
      entry.rootNodeIndex = skin.rootNodeIndex;
      if (handMasks) entry.handMasks = handMasks;
      registerFullBodyClips(entry, fullBody);
      registerHandClips(
        entry,
        rightHandClipMap,
        leftHandClipMap,
        rightSourceId,
        leftSourceId,
      );
      rewriteShared(entry);
      model.clipsDirty = false;
    } else {
      const fullBodyGrew = fullBodyNeedsBank(fullBody)
        ? registerFullBodyClips(entry, fullBody)
        : false;
      const handGrew =
        rightHandClipMap || leftHandClipMap
          ? registerHandClips(
              entry,
              rightHandClipMap,
              leftHandClipMap,
              rightSourceId,
              leftSourceId,
            )
          : false;
      if (fullBodyGrew || handGrew) rewriteShared(entry);
    }

    let state = stateByModel.get(model);
    if (state) {
      state.asset = entry.asset;
      return state;
    }

    state = {
      asset: entry.asset,
      slotIndex: posePass.allocSlot(),
      lodAccum: 0,
      paletteReady: false,
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

      const rightHandClipMap = e.components[COMPONENT_KEYS.rightHandClipMap] as
        | RightHandClipMap
        | undefined;
      const leftHandClipMap = e.components[COMPONENT_KEYS.leftHandClipMap] as
        | LeftHandClipMap
        | undefined;
      const handMasks = e.components[COMPONENT_KEYS.animationHandMasks] as
        | AnimationHandMasks
        | undefined;
      const equipment = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
      const fullBody = e.components[COMPONENT_KEYS.animationFullBody] as
        | AnimationFullBody
        | undefined;
      const hasHandEquipment = hasAnyHandEquipment(equipment);
      const rightSourceId = equipment?.right.equippedId ?? 'none';
      const leftSourceId = equipment?.left.equippedId ?? 'none';

      const d2 = origin ? distSqXZ(t.position[0], t.position[2], ox, oz) : 0;
      const dist = origin ? Math.sqrt(d2) : 0;
      const state = ensureState(
        model,
        skin,
        clipMap,
        fullBody,
        hasHandEquipment ? rightHandClipMap : undefined,
        hasHandEquipment ? leftHandClipMap : undefined,
        handMasks,
        rightSourceId,
        leftSourceId,
      );
      const interval = origin ? skeletonLodUpdateInterval(dist, optimization.skeletonLod) : 1;
      let skip = false;
      if (fullBody?.frozen && state.paletteReady) {
        skip = true;
      } else if (interval === 0) {
        skip = true;
      } else if (interval > 1) {
        state.lodAccum += 1;
        if (state.lodAccum < interval) skip = true;
        else state.lodAccum = 0;
      } else {
        state.lodAccum = 0;
      }
      if (!state.paletteReady) skip = false;
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
        skin,
        state,
        renderRoot,
        skip,
        castShadow,
        hasHandEquipment,
        rightHandClipMap: hasHandEquipment ? rightHandClipMap : undefined,
        leftHandClipMap: hasHandEquipment ? leftHandClipMap : undefined,
      });
    }

    const meshBuffer = posePass.meshModelsBuffer();
    const attachmentBuffer = posePass.attachmentModelsBuffer();

    for (const item of pending) {
      const {
        meshDraws,
        fsm,
        skin,
        state,
        renderRoot,
        skip,
        castShadow,
        model,
        hasHandEquipment,
        rightHandClipMap,
        leftHandClipMap,
      } = item;
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

          const childDraws = child.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
          if (!childDraws) continue;

          const childT = child.components[COMPONENT_KEYS.transform] as Transform | undefined;
          const boneNode = item.model.bodyScene.nodes[attachment.boneNodeIndex];
          if (childT && boneNode && !child.components[COMPONENT_KEYS.collider]) {
            m4Mul(_boneAttachedWorld, renderRoot, boneNode.worldM);
            m4Mul(childT.world, _boneAttachedWorld, attachment.localOffset);
            childT.dirty = false;
          }

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
      const movePlaybackSpeed =
        fsm.current === 'run'
          ? fsm.runPlaybackSpeed
          : fsm.current === 'walkBack'
            ? fsm.runPlaybackSpeed * 1.5
            : 1;
      const moveTime = (oneShot ? fsm.stateTime : fsm.animTime) * movePlaybackSpeed;
      const moveClip = clipStateIndex(fsm.current);
      const moveLoop = isLoopingState(fsm.current);

      const aim = item.entity.components[COMPONENT_KEYS.animationAimOffset] as
        | AnimationAimOffset
        | undefined;
      const overlay = item.entity.components[COMPONENT_KEYS.animationPoseOverlay] as
        | AnimationPoseOverlay
        | undefined;
      const fullBody = item.entity.components[COMPONENT_KEYS.animationFullBody] as
        | AnimationFullBody
        | undefined;
      const handMasks = item.entity.components[COMPONENT_KEYS.animationHandMasks] as
        | AnimationHandMasks
        | undefined;

      const fullBodyActive =
        fullBody?.active != null && fullBody.gpuIndices[fullBody.active] >= 0
          ? fullBody.active
          : null;
      const fullBodyGpuIndex =
        fullBodyActive != null && fullBody
          ? fullBody.gpuIndices[fullBodyActive]
          : FULL_BODY_CLIP_DISABLED;
      const hitUpperBlend = fullBodyActive === 'hit';

      const common: PoseEntryCommon = {
        asset: state.asset,
        slotIndex: state.slotIndex,
        skin,
        renderRoot,
        moveAnimTime: moveTime,
        moveClipIndex: moveClip,
        moveLoop,
        fullBodyClipIndex: fullBodyGpuIndex,
        fullBodyAnimTime: fullBodyActive != null && fullBody ? fullBody.animTime : 0,
        torsoYawRad:
          (aim?.enabled ? (aim.torsoYawRad ?? 0) : 0) + (overlay?.spineYawRad ?? 0),
        headYawRad:
          (aim?.enabled ? (aim.headYawRad ?? 0) : 0) + (overlay?.headYawRad ?? 0),
        spineNodeIndex: handMasks?.spineNodeIndex ?? 0,
        headNodeIndex: handMasks?.headNodeIndex ?? 0,
        skip,
        meshJobs,
        attachmentJobs,
      };

      if (hitUpperBlend) {
        entries.push(buildHitUpperBlendEntry(common));
      } else if (hasHandEquipment) {
        const rightFsm = item.entity.components[COMPONENT_KEYS.rightHandStateMachine] as
          | RightHandStateMachine
          | undefined;
        const leftFsm = item.entity.components[COMPONENT_KEYS.leftHandStateMachine] as
          | LeftHandStateMachine
          | undefined;
        entries.push(
          buildLayeredPoseEntry(common, rightFsm, leftFsm, rightHandClipMap, leftHandClipMap),
        );
      } else {
        entries.push(buildBasePoseEntry(common));
      }

      if (!skip) state.paletteReady = true;

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

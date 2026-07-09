import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type AnimationStateMachine, type AnimStateId } from '../components/animationStateMachine.ts';
import { type AnimationClipMap } from '../components/animationClipMap.ts';
import { type AnimClip, getClipAnimatedNodes, sampleClipToNodes } from '../components/animation.ts';
import { type RuntimePose, snapshotPose, updateWorldFromLocalsDirty } from '../assets/gltf/runtime.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
  skeletonSkipChanceForDist,
} from '../engine/optimizationOptions.ts';
import { type Vec3 } from '../math/vec3.ts';

export type SkeletalPoseOptions = {
  getLodOrigin?: () => Vec3;
  optimization?: EngineOptimizationOptions;
};

type PoseCache = {
  bindPose: RuntimePose;
  dirty: Uint8Array;
  lastClip: AnimClip | null;
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const isLoopingState = (state: AnimStateId) =>
  state === 'idle' || state === 'run' || state === 'jumpAir';

const restoreBindExcept = (
  nodes: SkeletalModel['bodyScene']['nodes'],
  bindPose: RuntimePose,
  keep: Set<number>,
) => {
  for (let i = 0; i < nodes.length; i++) {
    if (keep.has(i)) continue;
    nodes[i]!.localT.set(bindPose.t[i]!);
    nodes[i]!.localS.set(bindPose.s[i]!);
    nodes[i]!.localR.set(bindPose.r[i]!);
  }
};

export const installSkeletalPoseSystem = (registry: Registry, options: SkeletalPoseOptions = {}) => {
  const poseCache = new WeakMap<SkeletalModel, PoseCache>();
  const getLodOrigin = options.getLodOrigin;
  const optimization = options.optimization ?? DEFAULT_ENGINE_OPTIMIZATION;

  return registry.addAction('update', () => {
    const origin = getLodOrigin?.();
    const ox = origin ? origin[0] : 0;
    const oz = origin ? origin[2] : 0;

    for (const e of registry.view(COMPONENT_KEYS.meshDraws)) {
      const model = e.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      const clipMap = e.components[COMPONENT_KEYS.animationClipMap] as AnimationClipMap | undefined;
      if (!model || !fsm || !clipMap) continue;

      const activeClip = clipMap.clips[fsm.current];
      if (!activeClip) continue;

      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!t) continue;

      const d2 = origin ? distSqXZ(t.position[0], t.position[2], ox, oz) : 0;
      const dist = origin ? Math.sqrt(d2) : 0;
      const skipChance = origin ? skeletonSkipChanceForDist(dist, optimization.skeletonLod) : 0;
      if (skipChance > 0 && (skipChance >= 1 || Math.random() < skipChance)) continue;

      const { bodyScene } = model;
      const nodes = bodyScene.nodes;
      const clip = activeClip.clip;
      const animated = getClipAnimatedNodes(clip);

      let cache = poseCache.get(model);
      if (!cache) {
        cache = {
          bindPose: snapshotPose(nodes),
          dirty: new Uint8Array(nodes.length),
          lastClip: null,
        };
        poseCache.set(model, cache);
      }

      if (cache.dirty.length !== nodes.length) {
        cache.dirty = new Uint8Array(nodes.length);
        cache.bindPose = snapshotPose(nodes);
        cache.lastClip = null;
      }

      if (cache.lastClip !== clip) {
        if (cache.lastClip) {
          const keep = new Set(animated);
          restoreBindExcept(nodes, cache.bindPose, keep);
          cache.dirty.fill(1);
        } else {
          for (let i = 0; i < nodes.length; i++) {
            nodes[i]!.localT.set(cache.bindPose.t[i]!);
            nodes[i]!.localS.set(cache.bindPose.s[i]!);
            nodes[i]!.localR.set(cache.bindPose.r[i]!);
          }
          cache.dirty.fill(1);
        }
        cache.lastClip = clip;
      } else {
        cache.dirty.fill(0);
        for (let i = 0; i < animated.length; i++) cache.dirty[animated[i]!] = 1;
      }

      const oneShot = fsm.current === 'jumpStart' || fsm.current === 'jumpLand';
      const time = oneShot ? fsm.stateTime : fsm.animTime;
      const speed = fsm.current === 'run' ? fsm.runPlaybackSpeed : 1;

      sampleClipToNodes(clip, nodes, time * speed, 1, isLoopingState(fsm.current));
      updateWorldFromLocalsDirty(nodes, cache.dirty);
      model.poseDirty = true;
    }
  }, 18);
};

import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type AnimationStateMachine, type AnimStateId } from '../components/animationStateMachine.ts';
import { type AnimationClipMap } from '../components/animationClipMap.ts';
import { sampleClipToNodes } from '../components/animation.ts';
import { snapshotPose, updateWorldFromLocals } from '../assets/gltf/runtime.ts';
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

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const isLoopingState = (state: AnimStateId) =>
  state === 'idle' || state === 'run' || state === 'jumpAir';

export const installSkeletalPoseSystem = (registry: Registry, options: SkeletalPoseOptions = {}) => {
  const bindPoseCache = new WeakMap<SkeletalModel, ReturnType<typeof snapshotPose>>();
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

      let bindPose = bindPoseCache.get(model);
      if (!bindPose) {
        bindPose = snapshotPose(bodyScene.nodes);
        bindPoseCache.set(model, bindPose);
      }

      for (let i = 0; i < bodyScene.nodes.length; i++) {
        bodyScene.nodes[i].localT.set(bindPose.t[i]);
        bodyScene.nodes[i].localS.set(bindPose.s[i]);
        bodyScene.nodes[i].localR.set(bindPose.r[i]);
      }

      const oneShot = fsm.current === 'jumpStart' || fsm.current === 'jumpLand';
      const time = oneShot ? fsm.stateTime : fsm.animTime;
      const speed = fsm.current === 'run' ? fsm.runPlaybackSpeed : 1;

      sampleClipToNodes(activeClip.clip, bodyScene.nodes, time * speed, 1, isLoopingState(fsm.current));

      updateWorldFromLocals(bodyScene.nodes);
    }
  }, 18);
};

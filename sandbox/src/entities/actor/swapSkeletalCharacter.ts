import {
  type Entity,
  type AnimClip,
  type AnimStateId,
  createAnimationClip,
  COMPONENT_KEYS,
  type AnimationClipMap,
} from 'viberanium';

export const swapAnimationClip = (entity: Entity, state: AnimStateId, clip: AnimClip): void => {
  const clipMap = entity.components[COMPONENT_KEYS.animationClipMap] as AnimationClipMap | undefined;
  if (!clipMap) return;

  clipMap.clips[state] = createAnimationClip(clip);
};

export const swapAllAnimationClips = (entity: Entity, clip: AnimClip): void => {
  const clipMap = entity.components[COMPONENT_KEYS.animationClipMap] as AnimationClipMap | undefined;
  if (!clipMap) return;

  const wrapped = createAnimationClip(clip);
  const states: AnimStateId[] = ['idle', 'run', 'walkBack', 'jumpStart', 'jumpAir', 'jumpLand'];
  for (const state of states) clipMap.clips[state] = wrapped;
};

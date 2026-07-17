import { type Entity, COMPONENT_KEYS, type AnimationFullBody } from 'viberanium';
import { type SkeletalCharacterLoad } from '../actor/loadSkeletalCharacter.ts';

export const wireFullBodyClips = (entity: Entity, loaded: SkeletalCharacterLoad): void => {
  const fullBody = entity.components[COMPONENT_KEYS.animationFullBody] as AnimationFullBody | undefined;
  if (!fullBody) return;

  fullBody.clips.hit = loaded.clips.hit;
  fullBody.clips.death = loaded.clips.death;
  fullBody.clips.deathPose = loaded.clips.deathPose;
  fullBody.durations.hit = loaded.clips.hit.clip.duration;
  fullBody.durations.death = loaded.clips.death.clip.duration;
  fullBody.durations.deathPose = loaded.clips.deathPose.clip.duration;
};

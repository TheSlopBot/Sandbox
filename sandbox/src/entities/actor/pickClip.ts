import { type AnimClip } from 'viberanium';
import { type SkeletalCharacterDef } from '../../catalog/characters/characterDef.ts';

export const pickClip = (clips: AnimClip[], name: string): AnimClip => {
  const exact = clips.find((clip) => clip.name === name);
  if (exact) return exact;

  const needle = name.toLowerCase();
  const partial = clips.find((clip) => clip.name.toLowerCase().includes(needle));
  if (partial) return partial;

  if (needle === 'death_pose_a' || needle === 'death_a_pose') {
    const kaykitPose = clips.find((clip) => {
      const n = clip.name.toLowerCase();
      return n.includes('death') && n.includes('pose');
    });
    if (kaykitPose) return kaykitPose;
  }

  if (clips[0]) return clips[0];

  throw new Error(`No clip found matching '${name}'`);
};

export type { SkeletalCharacterDef };

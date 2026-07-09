import { type AnimClip } from 'viberanium';
import { type SkeletalCharacterDef } from '../../catalog/types/character.ts';

export const pickClip = (clips: AnimClip[], name: string): AnimClip => {
  const exact = clips.find((clip) => clip.name === name);
  if (exact) return exact;

  const partial = clips.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase()));
  if (partial) return partial;

  if (clips[0]) return clips[0];

  throw new Error(`No clip found matching '${name}'`);
};

export type { SkeletalCharacterDef };

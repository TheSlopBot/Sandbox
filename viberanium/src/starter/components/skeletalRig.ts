import { type AnimClip } from '../../components/animation.ts';
import { type SkinInstance } from '../../components/skin.ts';
import { type RuntimeScene } from '../../assets/gltf/runtime.ts';

export type AnimClips = {
  idle: AnimClip;
  run: AnimClip;
  jumpStart: AnimClip;
  jumpIdle: AnimClip;
  jumpLand: AnimClip;
};

export type CharacterPart = {
  skinInst: SkinInstance;
  renderEntityIds: number[];
};

export type SkeletalRig = {
  bodyScene: RuntimeScene;
  characterParts: CharacterPart[];
  clips: AnimClips;
  visualYOffset: number;
};

export const createSkeletalRig = (
  bodyScene: RuntimeScene,
  characterParts: CharacterPart[],
  clips: AnimClips,
  visualYOffset = -0.55,
): SkeletalRig => ({
  bodyScene,
  characterParts,
  clips,
  visualYOffset,
});

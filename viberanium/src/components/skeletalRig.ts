import { type AnimClip } from './animation.ts';
import { type SkinInstance } from './skin.ts';
import { type RuntimeScene } from '../assets/gltf/runtime.ts';
import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Renderable } from './renderable.ts';
import { type Mat4, m4, m4FromTRSQuat } from '../math/mat4.ts';
import { v3 } from '../math/vec3.ts';
import { q4, q4Normalize } from '../math/quat.ts';

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

export type RigAttachment = {
  id: string;
  scene: RuntimeScene;
  boneNodeIndex: number;
  localOffset: Mat4;
  renderEntityIds: number[];
  visible: boolean;
};

export type SkeletalRig = {
  bodyScene: RuntimeScene;
  characterParts: CharacterPart[];
  renderEntityIds: number[];
  clips: AnimClips;
  visualYOffset: number;
  attachments: RigAttachment[];
};

export const createAttachmentOffset = (
  t: [number, number, number] = [0, 0, 0],
  r: [number, number, number, number] = [0, 0, 0, 1],
  s: [number, number, number] = [1, 1, 1],
): Mat4 => {
  const out = m4();
  const tv = v3(t[0], t[1], t[2]);
  const rv = q4(r[0], r[1], r[2], r[3]);
  q4Normalize(rv, rv);
  const sv = v3(s[0], s[1], s[2]);
  m4FromTRSQuat(out, tv, rv, sv);
  return out;
};

export const setRigAttachmentVisible = (registry: Registry, attachment: RigAttachment, visible: boolean): void => {
  attachment.visible = visible;

  for (const renderId of attachment.renderEntityIds) {
    const re = registry.get(renderId);
    if (!re) continue;

    const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
    if (r) r.visible = visible;
  }
};

export const createSkeletalRig = (
  bodyScene: RuntimeScene,
  characterParts: CharacterPart[],
  renderEntityIds: number[],
  clips: AnimClips,
  visualYOffset = -0.55,
  attachments: RigAttachment[] = [],
): SkeletalRig => ({
  bodyScene,
  characterParts,
  renderEntityIds,
  clips,
  visualYOffset,
  attachments,
});

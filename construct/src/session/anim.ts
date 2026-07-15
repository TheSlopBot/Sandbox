import {
  type Entity,
  type Registry,
  type SkeletalModel,
  buildRetargetedClips,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createCharacterController,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import { type ConstructAnim } from '../entities/orbit/constructAnim.ts';
import {
  type ConstructLoadedAnimationPack,
  type ConstructSessionDeps,
  type ConstructSessionState,
} from './types.ts';

const ANIMATION_STATES = ['idle', 'run', 'walkBack', 'jumpStart', 'jumpAir', 'jumpLand'] as const;

const getActiveCharacterEntity = (registry: Registry): Entity | undefined =>
  registry.view(COMPONENT_KEYS.skeletalModel)[0];

const getConstructAnim = (registry: Registry): ConstructAnim | null =>
  (registry.view(CONSTRUCT_KEYS.constructAnim)[0]?.components[
    CONSTRUCT_KEYS.constructAnim
  ] ?? null) as ConstructAnim | null;

const applyEmptyBindPoseClips = (entity: Entity) => {
  const wrapped = createAnimationClip({ name: 'idle', duration: 1, channels: [] });

  const clipMap = entity.components[COMPONENT_KEYS.animationClipMap] as
    | ReturnType<typeof createAnimationClipMap>
    | undefined;
  if (clipMap) {
    for (const state of ANIMATION_STATES) clipMap.clips[state] = wrapped;
  }

  const fsm = entity.components[COMPONENT_KEYS.animationStateMachine] as
    | ReturnType<typeof createAnimationStateMachine>
    | undefined;
  if (fsm) {
    fsm.current = 'idle';
    fsm.stateTime = 0;
    fsm.animTime = 0;
    fsm.paused = false;
  }

  const model = entity.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (model) {
    model.poseDirty = true;
    model.clipsDirty = true;
  }
};

export const loadAnimationPack = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  packUrl: string,
): Promise<ConstructLoadedAnimationPack> => {
  const entity = getActiveCharacterEntity(deps.registry);
  const model = entity?.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (!model) return { packUrl, clipNames: [] };

  const loadedAnim = await deps.gltfCache.getOrLoad(packUrl);
  const clips = buildRetargetedClips(loadedAnim, model.bodyScene.nodes);

  state.currentClipsByName = new Map(clips.map((c) => [c.name, c]));

  const anim = getConstructAnim(deps.registry);
  if (anim) {
    anim.selectedAnimUrl = packUrl;
    anim.availableClipNames = clips.map((c) => c.name);
    if (!anim.selectedClipName || !state.currentClipsByName.has(anim.selectedClipName)) {
      anim.selectedClipName = clips[0]?.name ?? null;
    }
  }

  return { packUrl, clipNames: clips.map((c) => c.name) };
};

export const applyClip = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  clipName: string,
) => {
  const entity = getActiveCharacterEntity(deps.registry);
  if (!entity) return;

  const clip = state.currentClipsByName.get(clipName);
  if (!clip) return;

  const wrapped = createAnimationClip(clip);
  const clipMap = entity.components[COMPONENT_KEYS.animationClipMap] as
    | ReturnType<typeof createAnimationClipMap>
    | undefined;
  if (clipMap) {
    for (const s of ANIMATION_STATES) clipMap.clips[s] = wrapped;
  }

  const fsm = entity.components[COMPONENT_KEYS.animationStateMachine] as
    | ReturnType<typeof createAnimationStateMachine>
    | undefined;
  if (fsm) {
    fsm.current = 'idle';
    fsm.stateTime = 0;
    fsm.animTime = 0;
    fsm.paused = false;
  }

  const cc = entity.components[COMPONENT_KEYS.character] as
    | ReturnType<typeof createCharacterController>
    | undefined;
  if (cc) {
    cc.velocity[0] = 0;
    cc.velocity[2] = 0;
  }

  const model = entity.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (model) {
    model.poseDirty = true;
    model.clipsDirty = true;
  }

  const anim = getConstructAnim(deps.registry);
  if (anim) anim.selectedClipName = clipName;
};

export const clearAnimationPreview = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  const entity = getActiveCharacterEntity(deps.registry);
  if (entity) applyEmptyBindPoseClips(entity);

  state.currentClipsByName = new Map();

  const anim = getConstructAnim(deps.registry);
  if (anim) {
    anim.selectedAnimUrl = null;
    anim.selectedClipName = null;
    anim.availableClipNames = [];
  }
};

export const resetToBindPose = (deps: ConstructSessionDeps) => {
  const entity = getActiveCharacterEntity(deps.registry);
  if (entity) applyEmptyBindPoseClips(entity);

  const anim = getConstructAnim(deps.registry);
  if (anim) anim.selectedClipName = null;
};

export const setAnimationPaused = (deps: ConstructSessionDeps, paused: boolean) => {
  const entity = getActiveCharacterEntity(deps.registry);
  if (!entity) return;

  const fsm = entity.components[COMPONENT_KEYS.animationStateMachine] as
    | ReturnType<typeof createAnimationStateMachine>
    | undefined;
  if (fsm) fsm.paused = paused;
};

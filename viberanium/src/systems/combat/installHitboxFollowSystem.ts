import { type Registry } from '../../engine/registry.ts';
import { type Entity } from '../../engine/entity.ts';
import { type Collider, bakeColliderWorldFromLocal } from '../../components/collider.ts';
import { type Transform, updateWorldMatrix } from '../../components/transform.ts';
import { type ChildOf } from '../../components/childOf.ts';
import { type LocalTransform } from '../../components/localTransform.ts';
import { type BoneAttachment } from '../../components/boneAttachment.ts';
import { type Children } from '../../components/children.ts';
import { type SkeletalModel } from '../../components/skeletalModel.ts';
import { type AnimationStateMachine } from '../../components/animationStateMachine.ts';
import { type AnimationClipMap } from '../../components/animationClipMap.ts';
import { sampleClipToNodes } from '../../components/animation.ts';
import {
  updateWorldFromLocals,
  type RuntimeNode,
  type RuntimeScene,
} from '../../assets/gltf/runtime.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { m4Mul, m4Copy, m4FromTRSQuat, m4, type Mat4 } from '../../math/mat4.ts';
import { v3 } from '../../math/vec3.ts';
import { q4, q4Copy } from '../../math/quat.ts';

const _world = m4();
const _renderRoot = m4();
const _boneWorld = m4();
const _localM = m4();

const bindWorldNodesByScene = new WeakMap<RuntimeScene, RuntimeNode[]>();
const collisionModelOffsetByEntity = new WeakMap<Entity, Mat4>();

type CharacterPoseScratch = {
  scene: RuntimeScene;
  nodes: RuntimeNode[];
  chainMask: Uint8Array;
  childrenLength: number;
};

const scratchByCharacter = new WeakMap<Entity, CharacterPoseScratch>();
const sampledCharacters = new Set<Entity>();

const cloneNodesForPose = (source: readonly RuntimeNode[]): RuntimeNode[] => {
  const nodes: RuntimeNode[] = new Array(source.length);
  for (let i = 0; i < source.length; i++) {
    const n = source[i]!;
    nodes[i] = {
      name: n.name,
      parent: n.parent,
      children: n.children,
      localT: v3(n.localT[0], n.localT[1], n.localT[2]),
      localR: q4(n.localR[0], n.localR[1], n.localR[2], n.localR[3]),
      localS: v3(n.localS[0], n.localS[1], n.localS[2]),
      localM: m4(),
      worldM: m4(),
    };
  }
  return nodes;
};

const ensureBindWorldNodes = (scene: RuntimeScene): RuntimeNode[] => {
  let nodes = bindWorldNodesByScene.get(scene);
  if (nodes) return nodes;

  nodes = cloneNodesForPose(scene.nodes);
  updateWorldFromLocals(nodes, scene.nodeTopoOrder);
  bindWorldNodesByScene.set(scene, nodes);
  return nodes;
};

const markChain = (mask: Uint8Array, nodes: readonly RuntimeNode[], nodeIndex: number): void => {
  let i = nodeIndex;
  while (i >= 0 && mask[i] === 0) {
    mask[i] = 1;
    i = nodes[i]!.parent;
  }
};

const collectAnimatedHitboxBones = (
  registry: Registry,
  ids: readonly number[],
  out: number[],
): void => {
  for (const id of ids) {
    const entity = registry.get(id);
    if (!entity) continue;

    const boneAtt = entity.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
    const collider = entity.components[COMPONENT_KEYS.collider] as Collider | undefined;
    if (boneAtt && collider && !collider.characterCollision) out.push(boneAtt.boneNodeIndex);

    const children = entity.components[COMPONENT_KEYS.children] as Children | undefined;
    if (children && children.ids.length > 0) collectAnimatedHitboxBones(registry, children.ids, out);
  }
};

const buildChainMask = (
  registry: Registry,
  character: Entity,
  nodes: readonly RuntimeNode[],
): Uint8Array => {
  const mask = new Uint8Array(nodes.length);
  const bones: number[] = [];
  const children = character.components[COMPONENT_KEYS.children] as Children | undefined;
  if (children && children.ids.length > 0) collectAnimatedHitboxBones(registry, children.ids, bones);
  for (const boneNodeIndex of bones) markChain(mask, nodes, boneNodeIndex);
  return mask;
};

const ensureScratch = (
  registry: Registry,
  character: Entity,
  scene: RuntimeScene,
): CharacterPoseScratch => {
  const children = character.components[COMPONENT_KEYS.children] as Children | undefined;
  const childrenLength = children?.ids.length ?? 0;

  let scratch = scratchByCharacter.get(character);
  if (scratch && scratch.scene === scene && scratch.childrenLength === childrenLength) {
    return scratch;
  }

  const nodes = cloneNodesForPose(scene.nodes);
  scratch = { scene, nodes, chainMask: buildChainMask(registry, character, nodes), childrenLength };
  scratchByCharacter.set(character, scratch);
  return scratch;
};

const applyBindPoseMasked = (
  nodes: RuntimeNode[],
  bindNodes: RuntimeNode[],
  mask: Uint8Array,
): void => {
  for (let i = 0; i < nodes.length; i++) {
    if (!mask[i]) continue;
    const src = bindNodes[i]!;
    nodes[i]!.localT.set(src.localT);
    nodes[i]!.localS.set(src.localS);
    q4Copy(nodes[i]!.localR, src.localR);
  }
};

const updateWorldFromLocalsMasked = (
  nodes: RuntimeNode[],
  topoOrder: readonly number[],
  mask: Uint8Array,
): void => {
  for (let oi = 0; oi < topoOrder.length; oi++) {
    const i = topoOrder[oi]!;
    if (!mask[i]) continue;

    const n = nodes[i]!;
    m4FromTRSQuat(n.localM, n.localT, n.localR, n.localS);
    if (n.parent < 0) n.worldM.set(n.localM);
    else m4Mul(n.worldM, nodes[n.parent]!.worldM, n.localM);
  }
};

const isLoopingState = (state: AnimationStateMachine['current']) =>
  state === 'idle' || state === 'run' || state === 'walkBack' || state === 'jumpAir';

const sampleCharacterPose = (
  registry: Registry,
  character: Entity,
  model: SkeletalModel,
  fsm: AnimationStateMachine | undefined,
  clipMap: AnimationClipMap | undefined,
  resample: boolean,
): RuntimeNode[] | null => {
  if (!resample) {
    const existing = scratchByCharacter.get(character);
    return existing && existing.scene === model.bodyScene ? existing.nodes : null;
  }

  if (sampledCharacters.has(character)) {
    return scratchByCharacter.get(character)!.nodes;
  }
  sampledCharacters.add(character);

  const scratch = ensureScratch(registry, character, model.bodyScene);
  applyBindPoseMasked(scratch.nodes, ensureBindWorldNodes(model.bodyScene), scratch.chainMask);

  const activeClip = fsm && clipMap ? clipMap.clips[fsm.current]?.clip : undefined;
  if (fsm && activeClip && activeClip.channels.length > 0) {
    const oneShot = fsm.current === 'jumpStart' || fsm.current === 'jumpLand';
    const time = oneShot ? fsm.stateTime : fsm.animTime;
    const speed = fsm.current === 'run' ? fsm.runPlaybackSpeed : 1;
    sampleClipToNodes(
      activeClip,
      scratch.nodes,
      time * speed,
      1,
      isLoopingState(fsm.current),
      scratch.chainMask,
    );
  }

  updateWorldFromLocalsMasked(scratch.nodes, model.bodyScene.nodeTopoOrder, scratch.chainMask);
  return scratch.nodes;
};

const writeAttachmentWorld = (
  t: Transform,
  parentT: Transform,
  visualYOffset: number,
  modelOffset: Mat4,
): void => {
  updateWorldMatrix(parentT);
  m4Copy(_renderRoot, parentT.world);
  _renderRoot[13]! += visualYOffset;
  m4Mul(_world, _renderRoot, modelOffset);
  for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
  t.dirty = false;
};

const ensureCollisionModelOffset = (
  entity: Entity,
  scene: RuntimeScene,
  boneNodeIndex: number,
  localOffset: BoneAttachment['localOffset'],
): Mat4 => {
  let offset = collisionModelOffsetByEntity.get(entity);
  if (offset) return offset;

  const boneNode = ensureBindWorldNodes(scene)[boneNodeIndex];
  offset = m4();
  if (boneNode) m4Mul(offset, boneNode.worldM, localOffset);
  else m4Copy(offset, localOffset);
  collisionModelOffsetByEntity.set(entity, offset);
  return offset;
};

const syncBoneAttachedColliderWorlds = (registry: Registry, resample: boolean) => {
  if (resample) sampledCharacters.clear();

  for (const e of registry.view(COMPONENT_KEYS.boneAttachment)) {
    const boneAtt = e.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
    const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
    const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
    const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!boneAtt || !collider || !childOf || !t) continue;

    const parent = registry.get(childOf.parentId);
    if (!parent) continue;

    const parentT = parent.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const parentModel = parent.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
    if (!parentT || !parentModel) continue;

    if (collider.characterCollision) {
      const modelOffset = ensureCollisionModelOffset(
        e,
        parentModel.bodyScene,
        boneAtt.boneNodeIndex,
        boneAtt.localOffset,
      );
      writeAttachmentWorld(t, parentT, parentModel.visualYOffset, modelOffset);
    } else {
      const fsm = parent.components[COMPONENT_KEYS.animationStateMachine] as
        | AnimationStateMachine
        | undefined;
      const clipMap = parent.components[COMPONENT_KEYS.animationClipMap] as
        | AnimationClipMap
        | undefined;
      const poseNodes = sampleCharacterPose(registry, parent, parentModel, fsm, clipMap, resample);
      if (!poseNodes) continue;

      const boneNode = poseNodes[boneAtt.boneNodeIndex];
      if (!boneNode) continue;

      m4Mul(_boneWorld, boneNode.worldM, boneAtt.localOffset);
      writeAttachmentWorld(t, parentT, parentModel.visualYOffset, _boneWorld);
    }

    if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);
  }
};

const syncNestedColliderWorlds = (registry: Registry) => {
  for (const e of registry.view(COMPONENT_KEYS.collider)) {
    if (e.components[COMPONENT_KEYS.boneAttachment]) continue;

    const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
    const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
    const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!collider || !childOf || !local || !t) continue;

    const parent = registry.get(childOf.parentId);
    const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!parentT) continue;

    updateWorldMatrix(parentT);
    m4FromTRSQuat(_localM, local.position, local.rotation, local.scale);
    m4Mul(_world, parentT.world, _localM);
    for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
    t.dirty = false;

    if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);
  }
};

export const installHitboxFollowSystem = (registry: Registry) => {
  registry.addAction('update', () => syncBoneAttachedColliderWorlds(registry, true), 8);
  registry.addAction('update', () => syncBoneAttachedColliderWorlds(registry, false), 11);
  registry.addAction('postUpdate', () => syncNestedColliderWorlds(registry), 1);
};
